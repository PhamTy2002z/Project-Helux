# Brainstorm: Migrate OpenClaw from Native to Docker (Dev)

## Problem Statement

Currently openclaw gateway runs natively on macOS via launchd (`ai.openclaw.gateway`) from source at `/Users/typham/projects/openclaw`. Production uses Docker (`openclaw/gateway:latest` in `compose.prod.yml`). Goal: align dev with prod by running openclaw as Docker container locally.

## Current State Analysis

### Native OpenClaw Setup
- **Source**: `/Users/typham/projects/openclaw` (Node.js project, `dist/index.js`)
- **Daemon**: launchd plist at `~/Library/LaunchAgents/ai.openclaw.gateway.plist`
- **Version**: v2026.3.7 (plist comment), config says v2026.3.8
- **Port**: 18789 (localhost)
- **State dir**: `~/.openclaw/` (agents, devices, identity, memory, skills, openclaw.json, logs)
- **Token**: `OPENCLAW_GATEWAY_TOKEN` set in plist env vars
- **PID**: Running as process 92941

### Dev Compose (`compose.yml`)
- **No openclaw service** — backend connects to `ws://127.0.0.1:18789/ws` (host machine, native process)
- Backend env: `MANAGED_GATEWAY_URL=ws://127.0.0.1:18789/ws` (from `.env.example`)
- Shared volume: `device_identity` used by backend + webhook-worker

### Prod Compose (`compose.prod.yml`)
- **Has openclaw service**: `openclaw/gateway:latest`
- Backend connects to `ws://openclaw:18789/ws` (Docker internal DNS)
- Backend `depends_on: openclaw: condition: service_healthy`
- Volumes: `openclaw_data:/data`, `device_identity:/shared/device-identity`
- Env: `OPENCLAW_HOME=/data`, `OPENCLAW_GATEWAY_TOKEN=${MANAGED_GATEWAY_TOKEN:-}`

### Key Differences Dev vs Prod
| Aspect | Dev (current) | Prod |
|--------|--------------|------|
| OpenClaw source | Native launchd daemon | Docker container |
| Gateway URL | `ws://127.0.0.1:18789/ws` | `ws://openclaw:18789/ws` |
| State storage | `~/.openclaw/` | Docker volume `openclaw_data` |
| Network | Host network | Docker internal network |
| Backend dependency | No depends_on | `depends_on: openclaw` |

---

## Data/Configs to Preserve Before Removal

### CRITICAL — Must Backup
1. **`~/.openclaw/openclaw.json`** — Main config (model providers, custom providers, wizard state). Has custom provider `ccs` config pointing to `127.0.0.1:8317`
2. **`~/.openclaw/identity/`** — Device identity keypair. Losing this = re-pairing required
3. **`~/.openclaw/devices/`** — Registered device info
4. **`~/.openclaw/.env`** — If exists, may contain API keys (OPENAI, ANTHROPIC, etc.)
5. **`OPENCLAW_GATEWAY_TOKEN`** value from plist: `5b65568376c384c5689b826cf425294d98cabeeef67e6ad0`

### IMPORTANT — Preserve if Valuable
6. **`~/.openclaw/agents/`** — 49 agent definitions/configs
7. **`~/.openclaw/memory/`** — Agent memory data
8. **`~/.openclaw/skills/`** — Custom skills
9. **`~/.openclaw/exec-approvals.json`** — Execution approval rules

### LOW PRIORITY
10. **`~/.openclaw/logs/`** — Can regenerate
11. **`~/.openclaw/completions/`** — Cache, can regenerate
12. **`~/.openclaw/browser/`** — Browser integration state

---

## Approach: Add OpenClaw to Dev Compose

### Recommended Solution

Add openclaw service to `compose.yml` mirroring prod config, with dev-specific adjustments.

**Changes to `compose.yml`:**

1. Add `openclaw` service (copy from prod, adjust for dev)
2. Update backend `MANAGED_GATEWAY_URL` to `ws://openclaw:18789/ws`
3. Add `depends_on: openclaw` to backend service
4. Add `openclaw_data` volume
5. Optionally mount `~/.openclaw` data into container for config continuity

**Dev-specific considerations:**
- Mount host `~/.openclaw/openclaw.json` into container for model provider config access
- Or: pass API keys via env vars and let Docker container create fresh config
- Port mapping `127.0.0.1:18789:18789` still useful for direct dev access/debugging

### Docker Image Choice

**Option A: `openclaw/gateway:latest`** (same as prod)
- Pro: Exact parity with production
- Pro: No build step needed
- Con: Version may differ from what you tested with natively (v2026.3.7/8)

**Option B: `openclaw/gateway:<pinned-version>`**
- Pro: Version control, reproducible
- Con: Manual updates needed
- Recommendation: Pin to match prod, use `latest` only after testing

### State/Data Strategy

**Option A: Fresh start (Recommended)**
- Let Docker volume `openclaw_data` start empty
- Re-configure via env vars (`OPENCLAW_GATEWAY_TOKEN`, API keys)
- Device will need re-pairing (one-time)
- Cleanest approach, matches how prod works

**Option B: Migrate existing state**
- Mount `~/.openclaw/` as bind mount into container
- Pro: Keeps all agents, memory, config
- Con: Path differences may cause issues (`HOME` is `/data` in container vs `~` natively)
- Con: Deviates from prod setup

**Recommendation**: Option A (fresh start) for dev parity. Keep `~/.openclaw/` backup for reference.

---

## Migration Steps

### Phase 1: Backup & Prepare
1. Backup `~/.openclaw/` directory: `cp -r ~/.openclaw ~/.openclaw.backup.$(date +%Y%m%d)`
2. Note the gateway token from plist
3. Note any API keys from `~/.openclaw/.env` or `openclaw.json`

### Phase 2: Stop Native OpenClaw
1. `launchctl unload ~/Library/LaunchAgents/ai.openclaw.gateway.plist`
2. Verify stopped: `ps aux | grep openclaw`
3. Optionally remove plist: `rm ~/Library/LaunchAgents/ai.openclaw.gateway.plist`

### Phase 3: Update compose.yml
1. Add openclaw service block
2. Update backend `MANAGED_GATEWAY_URL` env var
3. Add `depends_on` for openclaw in backend + webhook-worker
4. Add `openclaw_data` to volumes section
5. Set `MANAGED_GATEWAY_TOKEN` in `.env` or backend `.env`

### Phase 4: Test
1. `docker compose up -d`
2. Verify openclaw health: `curl http://localhost:18789/healthz`
3. Verify backend can connect to gateway
4. Test agent provisioning workflow

### Phase 5: Cleanup (after confirmed working)
1. Remove native source: `rm -rf /Users/typham/projects/openclaw`
2. Keep `~/.openclaw.backup.*` for reference
3. Optionally clean `~/.openclaw/` if no longer needed

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Docker openclaw version mismatch | Backend incompatibility | Pin image version matching `GATEWAY_MIN_VERSION=2026.02.9` |
| Device identity loss | Re-pairing needed | Shared `device_identity` volume handles this; backup old identity |
| Custom model providers break | Agents can't use custom models | `127.0.0.1:8317` in container won't reach host; use `host.docker.internal:8317` |
| API keys not passed | Gateway can't call LLM providers | Pass all keys via env vars in compose |
| Port conflict | If native still running on 18789 | Stop launchd first |
| `~/.openclaw/managed` workspace path | Backend expects managed workspace | Prod uses `MANAGED_GATEWAY_WORKSPACE_ROOT=/shared/openclaw-managed` |

### Custom Provider URL Issue (IMPORTANT)
The `openclaw.json` has a custom provider pointing to `http://127.0.0.1:8317/api/provider/codex`. Inside Docker, `127.0.0.1` refers to the container itself, not the host. Must change to `http://host.docker.internal:8317` if that provider service runs on host.

---

## Unresolved Questions

1. **API keys**: Where are the model provider API keys currently stored? In `~/.openclaw/.env`, in `openclaw.json` env block, or in shell profile? Need to ensure they're passed to Docker container.
2. **Custom provider at port 8317**: Is this service (codex) also being Dockerized, or does it stay on host? Affects URL configuration.
3. **Bridge port 18790**: Prod compose doesn't expose it. Does dev need the bridge port?
4. **Agent data migration**: Are the 49 agents in `~/.openclaw/agents/` important to preserve, or are they auto-provisioned by Helux backend?
5. **Version pinning**: Should we pin `openclaw/gateway:2026.3.8` or use `latest`?
