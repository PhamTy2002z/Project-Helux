# ruff: noqa: S101
"""Contract locks for agent task discovery and task workflow compatibility."""

from __future__ import annotations

from pathlib import Path
from typing import get_args

from app.api.tasks import ALLOWED_STATUSES, TASK_EVENT_TYPES
from app.main import app
from app.schemas.tasks import TaskStatus

TASK_DISCOVERY_PATH = "/api/v1/agent/boards/{board_id}/tasks"
HEARTBEAT_TEMPLATE = Path(__file__).resolve().parents[1] / "templates" / "BOARD_HEARTBEAT.md.j2"


def test_task_status_contract_stays_locked() -> None:
    assert set(get_args(TaskStatus)) == {"inbox", "in_progress", "review", "done"}
    assert ALLOWED_STATUSES == {"inbox", "in_progress", "review", "done"}


def test_task_event_taxonomy_contract_stays_locked() -> None:
    assert TASK_EVENT_TYPES == {
        "task.created",
        "task.updated",
        "task.status_changed",
        "task.comment",
    }


def test_agent_task_discovery_route_semantics_stay_stable() -> None:
    schema = app.openapi()
    op = schema["paths"][TASK_DISCOVERY_PATH]["get"]
    assert op["x-llm-intent"] == "agent_board_task_discovery"
    param_names = {item["name"] for item in op.get("parameters", [])}
    assert {"status", "assigned_agent_id", "unassigned"} <= param_names


def test_heartbeat_template_keeps_comment_protocol_and_group_guidance() -> None:
    content = HEARTBEAT_TEMPLATE.read_text(encoding="utf-8")
    assert "Task updates go only to task comments" in content
    assert "task_group_id" in content
