"""Periodic reconciliation between FlowGrid plan state and Polar subscriptions."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from uuid import UUID

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.logging import get_logger
from app.core.time import utcnow
from app.models.organization_plans import OrganizationPlan

logger = get_logger(__name__)


@dataclass
class ReconciliationResult:
    """Summary of a single org reconciliation."""

    organization_id: UUID
    local_tier: str
    polar_status: str | None
    discrepancy: str | None  # None = in sync
    action_taken: str | None


async def reconcile_organization(
    session: AsyncSession,
    *,
    organization_id: UUID,
    polar_customer_id: str,
) -> ReconciliationResult:
    """Compare single org plan state with Polar subscription."""
    from app.services.entitlements import get_or_create_organization_plan
    from app.services.polar_client import get_polar_client

    plan = await get_or_create_organization_plan(session, organization_id=organization_id)
    client = get_polar_client()

    # Query Polar for subscriptions filtered by customer
    try:
        subscriptions = await client.subscriptions.list_async(
            customer_id=polar_customer_id,
        )
    except Exception as exc:
        logger.warning("Polar API error for org %s: %s", organization_id, exc)
        return ReconciliationResult(
            organization_id=organization_id,
            local_tier=plan.tier,
            polar_status=None,
            discrepancy=f"polar_api_error: {exc}",
            action_taken=None,
        )

    # Find active subscription (already filtered by customer_id)
    polar_sub = None
    for sub in subscriptions.result or []:
        if getattr(sub, "status", None) == "active":
            polar_sub = sub
            break

    polar_status = getattr(polar_sub, "status", "none") if polar_sub else "none"

    # Compare states
    discrepancy = None
    action_taken = None

    if polar_status == "active" and plan.tier != "pro":
        discrepancy = f"polar=active but local={plan.tier}"
        # Auto-fix: upgrade to pro (safe — user is paying)
        plan.tier = "pro"
        plan.effective_until = None
        plan.updated_at = utcnow()
        session.add(plan)
        await session.commit()
        action_taken = "auto_upgraded_to_pro"
        logger.warning("RECONCILIATION: Org %s auto-upgraded. %s", organization_id, discrepancy)

    elif polar_status == "none" and plan.tier == "pro":
        discrepancy = "polar=none but local=pro"
        # DO NOT auto-downgrade — flag for manual review
        action_taken = "flagged_for_review"
        logger.warning("RECONCILIATION: Org %s needs review. %s", organization_id, discrepancy)

    elif polar_status == "canceled" and plan.tier == "pro" and plan.effective_until is None:
        discrepancy = "polar=canceled but local pro has no expiry"
        period_end_raw = getattr(polar_sub, "current_period_end", None)
        if period_end_raw:
            from app.services.billing_webhook_helpers import _parse_datetime

            period_end = _parse_datetime(str(period_end_raw))
            if period_end:
                plan.effective_until = period_end.replace(tzinfo=None)
                plan.updated_at = utcnow()
                session.add(plan)
                await session.commit()
                action_taken = f"set_effective_until={period_end.isoformat()}"
        if not action_taken:
            action_taken = "flagged_for_review"
        logger.warning("RECONCILIATION: Org %s canceled fix. %s", organization_id, discrepancy)

    return ReconciliationResult(
        organization_id=organization_id,
        local_tier=plan.tier,
        polar_status=polar_status,
        discrepancy=discrepancy,
        action_taken=action_taken,
    )


async def reconcile_all(session: AsyncSession) -> list[ReconciliationResult]:
    """Reconcile all orgs with Polar billing data."""
    stmt = select(OrganizationPlan).where(OrganizationPlan.plan_metadata.isnot(None))
    result = await session.exec(stmt)
    plans = result.all()

    results: list[ReconciliationResult] = []
    for plan in plans:
        meta = plan.plan_metadata if isinstance(plan.plan_metadata, dict) else {}
        billing = meta.get("billing", {})
        customer_id = billing.get("polar_customer_id") if isinstance(billing, dict) else None

        if not customer_id:
            continue

        rec_result = await reconcile_organization(
            session,
            organization_id=plan.organization_id,
            polar_customer_id=customer_id,
        )
        results.append(rec_result)

        # Rate limit: avoid hammering Polar API
        await asyncio.sleep(0.5)

    discrepancies = [r for r in results if r.discrepancy]
    logger.info(
        "Reconciliation complete: %d orgs checked, %d discrepancies",
        len(results),
        len(discrepancies),
    )
    return results
