"""Health and readiness probe response schemas."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import Field
from sqlmodel import SQLModel

RUNTIME_ANNOTATION_TYPES = (UUID, datetime)


class HealthStatusResponse(SQLModel):
    """Standard payload for service liveness/readiness checks."""

    ok: bool = Field(
        description="Indicates whether the probe check succeeded.",
        examples=[True],
    )


class ReadinessComponentStatus(SQLModel):
    """Single dependency check result returned by `/readyz`."""

    component: str = Field(
        description="Dependency component name.",
        examples=["database"],
    )
    ok: bool = Field(
        description="Whether this dependency is currently healthy.",
        examples=[True],
    )
    required: bool = Field(
        description="Whether this dependency gates readiness.",
        examples=[True],
    )
    latency_ms: int | None = Field(
        default=None,
        description="Observed check latency in milliseconds when available.",
        examples=[7],
    )
    detail: str | None = Field(
        default=None,
        description="Optional diagnostic detail for operators.",
        examples=["pong"],
    )


class ReadinessStatusResponse(HealthStatusResponse):
    """Structured readiness response with per-dependency status."""

    checked_at: datetime = Field(
        description="UTC timestamp when dependency checks completed.",
    )
    components: list[ReadinessComponentStatus] = Field(
        description="Dependency check statuses included in readiness evaluation.",
    )


class AgentHealthStatusResponse(HealthStatusResponse):
    """Agent-authenticated liveness payload for agent route probes."""

    agent_id: UUID = Field(
        description="Authenticated agent id derived from `X-Agent-Token`.",
        examples=["aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"],
    )
    board_id: UUID | None = Field(
        default=None,
        description="Board scope for the authenticated agent, when applicable.",
        examples=["bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"],
    )
    gateway_id: UUID = Field(
        description="Gateway owning the authenticated agent.",
        examples=["cccccccc-cccc-cccc-cccc-cccccccccccc"],
    )
    status: str = Field(
        description="Current persisted lifecycle status for the authenticated agent.",
        examples=["online", "healthy", "updating"],
    )
    is_board_lead: bool = Field(
        description="Whether the authenticated agent is the board lead.",
        examples=[False],
    )
