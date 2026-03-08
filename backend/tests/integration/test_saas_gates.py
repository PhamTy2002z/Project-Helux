# ruff: noqa: INP001
"""SaaS hardening gate inventory and reliability sanity checks."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app

REQUIRED_GATE_TEST_FILES = [
    "backend/tests/core/test_auth_profiles.py",
    "backend/tests/api/test_agents_authz.py",
    "backend/tests/api/test_gateways_authz.py",
    "backend/tests/services/test_tenant_invariants.py",
    "backend/tests/core/test_rate_limit.py",
    "backend/tests/api/test_billing_simulated_checkout.py",
    "backend/tests/api/test_trial_expiry_blocking.py",
    "backend/tests/api/test_onboarding_progress.py",
    "backend/tests/api/test_quota_enforcement.py",
    "backend/tests/api/test_readiness.py",
    "backend/tests/api/test_metrics_tenant_dimensions.py",
    "backend/tests/services/test_activity_audit_coverage.py",
]


def test_required_saas_gate_test_files_exist() -> None:
    repo_root = Path(__file__).resolve().parents[3]
    missing = [path for path in REQUIRED_GATE_TEST_FILES if not (repo_root / path).exists()]
    assert missing == []


def test_readyz_gate_blocks_when_required_dependency_fails(monkeypatch) -> None:
    async def _failing_readiness() -> tuple[bool, list[object], datetime]:
        return False, [], datetime(2026, 3, 8, 8, 0, 0)

    monkeypatch.setattr("app.main.evaluate_readiness", _failing_readiness)
    with TestClient(app) as client:
        response = client.get("/readyz")

    assert response.status_code == 503
    assert response.json()["ok"] is False
