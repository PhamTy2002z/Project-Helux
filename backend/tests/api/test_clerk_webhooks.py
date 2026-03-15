# ruff: noqa: INP001, S101
"""Tests for Clerk webhook endpoint."""

from __future__ import annotations

from datetime import UTC, datetime
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.api.clerk_webhooks import router as clerk_webhooks_router
from app.core.auth_mode import AuthMode


def _build_test_app() -> FastAPI:
    app = FastAPI()
    app.include_router(clerk_webhooks_router)
    return app


class TestClerkWebhookEndpoint:
    """Tests for handle_clerk_webhook endpoint."""

    @pytest.mark.asyncio
    async def test_returns_200_when_auth_mode_is_not_clerk(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        from app.core import config

        monkeypatch.setattr(config.settings, "auth_mode", AuthMode.LOCAL)

        app = _build_test_app()
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            response = await client.post(
                "/webhooks/clerk",
                json={"type": "user.created", "data": {}},
                headers={
                    "svix-id": "test-id",
                    "svix-timestamp": "123456789",
                    "svix-signature": "test-sig",
                },
            )

        assert response.status_code == 200
        assert response.json()["status"] == "ignored"
        assert "auth_mode_not_clerk" in response.json().get("reason", "")

    @pytest.mark.asyncio
    async def test_returns_200_with_ignored_when_no_secret_configured(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        from app.core import config

        monkeypatch.setattr(config.settings, "auth_mode", AuthMode.CLERK)
        monkeypatch.setattr(config.settings, "clerk_webhook_secret", "")

        app = _build_test_app()
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            response = await client.post(
                "/webhooks/clerk",
                json={"type": "user.created", "data": {}},
                headers={
                    "svix-id": "test-id",
                    "svix-timestamp": "123456789",
                    "svix-signature": "test-sig",
                },
            )

        assert response.status_code == 200
        assert response.json()["status"] == "ignored"
        assert "no_webhook_secret" in response.json().get("reason", "")

    @pytest.mark.asyncio
    async def test_returns_400_when_svix_signature_invalid(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        from app.core import config

        monkeypatch.setattr(config.settings, "auth_mode", AuthMode.CLERK)
        monkeypatch.setattr(config.settings, "clerk_webhook_secret", "test-secret")

        app = _build_test_app()
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            response = await client.post(
                "/webhooks/clerk",
                json={"type": "user.created", "data": {}},
                headers={
                    "svix-id": "test-id",
                    "svix-timestamp": "123456789",
                    "svix-signature": "invalid-signature",
                },
            )

        assert response.status_code == 400
        assert response.json()["error"] == "invalid_signature"

    @pytest.mark.asyncio
    async def test_returns_400_when_svix_headers_missing(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        from app.core import config

        monkeypatch.setattr(config.settings, "auth_mode", AuthMode.CLERK)
        monkeypatch.setattr(config.settings, "clerk_webhook_secret", "test-secret")

        app = _build_test_app()
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            response = await client.post(
                "/webhooks/clerk",
                json={"type": "user.created", "data": {}},
                headers={},
            )

        assert response.status_code == 400
        assert response.json()["error"] == "invalid_signature"

    @pytest.mark.asyncio
    async def test_calls_handler_for_user_created_event_with_valid_signature(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        from app.core import config

        monkeypatch.setattr(config.settings, "auth_mode", AuthMode.CLERK)

        secret = "test-secret-123"
        monkeypatch.setattr(config.settings, "clerk_webhook_secret", secret)

        # Track calls to _handle_user_created
        called_with_payload: list[dict] = []

        def mock_handle_user_created(payload: dict) -> None:  # type: ignore[type-arg]
            called_with_payload.append(payload)

        import app.api.clerk_webhooks as webhook_module

        monkeypatch.setattr(
            webhook_module,
            "_handle_user_created",
            mock_handle_user_created,
        )

        # Mock Svix webhook verification
        user_id = str(uuid4())
        payload = {
            "type": "user.created",
            "data": {
                "id": user_id,
                "first_name": "Alice",
                "primary_email_address_id": "email_123",
                "email_addresses": [
                    {
                        "id": "email_123",
                        "email_address": "alice@example.com",
                    }
                ],
            },
        }

        import json

        payload_json = json.dumps(payload).encode("utf-8")

        def mock_webhook_verify(self: object, body: bytes, headers: dict) -> dict:  # type: ignore[no-untyped-def]
            return payload

        # Mock the Webhook class at the svix.webhooks module level
        import sys

        mock_webhook_instance = MagicMock()
        mock_webhook_instance.verify = mock_webhook_verify.__get__(mock_webhook_instance)

        mock_svix_webhooks = MagicMock()
        mock_svix_webhooks.Webhook = lambda secret: mock_webhook_instance
        sys.modules["svix.webhooks"] = mock_svix_webhooks

        app = _build_test_app()
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            response = await client.post(
                "/webhooks/clerk",
                content=payload_json,
                headers={
                    "svix-id": "test-id",
                    "svix-timestamp": "123456789",
                    "svix-signature": "test-sig",
                },
            )

        assert response.status_code == 200
        assert response.json()["status"] == "ok"
        assert len(called_with_payload) == 1
        assert called_with_payload[0] == payload

    @pytest.mark.asyncio
    async def test_ignores_non_user_created_events(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        from app.core import config

        monkeypatch.setattr(config.settings, "auth_mode", AuthMode.CLERK)

        secret = "test-secret-123"
        monkeypatch.setattr(config.settings, "clerk_webhook_secret", secret)

        # Track calls to _handle_user_created
        handler_calls: list[dict] = []

        def mock_handle_user_created(payload: dict) -> None:  # type: ignore[type-arg]
            handler_calls.append(payload)

        import app.api.clerk_webhooks as webhook_module

        monkeypatch.setattr(
            webhook_module,
            "_handle_user_created",
            mock_handle_user_created,
        )

        # Create an event with different type
        payload = {
            "type": "user.updated",
            "data": {
                "id": str(uuid4()),
                "first_name": "Bob",
                "email_addresses": [{"email_address": "bob@example.com"}],
            },
        }

        import json

        payload_json = json.dumps(payload).encode("utf-8")

        def mock_webhook_verify(self: object, body: bytes, headers: dict) -> dict:  # type: ignore[no-untyped-def]
            return payload

        # Mock the Webhook class at the svix.webhooks module level
        import sys

        mock_webhook_instance = MagicMock()
        mock_webhook_instance.verify = mock_webhook_verify.__get__(mock_webhook_instance)

        mock_svix_webhooks = MagicMock()
        mock_svix_webhooks.Webhook = lambda secret: mock_webhook_instance
        sys.modules["svix.webhooks"] = mock_svix_webhooks

        app = _build_test_app()
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            response = await client.post(
                "/webhooks/clerk",
                content=payload_json,
                headers={
                    "svix-id": "test-id",
                    "svix-timestamp": "123456789",
                    "svix-signature": "test-sig",
                },
            )

        assert response.status_code == 200
        assert response.json()["status"] == "ok"
        assert len(handler_calls) == 0  # Should not call handler for non-user.created
