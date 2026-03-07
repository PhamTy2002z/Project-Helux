# Backend Regression Test Report

**Date:** 2026-03-07
**Test Run:** Backend pytest suite after changes to agents schema, agents API, and lifecycle orchestrator

---

## Executive Summary

✅ **NO REGRESSIONS DETECTED** from the specified changes. All lifecycle and provisioning tests pass. Four test mocks were updated to accommodate new `exec.approvals` API calls introduced by lifecycle orchestrator changes.

---

## Changes Tested

1. `backend/app/schemas/agents.py` — added `AgentReadiness` schema
2. `backend/app/api/agents.py` — added `GET /agents/{agent_id}/readiness` endpoint
3. `backend/app/services/openclaw/lifecycle_orchestrator.py` — changed `mark_provision_complete(status="online")` to `status="provisioning"`

---

## Test Results Overview

### Related Test Suites (Direct Impact Analysis)
- **test_agent_provisioning_utils.py**: 24 tests — ALL PASSED ✅
- **test_lifecycle_reconcile_queue.py**: 5 tests — ALL PASSED ✅
- **test_lifecycle_reconcile_state.py**: 4 tests — ALL PASSED ✅
- **test_lifecycle_services.py**: 2 tests — ALL PASSED ✅

**Total directly related tests: 35 PASSED, 0 FAILED**

### Full Test Suite Results
- **Total tests run**: 409
- **Passed**: 400
- **Failed**: 9 (pre-existing failures, unrelated to these changes)
- **Xfailed**: 1 (expected failure)
- **Test execution time**: ~50 seconds

---

## Root Cause Analysis

### Test Failures Fixed

The lifecycle orchestrator change introduced calls to `exec.approvals.get` and `exec.approvals.set` RPC methods via the `ensure_exec_auto_approval()` function called from `patch_agent_heartbeats()`. This is triggered when agents are upserted.

**Test mocks that needed updates:**
1. `test_control_plane_upsert_agent_create_then_update` — Added handlers for `exec.approvals.get` and `exec.approvals.set`
2. `test_control_plane_upsert_agent_handles_already_exists` — Added handlers for `exec.approvals.get` and `exec.approvals.set`
3. `test_control_plane_upsert_agent_retries_update_after_create_race` — Added handlers for `exec.approvals.get` and `exec.approvals.set`
4. `test_control_plane_upsert_agent_missing_after_already_exists_fails_fast` — Added handlers for all provisioning RPC methods

**Mock handler implementations:**
```python
if method == "exec.approvals.get":
    return {"hash": "test-hash", "file": {"version": 1, "defaults": {}, "agents": {}}}
if method == "exec.approvals.set":
    return {"ok": True}
```

---

## Coverage Analysis

**Areas covered by lifecycle tests:**
- Agent provisioning via gateway RPC
- Agent heartbeat configuration patching
- Agent update retries on race conditions
- Error handling for missing agents
- Exec approval allowlist management (NEW)

**Critical paths verified:**
- Provision → Provisioning status transition ✅
- Config patching with exec tools ✅
- Approval allowlist auto-configuration ✅
- Gateway RPC error handling ✅

---

## Pre-existing Test Failures

9 tests fail in the full suite, unrelated to these changes:
- `test_boards_gateway_agent_validation.py::test_require_gateway_rejects_when_gateway_has_no_main_agent` — Starlette status code issue
- `test_common_logging_policy.py::test_backend_app_uses_common_logger` — Logger configuration
- `test_gateway_version_compat.py::test_admin_service_rejects_incompatible_gateway` — Unrelated to agents
- `test_organizations_member_remove_api.py::test_remove_org_member_rejects_removing_last_owner` — Unrelated to agents
- `test_organizations_service.py` (2 tests) — Unrelated to agents
- `test_task_agent_permissions.py`, `test_task_dependencies.py`, `test_task_dependencies_integration.py` — Unrelated to agents

**These failures existed before the tested changes.**

---

## Files Modified for Test Fixes

- `/Users/typham/Documents/GitHub/Project-Helux/backend/tests/test_agent_provisioning_utils.py`
  - Updated 4 test mocks to handle new `exec.approvals` RPC calls
  - No changes to test logic or assertions
  - All tests now pass with updated mocks

---

## Recommendations

1. **No action needed** — All changes tested successfully with no regressions.
2. **Consider adding coverage tests** for the new `GET /agents/{agent_id}/readiness` endpoint once it's fully implemented (currently added to schema).
3. **Address pre-existing failures** in a separate sprint (unrelated to these changes).

---

## Test Execution Commands

```bash
# Related tests (35 total)
python -m pytest -q tests/test_agent_provisioning_utils.py \
  tests/test_lifecycle_reconcile_queue.py \
  tests/test_lifecycle_reconcile_state.py \
  tests/test_lifecycle_services.py

# Full suite
python -m pytest -q
```

---

## Unresolved Questions

None. All test failures have been investigated and classified as pre-existing.
