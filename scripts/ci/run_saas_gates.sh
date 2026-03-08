#!/usr/bin/env bash
set -euo pipefail

cd backend
uv run pytest \
  tests/core/test_auth_profiles.py \
  tests/api/test_agents_authz.py \
  tests/api/test_gateways_authz.py \
  tests/services/test_tenant_invariants.py \
  tests/core/test_rate_limit.py \
  tests/api/test_quota_enforcement.py \
  tests/api/test_readiness.py \
  tests/api/test_metrics_tenant_dimensions.py \
  tests/services/test_activity_audit_coverage.py \
  tests/integration/test_saas_gates.py
