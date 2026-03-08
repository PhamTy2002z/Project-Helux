# ruff: noqa: INP001
"""Queue payload helpers for gateway activation tasks."""

from __future__ import annotations

from datetime import datetime
from uuid import uuid4

import pytest

from app.services.openclaw.gateway_activation_queue import (
    QueuedGatewayActivation,
    decode_gateway_activation_task,
    enqueue_gateway_activation,
)
from app.services.queue import QueuedTask


def test_enqueue_gateway_activation_uses_queue_enqueue(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, object] = {}

    def _fake_enqueue(task: QueuedTask, queue_name: str, *, redis_url: str | None = None) -> bool:
        captured["task"] = task
        captured["queue_name"] = queue_name
        captured["redis_url"] = redis_url
        return True

    monkeypatch.setattr(
        "app.services.openclaw.gateway_activation_queue.enqueue_task",
        _fake_enqueue,
    )

    payload = QueuedGatewayActivation(gateway_id=uuid4(), action="provision")
    assert enqueue_gateway_activation(payload) is True
    queued = captured["task"]
    assert isinstance(queued, QueuedTask)
    assert queued.task_type == "gateway_activation"
    assert queued.payload["action"] == "provision"


def test_decode_gateway_activation_task_roundtrip() -> None:
    gateway_id = uuid4()
    task = QueuedTask(
        task_type="gateway_activation",
        payload={"gateway_id": str(gateway_id), "action": "update"},
        created_at=datetime.now(),
        attempts=2,
    )

    decoded = decode_gateway_activation_task(task)
    assert decoded.gateway_id == gateway_id
    assert decoded.action == "update"
    assert decoded.attempts == 2


def test_decode_gateway_activation_task_rejects_invalid_action() -> None:
    task = QueuedTask(
        task_type="gateway_activation",
        payload={"gateway_id": str(uuid4()), "action": "invalid"},
        created_at=datetime.now(),
        attempts=0,
    )
    with pytest.raises(ValueError, match="action must be either"):
        decode_gateway_activation_task(task)
