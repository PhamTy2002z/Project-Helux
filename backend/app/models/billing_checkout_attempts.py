"""Billing checkout attempt records for idempotent simulated unlocks."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import UniqueConstraint
from sqlmodel import Field

from app.core.time import utcnow
from app.models.base import QueryModel

RUNTIME_ANNOTATION_TYPES = (datetime,)


class BillingCheckoutAttempt(QueryModel, table=True):
    """Single simulated checkout command attempt keyed by idempotency key."""

    __tablename__ = "billing_checkout_attempts"  # pyright: ignore[reportAssignmentType]
    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "idempotency_key",
            name="uq_billing_checkout_attempts_org_idempotency",
        ),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    organization_id: UUID = Field(foreign_key="organizations.id", index=True)
    idempotency_key: str = Field(index=True, min_length=4, max_length=128)
    requested_plan_tier: str = Field(index=True)
    resolved_plan_tier: str = Field(index=True)
    status: str = Field(default="succeeded")
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
