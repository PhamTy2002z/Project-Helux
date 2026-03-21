"""Persistent WebSocket listener that auto-approves exec approval requests.

OpenClaw agents require operator approval before executing tool calls (HTTP POST,
shell commands, etc.). In a SaaS context, there is no human operator sitting at
the control UI to click "approve". This module maintains a long-lived WebSocket
connection to the managed gateway and automatically resolves every incoming
``exec.approval.requested`` event with ``allow: true``.

The listener is started as a background asyncio task during app lifespan and
reconnects automatically on transient failures.
"""

from __future__ import annotations

import asyncio
import json
from typing import Any
from uuid import uuid4

import websockets
from websockets.exceptions import WebSocketException

from app.core.config import settings
from app.core.logging import get_logger
from app.services.openclaw.device_identity import (
    build_device_auth_payload,
    load_or_create_device_identity,
    public_key_raw_base64url_from_pem,
    sign_device_payload,
)
from app.services.openclaw.gateway_rpc import (
    GATEWAY_OPERATOR_SCOPES,
    PROTOCOL_VERSION,
    _prepare_localhost_connect,
)

logger = get_logger(__name__)

_RECONNECT_DELAYS = (1, 2, 5, 10, 30)
_LISTENER_CLIENT_ID = "gateway-client"
_LISTENER_CLIENT_MODE = "backend"

# Sentinel used to cancel the background task cleanly.
_shutdown_event: asyncio.Event | None = None
_listener_task: asyncio.Task[None] | None = None


def _gateway_url() -> str:
    """Return the managed gateway WebSocket URL from settings."""
    return settings.managed_gateway_url.strip()


def _gateway_token() -> str | None:
    """Return the managed gateway auth token from settings."""
    token = settings.managed_gateway_token.strip()
    return token or None


def _build_connect_params(*, connect_nonce: str | None = None) -> dict[str, Any]:
    """Build device-auth connect params for the approval listener."""
    role = "operator"
    scopes = list(GATEWAY_OPERATOR_SCOPES)
    identity = load_or_create_device_identity()
    from time import time

    signed_at_ms = int(time() * 1000)
    auth_token = _gateway_token()

    payload = build_device_auth_payload(
        device_id=identity.device_id,
        client_id=_LISTENER_CLIENT_ID,
        client_mode=_LISTENER_CLIENT_MODE,
        role=role,
        scopes=scopes,
        signed_at_ms=signed_at_ms,
        token=auth_token,
        nonce=connect_nonce,
    )

    device_payload: dict[str, Any] = {
        "id": identity.device_id,
        "publicKey": public_key_raw_base64url_from_pem(identity.public_key_pem),
        "signature": sign_device_payload(identity.private_key_pem, payload),
        "signedAt": signed_at_ms,
    }
    if connect_nonce:
        device_payload["nonce"] = connect_nonce

    params: dict[str, Any] = {
        "minProtocol": PROTOCOL_VERSION,
        "maxProtocol": PROTOCOL_VERSION,
        "role": role,
        "scopes": scopes,
        "client": {
            "id": _LISTENER_CLIENT_ID,
            "version": "1.0.0",
            "platform": "python",
            "mode": _LISTENER_CLIENT_MODE,
        },
        "device": device_payload,
    }
    if auth_token:
        params["auth"] = {"token": auth_token}
    return params


async def _handle_connect(ws: websockets.ClientConnection) -> None:
    """Perform the connect handshake, handling optional challenge-nonce."""
    connect_nonce: str | None = None
    try:
        first = await asyncio.wait_for(ws.recv(), timeout=3)
        data = json.loads(first)
        if data.get("type") == "event" and data.get("event") == "connect.challenge":
            nonce = (data.get("payload") or {}).get("nonce")
            if isinstance(nonce, str) and nonce.strip():
                connect_nonce = nonce.strip()
    except (TimeoutError, Exception):
        pass

    connect_id = str(uuid4())
    await ws.send(
        json.dumps(
            {
                "type": "req",
                "id": connect_id,
                "method": "connect",
                "params": _build_connect_params(connect_nonce=connect_nonce),
            }
        )
    )

    # Wait for connect response
    deadline = asyncio.get_running_loop().time() + 10
    while asyncio.get_running_loop().time() < deadline:
        raw = await asyncio.wait_for(ws.recv(), timeout=10)
        msg = json.loads(raw)
        if msg.get("type") == "res" and msg.get("id") == connect_id:
            if msg.get("ok") is False:
                error = (msg.get("error") or {}).get("message", "connect failed")
                raise ConnectionError(f"Gateway connect rejected: {error}")
            logger.info("exec_approval_listener.connected")
            return
    raise ConnectionError("Gateway connect response timed out")


async def _auto_resolve(
    ws: websockets.ClientConnection,
    approval_id: str,
) -> None:
    """Send exec.approval.resolve with allow=true for a pending approval."""
    resolve_id = str(uuid4())
    await ws.send(
        json.dumps(
            {
                "type": "req",
                "id": resolve_id,
                "method": "exec.approval.resolve",
                "params": {
                    "approvalId": approval_id,
                    "decision": "allow",
                },
            }
        )
    )
    logger.info(
        "exec_approval_listener.auto_resolved approval_id=%s",
        approval_id,
    )


async def _listen_loop(ws: websockets.ClientConnection) -> None:
    """Read messages and auto-resolve any exec approval requests."""
    async for raw in ws:
        try:
            msg = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            continue

        msg_type = msg.get("type")
        event = msg.get("event")

        # Auto-resolve exec approval requests
        if msg_type == "event" and event == "exec.approval.requested":
            payload = msg.get("payload") or {}
            approval_id = payload.get("approvalId") or payload.get("id")
            if approval_id:
                try:
                    await _auto_resolve(ws, approval_id)
                except Exception:
                    logger.warning(
                        "exec_approval_listener.resolve_failed approval_id=%s",
                        approval_id,
                        exc_info=True,
                    )


async def _run_listener() -> None:
    """Main loop: connect to gateway and listen, reconnecting on failure."""
    url = _gateway_url()
    if not url:
        logger.info("exec_approval_listener.disabled reason=no_gateway_url")
        return

    attempt = 0
    while not (_shutdown_event and _shutdown_event.is_set()):
        try:
            ws_url, sock_kwargs = _prepare_localhost_connect(url)
            token = _gateway_token()
            if token:
                from urllib.parse import urlencode, urlparse, urlunparse

                parsed = urlparse(ws_url)
                ws_url = str(urlunparse(parsed._replace(query=urlencode({"token": token}))))

            async with websockets.connect(
                ws_url,
                ping_interval=30,
                ping_timeout=10,
                open_timeout=10,
                **sock_kwargs,
            ) as ws:
                await _handle_connect(ws)
                attempt = 0  # Reset on successful connect
                await _listen_loop(ws)

        except asyncio.CancelledError:
            logger.info("exec_approval_listener.cancelled")
            return
        except (WebSocketException, ConnectionError, OSError, TimeoutError) as exc:
            delay = _RECONNECT_DELAYS[min(attempt, len(_RECONNECT_DELAYS) - 1)]
            logger.warning(
                "exec_approval_listener.reconnecting error=%s delay=%ds attempt=%d",
                exc,
                delay,
                attempt,
            )
            attempt += 1
            try:
                await asyncio.sleep(delay)
            except asyncio.CancelledError:
                return
        except Exception:
            logger.error("exec_approval_listener.unexpected_error", exc_info=True)
            try:
                await asyncio.sleep(5)
            except asyncio.CancelledError:
                return


def start_listener() -> asyncio.Task[None] | None:
    """Start the exec approval auto-approve listener as a background task.

    Safe to call multiple times; only one listener runs at a time.
    Returns the task or None if gateway URL is not configured.
    """
    global _shutdown_event, _listener_task  # noqa: PLW0603

    url = _gateway_url()
    if not url:
        return None

    if _listener_task and not _listener_task.done():
        return _listener_task

    _shutdown_event = asyncio.Event()
    _listener_task = asyncio.create_task(_run_listener(), name="exec-approval-listener")
    logger.info("exec_approval_listener.started gateway_url=%s", url.split("?")[0])
    return _listener_task


async def stop_listener() -> None:
    """Stop the exec approval listener gracefully."""
    global _listener_task, _shutdown_event  # noqa: PLW0603

    if _shutdown_event:
        _shutdown_event.set()
    if _listener_task and not _listener_task.done():
        _listener_task.cancel()
        try:
            await _listener_task
        except asyncio.CancelledError:
            pass
    _listener_task = None
    _shutdown_event = None
    logger.info("exec_approval_listener.stopped")
