"""Manual SaaS plan assignments per organization (no payment integration)."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import JSON, Column, UniqueConstraint
from sqlmodel import Field

from app.core.time import utcnow
from app.models.base import QueryModel

RUNTIME_ANNOTATION_TYPES = (datetime,)


class OrganizationPlan(QueryModel, table=True):
    """Current manually-assigned plan tier for an organization."""

    __tablename__ = "organization_plans"  # pyright: ignore[reportAssignmentType]
    __table_args__ = (
        UniqueConstraint("organization_id", name="uq_organization_plans_organization_id"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    organization_id: UUID = Field(foreign_key="organizations.id", index=True)
    tier: str = Field(default="trial_7d", index=True)
    effective_from: datetime = Field(default_factory=utcnow)
    effective_until: datetime | None = None
    plan_metadata: dict[str, Any] | None = Field(
        default=None,
        sa_column=Column("metadata", JSON),
    )
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
