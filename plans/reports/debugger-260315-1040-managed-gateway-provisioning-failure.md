# Debug Report: Managed Gateway Auto-Provisioning Failure

**Date:** 2026-03-15
**Branch:** develop
**Severity:** High — new user onboarding completely broken

---

## Executive Summary

2 root causes. 1 primary blocker, 1 secondary issue.

**Primary (blocker):** OpenClaw container (`node` user, uid=1000) cannot create `/shared/openclaw-managed` because the `/shared` dir is owned by `root` with `755` perms. No shared named volume is mounted at that path — the directory doesn't exist at all inside the openclaw container.

**Secondary:** Early in the session, the backend's first connection attempt to openclaw failed with `pairing required` (1 occurrence at 03:31:10), because device pairing had not yet been approved. After pairing was approved (03:32:26), subsequent backend connections succeed at the gateway/RPC level. However, the `agents.create` RPC still fails due to the permission issue above.

---

## Timeline of Events

| Time (UTC) | Event |
|---|---|
| 03:03:34 | First user triggers gateway bootstrap for org `8cdd91fe` — provision enqueued |
| 03:31:10 | Backend (172.21.0.6) connects to openclaw: **2 conns** — 1st closes clean (code=1000), 2nd rejected `pairing required` (code=1008) |
| 03:31:10 | `gateway.onboarding.start_dispatch.failed` error=`pairing required` — boards onboarding → 502 |
| 03:32:26 | Device pairing manually approved (role=operator) |
| 03:37:19 | Second user triggers gateway bootstrap for org `56b8548b` — provision enqueued |
| 03:37:19 | `agents.create` RPC called → **EACCES: permission denied, mkdir '/shared/openclaw-managed'** |
| 03:37:30 | Same EACCES error on retry |
| 03:37:51 | Same EACCES error on retry |
| 03:38:14 | Board onboarding `GET` returns 404 (board session not yet created because agents.create failed) |
| 03:38:15 | `onboarding.start_dispatch.success` — dispatched to `agent:mc-gateway-e4377df3:main` (fallback to existing main agent) |
| 03:38:34 | Yet another EACCES on agents.create |

---

## Root Cause Analysis

### Issue 1 (Primary Blocker): Missing shared volume for `/shared/openclaw-managed`

**What happens:**
When provisioning fires, the backend tells openclaw to create a new managed agent. OpenClaw tries to `mkdir /shared/openclaw-managed` inside its container. This fails immediately:

```
Error: EACCES: permission denied, mkdir '/shared/openclaw-managed': code=EACCES
```

**Why:**
- `compose.yml` sets `MANAGED_GATEWAY_WORKSPACE_ROOT: /shared/openclaw-managed` for the **backend** container (line 144)
- But the openclaw container has NO volume or bind-mount at `/shared/openclaw-managed` — the path doesn't exist
- The `/shared` directory inside openclaw is owned by `root:root` with `755` perms
- The openclaw process runs as `node` (uid=1000) — cannot create subdirectories in `/shared`

**Confirmed:**
```
# Inside openclaw container:
drwxr-xr-x  3 root root 4096 Mar 15 03:14 /shared   ← root-owned, node cannot mkdir here
# /shared/openclaw-managed → does NOT exist
```

**Compare to backend:** Backend has `MANAGED_GATEWAY_WORKSPACE_ROOT: /shared/openclaw-managed` — the backend passes this path to openclaw via the `agents.create` RPC payload as the agent's workspace root. Openclaw then tries to create that directory locally, but the path doesn't exist and has wrong ownership.

**Fix needed:**
Add a named Docker volume (or bind-mount) at `/shared/openclaw-managed` in the openclaw service so the `node` user can write there. Example:

```yaml
# compose.yml - openclaw service volumes:
volumes:
  - openclaw_data:/data
  - device_identity:/shared/device-identity
  - openclaw_managed:/shared/openclaw-managed   # ADD THIS

# And in volumes section:
volumes:
  openclaw_managed:   # ADD THIS
```

---

### Issue 2 (Secondary): Device pairing required for backend connection

**What happens:**
At 03:31:10, backend's websocket connection to openclaw was rejected with `pairing required` (code=1008). This caused the onboarding start to return 502.

**Why:**
OpenClaw's device pairing gate blocked the backend's connection. The backend connects using `MANAGED_GATEWAY_TOKEN` (which IS set correctly: `5b65568376c384c5689b826cf425294d98cabeeef67e6ad0` matches openclaw's `gateway.auth.token`). However, the connection was rejected before token auth — it hit the **device pairing** gate first.

The backend's device identity (`/shared/device-identity/device.json`) was available (volume correctly mounted), but openclaw required an operator to manually approve the device pairing via the Control UI before it would accept the connection.

**Note:** This was a one-time issue that resolved after the operator approved pairing at 03:32:26. Subsequent backend connections at the WS level succeeded. BUT this means a fresh Docker environment will require manual pairing approval before the backend can communicate with openclaw at all.

**Relevant config:**
`compose.yml` line 96: `MANAGED_GATEWAY_DISABLE_DEVICE_PAIRING=false` — device pairing is ENABLED, and `MANAGED_GATEWAY_DISABLE_DEVICE_PAIRING` env var is passed to backend (`backend/.env`), not to openclaw. Check if openclaw config has `gateway.auth.devicePairing` settings.

---

### Issue 3 (Result): Board onboarding 404

**What happens:** `GET /api/v1/boards/{board_id}/onboarding` returns 404.

**Why:** This is a downstream effect of Issue 1. The onboarding record is only created after a board agent is successfully provisioned. Since `agents.create` fails (EACCES), no agent is created, no onboarding session is established, and the GET returns 404.

The log shows `onboarding.start_dispatch.success` at 03:38:14 (dispatched to `main` agent as fallback), but only after user re-tried and the existing `main` agent was used. However the board-specific onboarding session still returns 404 because the managed agent wasn't created.

---

## Evidence

```log
# Primary EACCES errors (openclaw logs):
2026-03-15T03:37:19 [gateway] request handler failed: Error: EACCES: permission denied, mkdir '/shared/openclaw-managed'
2026-03-15T03:37:19 [ws] ⇄ res ✗ agents.create 9ms errorCode=UNAVAILABLE
2026-03-15T03:37:30 [ws] ⇄ res ✗ agents.create 2ms errorCode=UNAVAILABLE
2026-03-15T03:37:51 [ws] ⇄ res ✗ agents.create 3ms errorCode=UNAVAILABLE
2026-03-15T03:38:34 [ws] ⇄ res ✗ agents.create 4ms errorCode=UNAVAILABLE

# Pairing gate (early session):
2026-03-15T03:31:10 [ws] closed before connect remote=172.21.0.6 ua=Python/3.12 code=1008 reason=pairing required

# Backend env (verified correct):
MANAGED_GATEWAY_TOKEN=5b65568376c384c5689b826cf425294d98cabeeef67e6ad0  ← matches openclaw config
MANAGED_GATEWAY_URL=ws://openclaw:18789/ws                               ← correct internal DNS
MANAGED_GATEWAY_WORKSPACE_ROOT=/shared/openclaw-managed                  ← path openclaw tries to create
MANAGED_GATEWAY_AUTO_PROVISION=true

# /shared permissions inside openclaw:
drwxr-xr-x 3 root root 4096 Mar 15 03:14 /shared   ← node user cannot write here
```

---

## Recommended Fixes (Priority Order)

### Fix 1 (Critical): Add shared volume for openclaw-managed workspace

In `compose.yml`:

1. Add `openclaw_managed:/shared/openclaw-managed` to openclaw's `volumes:`
2. Add `openclaw_managed:` to the top-level `volumes:` section

This gives openclaw's `node` user write access to the managed workspace path.

### Fix 2 (Important): Disable device pairing for managed backend connection

Options:
- Set `MANAGED_GATEWAY_DISABLE_DEVICE_PAIRING=true` in `compose.yml` backend environment — verify the backend passes this to the openclaw provisioning call
- OR configure openclaw to auto-approve known device IDs (if openclaw supports that)

The current setup requires a human to manually approve device pairing via Control UI every time the device identity changes (e.g., fresh Docker volume). This breaks automated provisioning.

### Fix 3 (Verify): Confirm device-identity volume is pre-populated on fresh start

The `device_identity` volume at `/shared/device-identity/device.json` was present and correct in this session. Verify this is deterministic (e.g., seeded from a config file or persisted volume) so it survives restarts without re-pairing.

---

## What Works Correctly

- Token auth: `MANAGED_GATEWAY_TOKEN` in backend matches `gateway.auth.token` in openclaw config
- Network: backend can reach openclaw at `ws://openclaw:18789/ws` (Docker internal DNS works)
- `MANAGED_GATEWAY_AUTO_PROVISION=true` is correctly set
- `BASE_URL=http://localhost:8000` is set (not empty)
- After device pairing approved: backend WS connection to openclaw succeeds at RPC level

---

## Unresolved Questions

1. Does the backend pass `MANAGED_GATEWAY_DISABLE_DEVICE_PAIRING` as a flag to the openclaw `agents.create` call, or does it control backend-side behavior only? Need to trace `gateway_activation_worker.py` → `admin_service.assert_gateway_runtime_compatible` path.
2. Is device pairing state persisted across openclaw container restarts (via `openclaw_data` volume), or does it reset on every `docker compose down`?
3. After Fix 1 is applied, will openclaw be able to create subdirs under `/shared/openclaw-managed` with correct UID? Verify with `docker compose exec openclaw mkdir /shared/openclaw-managed/test && ls -la /shared/openclaw-managed/`.
