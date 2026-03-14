"""Process Polar webhook events and update organization plans."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.logging import get_logger
from app.core.time import utcnow
from app.services.entitlements import get_or_create_organization_plan

logger = get_logger(__name__)

HANDLED_EVENTS = {
    "subscription.active",
    "subscription.revoked",
    "subscription.canceled",
    "order.paid",
}


def _extract_org_id(metadata: dict[str, Any] | None) -> UUID | None:
    """Extract organization_id from event metadata."""
    if not metadata:
        return None
    raw = metadata.get("organization_id")
    if not raw:
        return None
    try:
        return UUID(str(raw))
    except ValueError:
        return None


async def _handle_subscription_active(
    session: AsyncSession, *, organization_id: UUID, event_data: Any
) -> None:
    """Subscription confirmed active -> flip to pro."""
    plan = await get_or_create_organization_plan(session, organization_id=organization_id)
    now = utcnow()
    plan.tier = "pro"
    plan.effective_from = now
    plan.effective_until = None  # pro has no expiry
    existing_meta: dict[str, Any] = (
        plan.plan_metadata if isinstance(plan.plan_metadata, dict) else {}
    )
    billing_val = existing_meta.get("billing")
    existing_billing: dict[str, Any] = billing_val if isinstance(billing_val, dict) else {}
    plan.plan_metadata = {
        **existing_meta,
        "billing": {
            **existing_billing,
            "last_checkout_mode": "polar",
            "last_checkout_at": now.isoformat(),
            "polar_subscription_id": _safe_get(event_data, "id"),
        },
    }
    plan.updated_at = now
    session.add(plan)
    await session.commit()
    logger.info("Org %s upgraded to pro via Polar webhook", organization_id)


async def _handle_subscription_revoked(
    session: AsyncSession, *, organization_id: UUID, event_data: Any
) -> None:
    """Subscription revoked -> block org (expired trial)."""
    plan = await get_or_create_organization_plan(session, organization_id=organization_id)
    now = utcnow()
    plan.tier = "trial_7d"
    plan.effective_until = now  # expired immediately -> blocked_for_payment
    plan.updated_at = now
    session.add(plan)
    await session.commit()
    logger.info("Org %s revoked to trial (blocked) via Polar webhook", organization_id)


async def _handle_subscription_canceled(
    session: AsyncSession, *, organization_id: UUID, event_data: Any
) -> None:
    """Subscription canceled -- keep pro until period end (log only)."""
    logger.info(
        "Org %s subscription canceled via Polar (pro remains until period end)",
        organization_id,
    )


async def _handle_order_paid(
    session: AsyncSession, *, organization_id: UUID, event_data: Any
) -> None:
    """Order paid -- log for audit trail."""
    logger.info("Org %s order paid via Polar: %s", organization_id, _safe_get(event_data, "id"))


def _safe_get(obj: Any, key: str) -> Any:
    """Get attribute or dict key safely from event data objects."""
    if isinstance(obj, dict):
        return obj.get(key)
    return getattr(obj, key, None)


_HANDLERS = {
    "subscription.active": _handle_subscription_active,
    "subscription.revoked": _handle_subscription_revoked,
    "subscription.canceled": _handle_subscription_canceled,
    "order.paid": _handle_order_paid,
}


async def process_polar_event(session: AsyncSession, *, event: Any) -> None:
    """Dispatch Polar webhook event to appropriate handler."""
    event_type = getattr(event, "type", None) or ""
    if event_type not in HANDLED_EVENTS:
        logger.debug("Ignoring Polar event type: %s", event_type)
        return

    # Extract metadata -- handle both attribute and dict access patterns
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
