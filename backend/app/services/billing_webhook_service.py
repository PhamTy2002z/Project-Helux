"""Process Polar webhook events and update organization plans."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.logging import get_logger
from app.core.time import utcnow
from app.models.billing_checkout_attempts import BillingCheckoutAttempt
from app.services.billing_webhook_helpers import (
    _extract_org_id,
    _get_plan_for_update,
    _is_current_subscription,
    _parse_datetime,
    _safe_get,
    _should_process_event,
    _update_billing_metadata,
)

logger = get_logger(__name__)

HANDLED_EVENTS = {
    "subscription.active",
    "subscription.revoked",
    "subscription.canceled",
    "subscription.uncanceled",
    "subscription.updated",
    "subscription.past_due",
    "checkout.updated",
    "order.paid",
}


# ---------------------------------------------------------------------------
# Handlers
# ---------------------------------------------------------------------------


async def _handle_subscription_active(
    session: AsyncSession, *, organization_id: UUID, event_data: Any
) -> None:
    """Subscription confirmed active -> flip to pro."""
    plan = await _get_plan_for_update(session, organization_id=organization_id)
    if plan is None:
        logger.error("Plan not found after create for org %s", organization_id)
        return

    event_timestamp = _safe_get(event_data, "modified_at")
    if not _should_process_event(plan, event_timestamp):
        logger.info("Skipping stale active event for org %s", organization_id)
        return

    now = utcnow()
    plan.tier = "pro"
    plan.effective_from = now
    plan.effective_until = None

    _update_billing_metadata(plan, {
        "last_checkout_mode": "polar",
        "last_checkout_at": now.isoformat(),
        "polar_subscription_id": _safe_get(event_data, "id"),
        "polar_customer_id": _safe_get(event_data, "customer_id")
        or _safe_get(_safe_get(event_data, "customer"), "id"),
        "polar_subscription_status": "active",
        "polar_started_at": _safe_get(event_data, "started_at"),
        "polar_current_period_end": _safe_get(event_data, "current_period_end"),
        "polar_canceled_at": None,
        "polar_event_timestamp": str(
            _safe_get(event_data, "modified_at") or now.isoformat()
        ),
    })
    plan.updated_at = now
    session.add(plan)

    # Record billing history entry (idempotent via polar subscription ID)
    idem_key = f"polar-sub-{_safe_get(event_data, 'id') or now.isoformat()}"
    existing = await BillingCheckoutAttempt.objects.filter_by(
        organization_id=organization_id,
        idempotency_key=idem_key,
    ).first(session)
    if existing is None:
        attempt = BillingCheckoutAttempt(
            organization_id=organization_id,
            idempotency_key=idem_key,
            requested_plan_tier="pro",
            resolved_plan_tier="pro",
            status="succeeded",
        )
        session.add(attempt)
    await session.commit()
    logger.info("Org %s upgraded to pro via Polar webhook", organization_id)

    # Enqueue upgrade confirmation email (non-blocking)
    try:
        from app.services.email.billing_email_queue import enqueue_billing_email

        enqueue_billing_email(
            organization_id=organization_id,
            email_type="upgrade_confirmed",
            event_id=str(_safe_get(event_data, "id") or ""),
        )
    except Exception:
        logger.warning("Failed to enqueue upgrade email for org %s", organization_id, exc_info=True)


async def _handle_subscription_revoked(
    session: AsyncSession, *, organization_id: UUID, event_data: Any
) -> None:
    """Subscription revoked -> block org."""
    plan = await _get_plan_for_update(session, organization_id=organization_id)
    if plan is None:
        logger.error("Plan not found after create for org %s", organization_id)
        return

    if not _is_current_subscription(plan, event_data):
        logger.warning("Ignoring revoked event for old subscription, org %s", organization_id)
        return

    now = utcnow()
    plan.tier = "trial_7d"
    plan.effective_until = now

    _update_billing_metadata(plan, {
        "polar_subscription_status": "revoked",
        "polar_canceled_at": _safe_get(event_data, "canceled_at"),
        "polar_event_timestamp": str(
            _safe_get(event_data, "modified_at") or now.isoformat()
        ),
    })
    plan.updated_at = now
    session.add(plan)
    await session.commit()
    logger.info("Org %s revoked to trial (blocked) via Polar webhook", organization_id)

    try:
        from app.services.email.billing_email_queue import enqueue_billing_email

        enqueue_billing_email(
            organization_id=organization_id,
            email_type="payment_failed",
            event_id=str(_safe_get(event_data, "id") or ""),
        )
    except Exception:
        logger.warning(
            "Failed to enqueue payment failed email for org %s", organization_id, exc_info=True
        )


async def _handle_subscription_canceled(
    session: AsyncSession, *, organization_id: UUID, event_data: Any
) -> None:
    """Subscription canceled — keep pro until period end, schedule expiry."""
    plan = await _get_plan_for_update(session, organization_id=organization_id)
    if plan is None:
        logger.error("Plan not found after create for org %s", organization_id)
        return
    now = utcnow()

    event_timestamp = _safe_get(event_data, "modified_at") or _safe_get(event_data, "canceled_at")
    if not _should_process_event(plan, event_timestamp):
        logger.info("Skipping stale canceled event for org %s", organization_id)
        return

    if not _is_current_subscription(plan, event_data):
        logger.warning("Ignoring canceled event for old subscription, org %s", organization_id)
        return

    current_period_end_raw = _safe_get(event_data, "current_period_end")
    canceled_at_raw = _safe_get(event_data, "canceled_at")
    current_period_end = _parse_datetime(current_period_end_raw)

    if current_period_end and current_period_end.replace(tzinfo=None) > now:
        plan.effective_until = current_period_end.replace(tzinfo=None)
    else:
        plan.effective_until = now

    _update_billing_metadata(plan, {
        "polar_subscription_status": "canceled",
        "polar_canceled_at": canceled_at_raw,
        "polar_current_period_end": current_period_end_raw,
        "polar_event_timestamp": str(event_timestamp),
    })
    plan.updated_at = now
    session.add(plan)
    await session.commit()
    logger.info("Org %s subscription canceled, pro until %s", organization_id, plan.effective_until)


async def _handle_subscription_uncanceled(
    session: AsyncSession, *, organization_id: UUID, event_data: Any
) -> None:
    """Subscription re-activated after cancellation — restore pro."""
    plan = await _get_plan_for_update(session, organization_id=organization_id)
    if plan is None:
        logger.error("Plan not found after create for org %s", organization_id)
        return

    event_timestamp = _safe_get(event_data, "modified_at")
    if not _should_process_event(plan, event_timestamp):
        logger.info("Skipping stale uncanceled event for org %s", organization_id)
        return

    now = utcnow()
    plan.tier = "pro"
    plan.effective_until = None

    _update_billing_metadata(plan, {
        "polar_subscription_status": "active",
        "polar_canceled_at": None,
        "polar_event_timestamp": str(
            _safe_get(event_data, "modified_at") or now.isoformat()
        ),
    })
    plan.updated_at = now
    session.add(plan)
    await session.commit()
    logger.info("Org %s subscription uncanceled, pro restored", organization_id)


async def _handle_subscription_updated(
    session: AsyncSession, *, organization_id: UUID, event_data: Any
) -> None:
    """Subscription updated (renewals, plan changes) — sync state."""
    plan = await _get_plan_for_update(session, organization_id=organization_id)
    if plan is None:
        logger.error("Plan not found after create for org %s", organization_id)
        return
    now = utcnow()

    event_timestamp = _safe_get(event_data, "modified_at")
    if not _should_process_event(plan, event_timestamp):
        logger.info("Skipping stale updated event for org %s", organization_id)
        return

    polar_status = _safe_get(event_data, "status")
    current_period_end_raw = _safe_get(event_data, "current_period_end")

    if polar_status == "active":
        plan.tier = "pro"
        plan.effective_until = None
    elif polar_status == "canceled":
        current_period_end = _parse_datetime(current_period_end_raw)
        if current_period_end:
            plan.effective_until = current_period_end.replace(tzinfo=None)

    _update_billing_metadata(plan, {
        "polar_subscription_status": polar_status,
        "polar_current_period_end": current_period_end_raw,
        "polar_event_timestamp": str(event_timestamp),
    })
    plan.updated_at = now
    session.add(plan)
    await session.commit()
    logger.info("Org %s subscription updated, status=%s", organization_id, polar_status)


async def _handle_subscription_past_due(
    session: AsyncSession, *, organization_id: UUID, event_data: Any
) -> None:
    """Subscription past due — payment failed, warn user but keep access for now."""
    plan = await _get_plan_for_update(session, organization_id=organization_id)
    if plan is None:
        logger.error("Plan not found after create for org %s", organization_id)
        return

    _update_billing_metadata(plan, {
        "polar_subscription_status": "past_due",
        "polar_event_timestamp": str(
            _safe_get(event_data, "modified_at") or utcnow().isoformat()
        ),
    })
    plan.updated_at = utcnow()
    session.add(plan)
    await session.commit()
    logger.warning("Org %s subscription past_due — payment failed", organization_id)

    try:
        from app.services.email.billing_email_queue import enqueue_billing_email

        enqueue_billing_email(
            organization_id=organization_id,
            email_type="payment_failed",
            event_id=str(_safe_get(event_data, "id") or ""),
        )
    except Exception:
        logger.warning(
            "Failed to enqueue payment failed email for org %s", organization_id, exc_info=True
        )


async def _handle_checkout_updated(
    session: AsyncSession, *, organization_id: UUID, event_data: Any
) -> None:
    """Checkout updated (expired, failed) — log for audit trail."""
    logger.info(
        "Org %s checkout updated: status=%s, id=%s",
        organization_id,
        _safe_get(event_data, "status"),
        _safe_get(event_data, "id"),
    )


async def _handle_order_paid(
    session: AsyncSession, *, organization_id: UUID, event_data: Any
) -> None:
    """Order paid -- log for audit trail."""
    logger.info("Org %s order paid via Polar: %s", organization_id, _safe_get(event_data, "id"))


# ---------------------------------------------------------------------------
# Handler dispatch maps
# ---------------------------------------------------------------------------

_HANDLERS: dict[str, Any] = {
    "subscription.active": _handle_subscription_active,
    "subscription.revoked": _handle_subscription_revoked,
    "subscription.canceled": _handle_subscription_canceled,
    "subscription.uncanceled": _handle_subscription_uncanceled,
    "subscription.updated": _handle_subscription_updated,
    "subscription.past_due": _handle_subscription_past_due,
    "checkout.updated": _handle_checkout_updated,
    "order.paid": _handle_order_paid,
}


# ---------------------------------------------------------------------------
# Entry points
# ---------------------------------------------------------------------------


async def process_stored_event(
    session: AsyncSession, *, event_record: Any
) -> None:
    """Process a stored PolarWebhookEvent record (called from worker)."""
    raw = event_record.raw_payload
    if not raw or not isinstance(raw, dict):
        logger.warning("Empty payload for webhook event %s", event_record.id)
        return

    event_type = event_record.event_type
    if event_type not in HANDLED_EVENTS:
        logger.debug("Ignoring stored event type: %s", event_type)
        return

    event_data = raw.get("data", {})
    org_id = event_record.organization_id
    if org_id is None:
        logger.warning("Stored event %s missing organization_id", event_record.id)
        return

    handler = _HANDLERS.get(event_type)
    if handler:
        await handler(session, organization_id=org_id, event_data=event_data)


async def process_polar_event(session: AsyncSession, *, event: Any) -> None:
    """Dispatch Polar webhook event to appropriate handler (legacy sync path)."""
    event_type = getattr(event, "type", None) or ""
    if event_type not in HANDLED_EVENTS:
        logger.debug("Ignoring Polar event type: %s", event_type)
        return

    event_data = getattr(event, "data", None)
    if event_data is None:
        event_data = event.get("data") if isinstance(event, dict) else {}

    metadata = _safe_get(event_data, "metadata")
    if isinstance(metadata, str):
        import json

        try:
            metadata = json.loads(metadata)
        except (json.JSONDecodeError, TypeError):
            metadata = None

    org_id = _extract_org_id(metadata if isinstance(metadata, dict) else None)
    if org_id is None:
        logger.warning("Polar event %s missing organization_id in metadata", event_type)
        return

    handler = _HANDLERS.get(event_type)
    if handler:
        await handler(session, organization_id=org_id, event_data=event_data)
