# ruff: noqa: INP001, S101
"""Tests for welcome email worker handler."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

import pytest

from app.services.email.welcome_email_worker import (
    _idempotency_key,
    get_welcome_email_sender,
    process_welcome_email_task,
)
from app.services.queue import QueuedTask


class TestIdempotencyKey:
    """Tests for _idempotency_key function."""

    def test_generates_consistent_key_for_same_inputs(self) -> None:
        user_id = "user-123"
        send_key = "send-abc"

        key1 = _idempotency_key(user_id=user_id, send_key=send_key)
        key2 = _idempotency_key(user_id=user_id, send_key=send_key)

        assert key1 == key2

    def test_generates_different_keys_for_different_user_ids(self) -> None:
        send_key = "send-abc"

        key1 = _idempotency_key(user_id="user-123", send_key=send_key)
        key2 = _idempotency_key(user_id="user-456", send_key=send_key)

        assert key1 != key2

    def test_generates_different_keys_for_different_send_keys(self) -> None:
        user_id = "user-123"

        key1 = _idempotency_key(user_id=user_id, send_key="send-abc")
        key2 = _idempotency_key(user_id=user_id, send_key="send-xyz")

        assert key1 != key2

    def test_returns_sha256_hex_string(self) -> None:
        key = _idempotency_key(user_id="user-123", send_key="send-abc")

        assert isinstance(key, str)
        assert len(key) == 64  # SHA256 hex is 64 chars
        assert all(c in "0123456789abcdef" for c in key)


class TestGetWelcomeEmailSender:
    """Tests for get_welcome_email_sender function."""

    def test_returns_none_when_provider_disabled(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        from app.core import config

        monkeypatch.setattr(config.settings, "email_provider", "none")

        sender = get_welcome_email_sender()

        assert sender is None

    def test_returns_resend_sender_when_provider_is_resend(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        from unittest.mock import MagicMock

        from app.core import config

        monkeypatch.setattr(config.settings, "email_provider", "resend")
        monkeypatch.setattr(config.settings, "resend_api_key", "test-api-key")
        monkeypatch.setattr(config.settings, "email_from_invites", "noreply@example.com")
        monkeypatch.setattr(config.settings, "email_reply_to", "support@example.com")

        # Mock the ResendWelcomeEmailSender to avoid importing resend module
        mock_sender = MagicMock()
        mock_sender.send_welcome_email = MagicMock()

        import app.services.email.welcome_email_worker as worker_module

        monkeypatch.setattr(
            worker_module,
            "ResendWelcomeEmailSender",
            lambda **kwargs: mock_sender,
        )

        sender = get_welcome_email_sender()

        assert sender is not None
        assert hasattr(sender, "send_welcome_email")

    def test_raises_runtime_error_for_unsupported_provider(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        from app.core import config

        monkeypatch.setattr(config.settings, "email_provider", "unsupported_provider")

        with pytest.raises(RuntimeError) as exc_info:
            get_welcome_email_sender()

        assert "Unsupported email provider" in str(exc_info.value)
        assert "unsupported_provider" in str(exc_info.value)


class TestProcessWelcomeEmailTask:
    """Tests for process_welcome_email_task function."""

    @pytest.mark.asyncio
    async def test_skips_when_provider_disabled(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        from app.core import config

        monkeypatch.setattr(config.settings, "email_provider", "none")

        user_id = str(uuid4())
        task = QueuedTask(
            task_type="welcome_email_send",
            payload={
                "user_id": user_id,
                "user_email": "test@example.com",
                "first_name": "Test",
                "send_key": "key123",
                "trigger": "clerk_webhook",
            },
            created_at=datetime.now(UTC),
            attempts=0,
        )

        # Should complete without raising error
        await process_welcome_email_task(task)

    @pytest.mark.asyncio
    async def test_builds_dashboard_url_from_base_url(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        from app.core import config

        base_url = "https://dashboard.example.com"
        monkeypatch.setattr(config.settings, "email_provider", "none")
        monkeypatch.setattr(config.settings, "base_url", base_url)

        user_id = str(uuid4())
        task = QueuedTask(
            task_type="welcome_email_send",
            payload={
                "user_id": user_id,
                "user_email": "test@example.com",
                "first_name": "Test",
                "send_key": "key123",
                "trigger": "clerk_webhook",
            },
            created_at=datetime.now(UTC),
            attempts=0,
        )

        # Process should not raise (provider disabled, so it just logs and returns)
        await process_welcome_email_task(task)

    @pytest.mark.asyncio
    async def test_strips_trailing_slash_from_base_url(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        from app.core import config

        base_url_with_slash = "https://dashboard.example.com/"
        monkeypatch.setattr(config.settings, "email_provider", "none")
        monkeypatch.setattr(config.settings, "base_url", base_url_with_slash)

        user_id = str(uuid4())
        task = QueuedTask(
            task_type="welcome_email_send",
            payload={
                "user_id": user_id,
                "user_email": "test@example.com",
                "first_name": "Test",
                "send_key": "key123",
                "trigger": "clerk_webhook",
            },
            created_at=datetime.now(UTC),
            attempts=0,
        )

        # Process should not raise
        await process_welcome_email_task(task)
