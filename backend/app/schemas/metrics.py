"""Dashboard metrics schemas for KPI and time-series API responses."""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from sqlmodel import SQLModel

from app.schemas.entitlements import EntitlementUsageRead

RUNTIME_ANNOTATION_TYPES = (datetime, UUID)
DashboardRangeKey = Literal["24h", "3d", "7d", "14d", "1m", "3m", "6m", "1y"]
DashboardBucketKey = Literal["hour", "day", "week", "month"]


class DashboardSeriesPoint(SQLModel):
    """Single numeric time-series point."""

    period: datetime
    value: float


class DashboardWipPoint(SQLModel):
    """Work-in-progress point split by task status buckets."""

    period: datetime
    inbox: int
    in_progress: int
    review: int
    done: int


class DashboardRangeSeries(SQLModel):
    """Series payload for a single range/bucket combination."""

    range: DashboardRangeKey
    bucket: DashboardBucketKey
    points: list[DashboardSeriesPoint]


class DashboardWipRangeSeries(SQLModel):
    """WIP series payload for a single range/bucket combination."""

    range: DashboardRangeKey
    bucket: DashboardBucketKey
    points: list[DashboardWipPoint]


class DashboardSeriesSet(SQLModel):
    """Primary vs comparison pair for generic series metrics."""

    primary: DashboardRangeSeries
    comparison: DashboardRangeSeries


class DashboardWipSeriesSet(SQLModel):
    """Primary vs comparison pair for WIP status series metrics."""

    primary: DashboardWipRangeSeries
    comparison: DashboardWipRangeSeries


class DashboardKpis(SQLModel):
    """Topline dashboard KPI summary values."""

    active_agents: int
    tasks_in_progress: int
    inbox_tasks: int
    in_progress_tasks: int
    review_tasks: int
    done_tasks: int
    error_rate_pct: float
    median_cycle_time_hours_7d: float | None


class DashboardPendingApproval(SQLModel):
    """Single pending approval item for cross-board dashboard listing."""

    approval_id: UUID
    board_id: UUID
    board_name: str
    action_type: str
    confidence: float
    created_at: datetime
    task_title: str | None = None


class DashboardPendingApprovals(SQLModel):
    """Pending approval snapshot used on the dashboard."""

    total: int
    items: list[DashboardPendingApproval]


class DashboardMetrics(SQLModel):
    """Complete dashboard metrics response payload."""

    range: DashboardRangeKey
    generated_at: datetime
    kpis: DashboardKpis
    throughput: DashboardSeriesSet
    cycle_time: DashboardSeriesSet
    error_rate: DashboardSeriesSet
    wip: DashboardWipSeriesSet
    pending_approvals: DashboardPendingApprovals


class TenantSloMetrics(SQLModel):
    """Tenant-scoped SaaS SLO summary used for support and alerting."""

    organization_id: UUID
    range: DashboardRangeKey
    generated_at: datetime
    dimensions: dict[str, str]
    error_rate_pct: float
    median_cycle_time_hours: float | None
    approval_queue_lag_seconds: float
    quota_usage: EntitlementUsageRead


class SaasBillingHealthMetrics(SQLModel):
    """Billing-simulated observability metrics for support and alert triage."""

    organization_id: UUID
    range: DashboardRangeKey
    generated_at: datetime
    upgrade_modal_open_count: int
    checkout_success_count: int
    checkout_failure_count: int
    checkout_failure_ratio_pct: float
    trial_blocked_count: int
    trial_blocked_rate_pct: float


class BoardOverlayMetrics(SQLModel):
    """Board planning overlay rollout and compatibility telemetry snapshot."""

    organization_id: UUID
    generated_at: datetime
    board_overlay_enabled_count: int
    board_query_v2_enabled_count: int
    board_query_latency_samples: int
    board_query_latency_ms_avg: float
    board_query_latency_ms_p95: float | None
    board_query_latency_ms_max: float | None
    filter_usage_count: int
    cursor_usage_count: int
    agent_task_loop_regression_count: int
