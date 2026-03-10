"""Per-agent daily token usage ledger for quota enforcement."""

from __future__ import annotations

from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import Column, Index, Numeric, UniqueConstraint
from sqlmodel import Field

from app.core.time import utcnow
from app.models.base import QueryModel

RUNTIME_ANNOTATION_TYPES = (date, datetime)


class AgentTokenDailyUsage(QueryModel, table=True):
    """Daily token accounting snapshot for one board-scoped agent."""

    __tablename__ = "agent_token_daily_usage"  # pyright: ignore[reportAssignmentType]
    __table_args__ = (
        UniqueConstraint(
            "agent_id",
            "usage_date_vn",
            name="uq_agent_token_daily_usage_agent_id_usage_date_vn",
        ),
        Index(
            "ix_agent_token_daily_usage_organization_id_usage_date_vn",
            "organization_id",
            "usage_date_vn",
        ),
        Index(
            "ix_agent_token_daily_usage_org_agent_date_vn",
            "organization_id",
            "agent_id",
            "usage_date_vn",
        ),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    organization_id: UUID = Field(foreign_key="organizations.id", index=True)
    agent_id: UUID = Field(foreign_key="agents.id", index=True)
    usage_date_vn: date = Field(index=True)
    openclaw_tokens_total: int = Field(default=0)
    billed_tokens_used: int = Field(default=0)
    openclaw_cost_total: float = Field(
        default=0.0, sa_column=Column(Numeric(12, 6), server_default="0", nullable=False)
    )
    cost_used: float = Field(
        default=0.0, sa_column=Column(Numeric(12, 6), server_default="0", nullable=False)
    )
    blocked_at: datetime | None = None
    cost_blocked_at: datetime | None = None
    last_synced_at: datetime | None = None
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

