# ruff: noqa: INP001
"""Queue worker registration tests for invite email tasks."""

from __future__ import annotations

from app.services.email.queue import TASK_TYPE as INVITE_EMAIL_TASK_TYPE
from app.services.queue_worker import _TASK_HANDLERS


def test_worker_registers_invite_email_handler() -> None:
    assert INVITE_EMAIL_TASK_TYPE in _TASK_HANDLERS
