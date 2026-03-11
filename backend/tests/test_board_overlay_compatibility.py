# ruff: noqa: S101
"""Compatibility and rollout regression tests for board planning overlay telemetry."""

from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.api import metrics as metrics_api
from app.core.auth_mode import AuthMode
from app.core.config import Settings
from app.services.board_overlay_observability import (
    BoardOverlayRuntimeSnapshot,
    get_board_overlay_runtime_snapshot,
    record_agent_task_loop_regression,
    record_board_query_latency,
    reset_board_overlay_runtime_metrics,
)


def _local_settings(**overrides: object) -> Settings:
    return Settings(
        auth_mode=AuthMode.LOCAL,
        local_auth_token="x" * 60,
        base_url="http://localhost:8000",
        **overrides,
    )


def test_board_overlay_flag_canary_resolution() -> None:
    board_id = uuid4()
    org_id = uuid4()
    other_board_id = uuid4()

    settings = _local_settings(
        board_planning_overlay_v1=False,
        board_planning_overlay_v1_canary_board_ids=f"{board_id}",
        board_planning_overlay_v1_canary_org_ids=f"{org_id}",
        board_query_v2=False,
        board_query_v2_canary_board_ids=f"{other_board_id}",
        board_query_v2_canary_org_ids="",
    )

    assert settings.board_planning_overlay_enabled_for(board_id=board_id, organization_id=None)
    assert settings.board_planning_overlay_enabled_for(board_id=None, organization_id=org_id)
    assert not settings.board_planning_overlay_enabled_for(
        board_id=other_board_id,
        organization_id=None,
    )
    assert settings.board_query_v2_enabled_for(board_id=other_board_id, organization_id=None)
    assert not settings.board_query_v2_enabled_for(board_id=board_id, organization_id=None)


def test_board_overlay_runtime_snapshot_aggregates_latency_and_regressions() -> None:
    reset_board_overlay_runtime_metrics()
    record_board_query_latency(latency_ms=120.0, used_cursor=False, used_filters=True)
    record_board_query_latency(latency_ms=240.0, used_cursor=True, used_filters=False)
    record_agent_task_loop_regression()

    snapshot = get_board_overlay_runtime_snapshot()

    assert snapshot.samples == 2
    assert snapshot.avg_ms == 180.0
    assert snapshot.max_ms == 240.0
    assert snapshot.filter_usage_count == 1
    assert snapshot.cursor_usage_count == 1
    assert snapshot.agent_task_loop_regression_count == 1


@pytest.mark.asyncio
async def test_board_overlay_metrics_endpoint_rolls_up_flags_and_runtime(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    org_id = uuid4()
    board_a = uuid4()
    board_b = uuid4()

    async def _accessible(*_args: object, **_kwargs: object) -> list[object]:
        return [board_a, board_b]

    monkeypatch.setattr(metrics_api, "list_accessible_board_ids", _accessible)
    monkeypatch.setattr(
        type(metrics_api.settings),
        "board_planning_overlay_enabled_for",
        lambda self, *, board_id, organization_id: board_id == board_a
        and organization_id == org_id,
    )
    monkeypatch.setattr(
        type(metrics_api.settings),
        "board_query_v2_enabled_for",
        lambda self, *, board_id, organization_id: board_id == board_b
        and organization_id == org_id,
    )
    monkeypatch.setattr(
        metrics_api,
        "get_board_overlay_runtime_snapshot",
        lambda: BoardOverlayRuntimeSnapshot(
            samples=8,
            avg_ms=143.5,
            p95_ms=220.0,
            max_ms=290.0,
            filter_usage_count=6,
            cursor_usage_count=3,
            agent_task_loop_regression_count=2,
        ),
    )

    ctx = SimpleNamespace(
        organization=SimpleNamespace(id=org_id),
        member=SimpleNamespace(organization_id=org_id),
    )

    payload = await metrics_api.board_overlay_metrics(session=object(), ctx=ctx)

    assert payload.organization_id == org_id
    assert payload.board_overlay_enabled_count == 1
    assert payload.board_query_v2_enabled_count == 1
    assert payload.board_query_latency_samples == 8
    assert payload.board_query_latency_ms_avg == 143.5
    assert payload.board_query_latency_ms_p95 == 220.0
    assert payload.board_query_latency_ms_max == 290.0
    assert payload.filter_usage_count == 6
    assert payload.cursor_usage_count == 3
    assert payload.agent_task_loop_regression_count == 2
