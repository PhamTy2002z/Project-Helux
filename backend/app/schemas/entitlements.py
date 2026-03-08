"""Schemas for organization plan tiers, quotas, and usage visibility."""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from sqlmodel import SQLModel

PlanTier = Literal["trial_7d", "pro"]
RUNTIME_ANNOTATION_TYPES = (datetime, UUID)


class OrganizationPlanRead(SQLModel):
    """Current organization plan assignment payload."""

    id: UUID
    organization_id: UUID
    tier: PlanTier
    effective_from: datetime
    effective_until: datetime | None = None
    plan_metadata: dict[str, object] | None = None
    created_at: datetime
    updated_at: datetime


class OrganizationPlanAssign(SQLModel):
    """Manual plan assignment payload (no payment checkout flow)."""

    tier: PlanTier
    effective_from: datetime | None = None
    effective_until: datetime | None = None
    plan_metadata: dict[str, object] | None = None


class QuotaUsage(SQLModel):
    """Usage and capacity details for a single quota dimension."""

    resource: str
    used: int
    limit: int | None = None
    remaining: int | None = None
    exceeded: bool = False


class EntitlementUsageRead(SQLModel):
    """Complete plan + quota usage snapshot for an organization."""

    organization_id: UUID
    plan: PlanTier
    generated_at: datetime
    quotas: list[QuotaUsage]
