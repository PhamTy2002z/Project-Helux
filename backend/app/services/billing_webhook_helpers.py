"""Shared helpers for Polar webhook event processing and plan metadata."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.organization_plans import OrganizationPlan
from app.services.entitlements import (
    get_or_create_organization_plan,
    get_organization_plan_for_update,
)


def _safe_get(obj: Any, key: str) -> Any:
    """Get attribute or dict key safely from event data objects."""
    if isinstance(obj, dict):
        return obj.get(key)
    return getattr(obj, key, None)


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


def _parse_datetime(raw: Any) -> datetime | None:
    """Parse ISO datetime string from Polar event data."""
    if not raw or not isinstance(raw, str):
        return None
    try:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt
    except (ValueError, TypeError):
        return None


def _update_billing_metadata(plan: OrganizationPlan, updates: dict[str, Any]) -> None:
    """Merge updates into plan_metadata.billing without losing existing fields."""
    existing_meta = plan.plan_metadata if isinstance(plan.plan_metadata, dict) else {}
    billing = existing_meta.get("billing")
    existing_billing: dict[str, Any] = billing if isinstance(billing, dict) else {}
    plan.plan_metadata = {
        **existing_meta,
        "billing": {**existing_billing, **updates},
    }


def _should_process_event(plan: OrganizationPlan, event_timestamp_raw: Any) -> bool:
    """Reject events older than the last processed event for this subscription."""
    event_ts = _parse_datetime(event_timestamp_raw)
    if event_ts is None:
        return True

    meta = plan.plan_metadata if isinstance(plan.plan_metadata, dict) else {}
    billing = meta.get("billing", {})
    last_ts_raw = billing.get("polar_event_timestamp") if isinstance(billing, dict) else None
    last_ts = _parse_datetime(last_ts_raw)

    if last_ts is None:
        return True

    return event_ts >= last_ts


async def _get_plan_for_update(
    session: AsyncSession, *, organization_id: UUID
) -> OrganizationPlan | None:
    """Ensure plan exists then acquire row-level lock for safe mutation."""
    await get_or_create_organization_plan(session, organization_id=organization_id)
    return await get_organization_plan_for_update(session, organization_id=organization_id)


def _is_current_subscription(plan: OrganizationPlan, event_data: Any) -> bool:
    """Check if event is for the current subscription (not an old one)."""
    event_sub_id = str(_safe_get(event_data, "id") or "")
    if not event_sub_id:
        return True

    meta = plan.plan_metadata if isinstance(plan.plan_metadata, dict) else {}
    billing = meta.get("billing", {})
    stored_sub_id = billing.get("polar_subscription_id") if isinstance(billing, dict) else None

    if not stored_sub_id:
        return True

    return event_sub_id == stored_sub_id
