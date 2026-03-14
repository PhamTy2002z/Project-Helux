"""Schemas for billing v1 simulated checkout and subscription reads."""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field
from sqlmodel import SQLModel

from app.schemas.entitlements import PlanTier

RUNTIME_ANNOTATION_TYPES = (datetime, UUID)
SubscriptionStatus = Literal["active", "blocked_for_payment"]
BillingMetricEventSource = Literal["sidebar", "settings", "boards_new", "agents_new", "unknown"]


class BillingSimulateCheckoutRequest(SQLModel):
    """Request payload for simulated checkout plan unlock."""

    plan_tier: PlanTier
    idempotency_key: str = Field(min_length=4, max_length=128)


class BillingSubscriptionRead(SQLModel):
    """Current billing/subscription state for the active organization."""

    organization_id: UUID
    plan_tier: PlanTier
    status: SubscriptionStatus
    effective_from: datetime
    effective_until: datetime | None = None
    trial_expires_at: datetime | None = None
    billing_mode: str
    payment_provider: str


class BillingSimulateCheckoutResponse(SQLModel):
    """Result payload for a simulated checkout command."""

    checkout_id: UUID
    idempotent_replay: bool = False
    subscription: BillingSubscriptionRead


class BillingCheckoutRequest(SQLModel):
    """Request to create a real checkout session via payment provider."""

    plan_tier: PlanTier
    idempotency_key: str = Field(min_length=4, max_length=128)


class BillingCheckoutResponse(SQLModel):
    """Response with checkout URL for redirect."""

    checkout_url: str
    checkout_id: str
    provider: str


class BillingUpgradeModalOpenEvent(SQLModel):
    """Payload for tracking upgrade modal open events."""

    source: BillingMetricEventSource = "unknown"


class BillingSupportTimelineEvent(SQLModel):
    """Minimal support timeline event payload for request-id correlation."""

    id: UUID
    event_type: str
    request_id: str | None = None
    endpoint: str | None = None
    created_at: datetime
    details: dict[str, object] | None = None
