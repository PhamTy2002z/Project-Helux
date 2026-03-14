# ruff: noqa: INP001
"""Queue payload tests for organization invite email delivery."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

import pytest

from app.services.email.queue import (
    TASK_TYPE,
    decode_invite_email_task,
    enqueue_invite_email_send,
    requeue_invite_email_task,
)
from app.services.queue import QueuedTask, dequeue_task


class _FakeRedis:
    def __init__(self) -> None:
        self.values: list[str] = []

    def lpush(self, key: str, value: str) -> None:
        del key
        self.values.insert(0, value)

    def rpop(self, key: str) -> str | None:
        del key
        if not self.values:
            return None
        return self.values.pop()


def test_enqueue_invite_email_send_roundtrip(monkeypatch: pytest.MonkeyPatch) -> None:
    fake = _FakeRedis()

    def _fake_redis(*, redis_url: str | None = None) -> _FakeRedis:
        del redis_url
        return fake

    invite_id = uuid4()
    monkeypatch.setattr("app.services.queue._redis_client", _fake_redis)

    assert enqueue_invite_email_send(invite_id=invite_id, trigger="create") is True

    raw = dequeue_task("default")
    assert raw is not None
    payload = decode_invite_email_task(raw)
    assert payload.invite_id == invite_id
    assert payload.trigger == "create"
    assert payload.send_key != ""


@pytest.mark.parametrize("attempts", [0, 1, 2, 3])
def test_requeue_invite_email_task_respects_retry_cap(
    monkeypatch: pytest.MonkeyPatch,
    attempts: int,
) -> None:
    fake = _FakeRedis()

    def _fake_redis(*, redis_url: str | None = None) -> _FakeRedis:
        del redis_url
        return fake

    monkeypatch.setattr("app.services.queue._redis_client", _fake_redis)
    task = QueuedTask(
        task_type=TASK_TYPE,
        payload={
            "invite_id": str(uuid4()),
            "send_key": "send-key",
            "trigger": "resend",
        },
        created_at=datetime.now(UTC),
        attempts=attempts,
    )

    if attempts >= 3:
        assert requeue_invite_email_task(task) is False
    else:
        assert requeue_invite_email_task(task) is True
        requeued = dequeue_task("default")
        assert requeued is not None
        assert requeued.attempts == attempts + 1


def test_decode_invite_email_task_rejects_unexpected_task_type() -> None:
    task = QueuedTask(
        task_type="wrong",
        payload={"invite_id": str(uuid4()), "send_key": "x", "trigger": "create"},
        created_at=datetime.now(UTC),
    )
    with pytest.raises(ValueError, match="Unexpected task_type"):
        decode_invite_email_task(task)
