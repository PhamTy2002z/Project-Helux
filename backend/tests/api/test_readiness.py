# ruff: noqa: INP001
"""Readiness endpoint behavior tests."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi.testclient import TestClient

from app.db.session import ReadinessComponentCheck
from app.main import app


def test_readyz_returns_200_when_required_dependencies_are_healthy(
    monkeypatch,
) -> None:
    async def _fake_evaluate_readiness() -> tuple[bool, list[ReadinessComponentCheck], datetime]:
        return (
            True,
            [
                ReadinessComponentCheck(component="database", ok=True, required=True, latency_ms=4),
                ReadinessComponentCheck(component="redis", ok=True, required=True, latency_ms=2),
                ReadinessComponentCheck(component="worker", ok=False, required=False, latency_ms=1),
            ],
            datetime(2026, 3, 8, 4, 0, tzinfo=UTC),
        )

    monkeypatch.setattr("app.main.evaluate_readiness", _fake_evaluate_readiness)

    with TestClient(app) as client:
        response = client.get("/readyz")

    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is True
    assert payload["components"][0]["component"] == "database"
    assert payload["components"][2]["required"] is False


def test_readyz_returns_503_when_required_dependency_fails(monkeypatch) -> None:
    async def _fake_evaluate_readiness() -> tuple[bool, list[ReadinessComponentCheck], datetime]:
        return (
            False,
            [
                ReadinessComponentCheck(
                    component="database", ok=False, required=True, detail="timeout>1.5s"
                ),
                ReadinessComponentCheck(component="redis", ok=True, required=True),
            ],
            datetime(2026, 3, 8, 4, 5, tzinfo=UTC),
        )

    monkeypatch.setattr("app.main.evaluate_readiness", _fake_evaluate_readiness)

    with TestClient(app) as client:
        response = client.get("/readyz")

    assert response.status_code == 503
    payload = response.json()
    assert payload["ok"] is False
    assert payload["components"][0]["detail"] == "timeout>1.5s"
