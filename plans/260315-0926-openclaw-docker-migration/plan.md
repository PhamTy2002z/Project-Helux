---
title: "Migrate OpenClaw from Native to Docker (Dev)"
description: "Replace native launchd OpenClaw gateway with Docker container in compose.yml to match prod setup"
status: pending
priority: P1
effort: 1h
branch: develop
tags: [infrastructure, docker, openclaw, dev-parity]
created: 2026-03-15
---

# Migrate OpenClaw from Native to Docker (Dev)

## Context

- Native openclaw runs via launchd from `/Users/typham/projects/openclaw` on port 18789
- Prod `compose.prod.yml` already has `openclaw/gateway:latest` service
- Dev `compose.yml` has NO openclaw service — backend connects to host gateway via `ws://host.docker.internal:18789/ws`
- cliproxy runs on HOST port 8317 — Docker openclaw must reach it via `host.docker.internal`
- Fresh start approach: new volume, re-pair device, skip 49 agent migration

## Phase Overview

| # | Phase | Status | Effort |
|---|-------|--------|--------|
| 1 | [Backup & stop native](#phase-1-backup--stop-native) | pending | 5m |
| 2 | [Update compose.yml](#phase-2-update-composeyml) | pending | 20m |
| 3 | [Update env files](#phase-3-update-env-files) | pending | 10m |
| 4 | [Test & verify](#phase-4-test--verify) | pending | 15m |
| 5 | [Cleanup](#phase-5-cleanup) | pending | 5m |

---

## Phase 1: Backup & Stop Native

**Manual steps (user executes):**

```bash
# 1. Backup existing openclaw data
cp -r ~/.openclaw ~/.openclaw.backup

# 2. Stop and unload launchd service
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/ai.openclaw.gateway.plist

# 3. Verify stopped
ps aux | grep openclaw

# 4. Remove plist to prevent auto-start on reboot
rm ~/Library/LaunchAgents/ai.openclaw.gateway.plist
```

- [ ] Backup ~/.openclaw/
- [ ] Stop launchd service
- [ ] Remove plist

---

## Phase 2: Update compose.yml

Add `openclaw` service between minio and backend. Adapt from `compose.prod.yml` with dev adjustments.

### Service block to add (after minio, before backend):

```yaml
  # ---------- openclaw gateway ----------
  openclaw:
    image: openclaw/gateway:latest
    <<: *default-restart
    logging: *default-logging
    environment:
      OPENCLAW_HOME: /data
      OPENCLAW_GATEWAY_TOKEN: ${MANAGED_GATEWAY_TOKEN:-}
    volumes:
      - openclaw_data:/data
      - device_identity:/shared/device-identity
    ports:
      - "127.0.0.1:18789:18789"
    networks:
      - internal
    healthcheck:
      test: ["CMD-SHELL", "curl -sf http://localhost:18789/healthz || exit 1"]
      interval: 15s
      timeout: 5s
      retries: 5
      start_period: 30s
    deploy:
      resources:
        limits:
          memory: 1G
```

### Modify backend service:

1. Add env override for gateway URL:
   ```yaml
   MANAGED_GATEWAY_URL: ws://openclaw:18789/ws
   MANAGED_GATEWAY_TOKEN: ${MANAGED_GATEWAY_TOKEN:-}
   MANAGED_GATEWAY_WORKSPACE_ROOT: /shared/openclaw-managed
   ```
2. Add `depends_on`:
   ```yaml
   depends_on:
     openclaw:
       condition: service_healthy
     # ... existing deps
   ```

### Modify webhook-worker service:

1. Add env vars:
   ```yaml
   MANAGED_GATEWAY_URL: ws://openclaw:18789/ws
   MANAGED_GATEWAY_TOKEN: ${MANAGED_GATEWAY_TOKEN:-}
   ```
2. Add `depends_on`:
   ```yaml
   depends_on:
     openclaw:
       condition: service_healthy
     # ... existing deps
   ```

### Add volume:

```yaml
volumes:
  # ... existing
  openclaw_data:
```

### Files to modify:
- `compose.yml` — add openclaw service, update backend + webhook-worker, add volume

- [ ] Add openclaw service block
- [ ] Add MANAGED_GATEWAY_URL + MANAGED_GATEWAY_TOKEN to backend environment
- [ ] Add depends_on openclaw to backend
- [ ] Add MANAGED_GATEWAY_URL + MANAGED_GATEWAY_TOKEN to webhook-worker environment
- [ ] Add depends_on openclaw to webhook-worker
- [ ] Add openclaw_data volume

---

## Phase 3: Update Env Files

### backend/.env

Current `MANAGED_GATEWAY_URL=ws://host.docker.internal:18789/ws` — this was pointing to native host gateway. Now compose.yml overrides it with `ws://openclaw:18789/ws` via environment block, so **no change needed** in .env file (compose environment takes precedence).

However, `MANAGED_GATEWAY_WORKSPACE_ROOT=/Users/typham/.openclaw/workspaces/managed` is a host path that won't work in container. The compose.yml environment override to `/shared/openclaw-managed` fixes this.

### Root .env

Current values are fine. `MANAGED_GATEWAY_TOKEN` already set. No changes needed.

### .env.example (root)

Update comment to reflect Docker setup:
```
MANAGED_GATEWAY_URL=ws://openclaw:18789/ws  # Docker internal (overridden in compose.yml)
```

### backend/.env.example

Update default URL and workspace root:
```
MANAGED_GATEWAY_URL=ws://openclaw:18789/ws
MANAGED_GATEWAY_WORKSPACE_ROOT=/shared/openclaw-managed
```

### cliproxy / custom provider note

If openclaw config inside Docker needs to reach cliproxy on host:8317, that's an openclaw-internal config (openclaw.json). Since we're doing fresh start, user will need to re-configure custom provider URL as `http://host.docker.internal:8317/api/provider/codex` via openclaw UI/API after container starts.

- [ ] Update backend/.env.example default gateway URL
- [ ] Update root .env.example default gateway URL
- [ ] Document cliproxy config note

---

## Phase 4: Test & Verify

```bash
# 1. Bring up stack
docker compose up -d

# 2. Check openclaw health
docker compose logs openclaw
curl http://localhost:18789/healthz

# 3. Check backend connects to gateway
docker compose logs backend | grep -i gateway

# 4. Re-pair device via openclaw UI/CLI (one-time)
# Access openclaw at http://localhost:18789

# 5. Configure custom provider (cliproxy)
# In openclaw config, set provider URL to http://host.docker.internal:8317/api/provider/codex

# 6. Test end-to-end: trigger agent from Helux UI
```

- [ ] docker compose up succeeds
- [ ] openclaw healthcheck passes
- [ ] Backend connects to gateway via ws://openclaw:18789/ws
- [ ] Device paired
- [ ] Custom provider (cliproxy) configured with host.docker.internal
- [ ] End-to-end agent invocation works

---

## Phase 5: Cleanup

**Manual steps (user executes after confirming everything works):**

```bash
# 1. Remove native openclaw source
rm -rf /Users/typham/projects/openclaw

# 2. Keep backup for reference (optional, remove later)
# ~/.openclaw.backup stays until user is confident

# 3. Optionally remove native state
# rm -rf ~/.openclaw  (only after backup confirmed)
```

- [ ] Remove /Users/typham/projects/openclaw
- [ ] Commit compose.yml + .env.example changes

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Port 18789 conflict if native not stopped | Phase 1 ensures launchd stopped first |
| cliproxy unreachable from Docker | Use `host.docker.internal:8317` — works on Docker Desktop for Mac |
| Device identity mismatch | Fresh `device_identity` volume shared between openclaw + backend |
| Gateway token mismatch | Same `MANAGED_GATEWAY_TOKEN` env var used by both openclaw + backend |

## Security Note

- `MANAGED_GATEWAY_TOKEN` already in `.env` (gitignored) — no new secrets to manage
- Port 18789 bound to 127.0.0.1 only — not exposed externally
