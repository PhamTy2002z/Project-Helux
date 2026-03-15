# ruff: noqa: INP001, S101
"""Tests for welcome email queue payload helpers."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

import pytest

from app.services.email.welcome_email_queue import (
    QueuedWelcomeEmail,
    decode_welcome_email_task,
)
from app.services.queue import QueuedTask


class TestDecodeWelcomeEmailTask:
    """Tests for decode_welcome_email_task function."""

    def test_decodes_valid_queued_task(self) -> None:
        user_id = str(uuid4())
        user_email = "alice@example.com"
        first_name = "Alice"
        send_key = "abc123"
        trigger = "clerk_webhook"

        task = QueuedTask(
            task_type="welcome_email_send",
            payload={
                "user_id": user_id,
                "user_email": user_email,
                "first_name": first_name,
                "send_key": send_key,
                "trigger": trigger,
            },
            created_at=datetime.now(UTC),
            attempts=0,
        )

        result = decode_welcome_email_task(task)

        assert result.user_id == user_id
        assert result.user_email == user_email
        assert result.first_name == first_name
        assert result.send_key == send_key
        assert result.trigger == trigger
        assert result.attempts == 0

    def test_round_trip_encode_decode(self) -> None:
        original = QueuedWelcomeEmail(
            user_email="bob@example.com",
            user_id=str(uuid4()),
            first_name="Bob",
            send_key="xyz789",
            trigger="manual_test",
            attempts=2,
        )

        task = QueuedTask(
            task_type="welcome_email_send",
            payload={
                "user_email": original.user_email,
                "user_id": original.user_id,
                "first_name": original.first_name,
                "send_key": original.send_key,
                "trigger": original.trigger,
            },
            created_at=datetime.now(UTC),
            attempts=original.attempts,
        )

        decoded = decode_welcome_email_task(task)

        assert decoded.user_email == original.user_email
        assert decoded.user_id == original.user_id
        assert decoded.first_name == original.first_name
        assert decoded.send_key == original.send_key
        assert decoded.trigger == original.trigger
        assert decoded.attempts == original.attempts

    def test_handles_missing_first_name_gracefully(self) -> None:
        user_id = str(uuid4())
        task = QueuedTask(
            task_type="welcome_email_send",
            payload={
                "user_id": user_id,
                "user_email": "charlie@example.com",
                "send_key": "key123",
                "trigger": "clerk_webhook",
            },
            created_at=datetime.now(UTC),
            attempts=0,
        )

        result = decode_welcome_email_task(task)

        assert result.first_name == ""
        assert result.user_id == user_id

    def test_handles_empty_first_name_as_empty_string(self) -> None:
        user_id = str(uuid4())
        task = QueuedTask(
            task_type="welcome_email_send",
            payload={
                "user_id": user_id,
                "user_email": "david@example.com",
                "first_name": "",
                "send_key": "key456",
                "trigger": "clerk_webhook",
            },
            created_at=datetime.now(UTC),
            attempts=0,
        )

        result = decode_welcome_email_task(task)

        assert result.first_name == ""

    def test_handles_missing_send_key_generates_new_uuid(self) -> None:
        user_id = str(uuid4())
        task = QueuedTask(
            task_type="welcome_email_send",
            payload={
                "user_id": user_id,
                "user_email": "eve@example.com",
                "first_name": "Eve",
                "trigger": "clerk_webhook",
            },
            created_at=datetime.now(UTC),
            attempts=0,
        )

        result = decode_welcome_email_task(task)

        assert result.send_key  # Should have a generated value
        assert len(result.send_key) == 32  # UUID hex is 32 chars

    def test_handles_empty_send_key_generates_new_uuid(self) -> None:
        user_id = str(uuid4())
        task = QueuedTask(
            task_type="welcome_email_send",
            payload={
                "user_id": user_id,
                "user_email": "frank@example.com",
                "first_name": "Frank",
                "send_key": "",
                "trigger": "clerk_webhook",
            },
            created_at=datetime.now(UTC),
            attempts=0,
        )

        result = decode_welcome_email_task(task)

        assert result.send_key  # Should have a generated value
        assert len(result.send_key) == 32

    def test_normalizes_trigger_to_lowercase(self) -> None:
        user_id = str(uuid4())
        task = QueuedTask(
            task_type="welcome_email_send",
            payload={
                "user_id": user_id,
                "user_email": "grace@example.com",
                "first_name": "Grace",
                "send_key": "key789",
                "trigger": "CLERK_WEBHOOK",
            },
            created_at=datetime.now(UTC),
            attempts=0,
        )

        result = decode_welcome_email_task(task)

        assert result.trigger == "clerk_webhook"

    def test_handles_missing_trigger_defaults_to_unknown(self) -> None:
        user_id = str(uuid4())
        task = QueuedTask(
            task_type="welcome_email_send",
            payload={
                "user_id": user_id,
                "user_email": "henry@example.com",
                "first_name": "Henry",
                "send_key": "key999",
            },
            created_at=datetime.now(UTC),
            attempts=0,
        )

        result = decode_welcome_email_task(task)

        assert result.trigger == "unknown"

    def test_wrong_task_type_raises_value_error(self) -> None:
        task = QueuedTask(
            task_type="wrong_type",
            payload={
                "user_id": str(uuid4()),
                "user_email": "ivan@example.com",
                "first_name": "Ivan",
                "send_key": "key111",
                "trigger": "clerk_webhook",
            },
            created_at=datetime.now(UTC),
            attempts=0,
        )

        with pytest.raises(ValueError) as exc_info:
            decode_welcome_email_task(task)

        assert "Unexpected task_type" in str(exc_info.value)
        assert "wrong_type" in str(exc_info.value)
        assert "welcome_email_send" in str(exc_info.value)

    def test_attempts_preserved_from_task(self) -> None:
        user_id = str(uuid4())
        task = QueuedTask(
            task_type="welcome_email_send",
            payload={
                "user_id": user_id,
                "user_email": "jack@example.com",
                "first_name": "Jack",
                "send_key": "key222",
                "trigger": "clerk_webhook",
                "attempts": 5,
            },
            created_at=datetime.now(UTC),
            attempts=5,
        )

        result = decode_welcome_email_task(task)

        assert result.attempts == 5

    def test_attempts_from_payload_overrides_task_attempts(self) -> None:
        user_id = str(uuid4())
        task = QueuedTask(
            task_type="welcome_email_send",
            payload={
                "user_id": user_id,
                "user_email": "karen@example.com",
                "first_name": "Karen",
                "send_key": "key333",
                "trigger": "clerk_webhook",
                "attempts": 3,
            },
            created_at=datetime.now(UTC),
            attempts=1,
        )

        result = decode_welcome_email_task(task)

        assert result.attempts == 3

    def test_coerces_numeric_values_to_strings(self) -> None:
        user_id = 12345
        task = QueuedTask(
            task_type="welcome_email_send",
            payload={
                "user_id": user_id,
                "user_email": "larry@example.com",
                "first_name": "Larry",
                "send_key": "key444",
                "trigger": "clerk_webhook",
            },
            created_at=datetime.now(UTC),
            attempts=0,
        )

        result = decode_welcome_email_task(task)

        assert result.user_id == "12345"
        assert isinstance(result.user_id, str)
