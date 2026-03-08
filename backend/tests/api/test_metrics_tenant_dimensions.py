from __future__ import annotations

from datetime import datetime
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.api import metrics as metrics_api
from app.schemas.entitlements import EntitlementUsageRead, QuotaUsage


@pytest.mark.asyncio
async def test_tenant_slo_metrics_exposes_tenant_dimensions(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    org_id = uuid4()
    board_id = uuid4()

    async def _board_ids(*_args: object, **_kwargs: object) -> list[object]:
        return [board_id]

    async def _error_rate(*_args: object, **_kwargs: object) -> float:
        return 1.75

    async def _cycle_time(*_args: object, **_kwargs: object) -> float:
        return 2.5

    async def _queue_lag(*_args: object, **_kwargs: object) -> float:
        return 48.0

    async def _usage(*_args: object, **_kwargs: object) -> EntitlementUsageRead:
        return EntitlementUsageRead(
            organization_id=org_id,
            plan="beta",
            generated_at=datetime(2026, 3, 8, 6, 0, 0),
            quotas=[QuotaUsage(resource="boards", used=3, limit=20, remaining=17, exceeded=False)],
        )

    monkeypatch.setattr(metrics_api, "_resolve_dashboard_board_ids", _board_ids)
    monkeypatch.setattr(metrics_api, "_error_rate_kpi", _error_rate)
    monkeypatch.setattr(metrics_api, "_median_cycle_time_for_range", _cycle_time)
    monkeypatch.setattr(metrics_api, "_pending_approval_queue_lag_seconds", _queue_lag)
    monkeypatch.setattr(metrics_api, "get_entitlement_usage", _usage)

    ctx = SimpleNamespace(
        organization=SimpleNamespace(id=org_id),
        member=SimpleNamespace(organization_id=org_id),
    )

    payload = await metrics_api.tenant_slo_metrics(
        range_key="7d",
        session=object(),
        ctx=ctx,
    )

    assert payload.organization_id == org_id
    assert payload.dimensions["organization_id"] == str(org_id)
    assert payload.error_rate_pct == 1.75
    assert payload.median_cycle_time_hours == 2.5
    assert payload.approval_queue_lag_seconds == 48.0
    assert payload.quota_usage.plan == "beta"
