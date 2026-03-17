"""Raw Polar webhook event storage for replay and audit."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import JSON, Column, UniqueConstraint
from sqlmodel import Field

from app.core.time import utcnow
from app.models.base import QueryModel


class PolarWebhookEvent(QueryModel, table=True):
    """Persisted Polar webhook event for store-then-process reliability."""

    __tablename__ = "polar_webhook_events"
    __table_args__ = (
        UniqueConstraint("polar_event_id", name="uq_polar_webhook_events_polar_event_id"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    event_type: str = Field(index=True)
    polar_event_id: str | None = Field(default=None, index=True)
    raw_payload: dict[str, Any] | None = Field(
        default=None,
        sa_column=Column("raw_payload", JSON),
    )
    organization_id: UUID | None = Field(default=None, index=True)
    status: str = Field(default="pending", index=True)
    error_message: str | None = None
    attempts: int = Field(default=0)
    received_at: datetime = Field(default_factory=utcnow)
    processed_at: datetime | None = None
