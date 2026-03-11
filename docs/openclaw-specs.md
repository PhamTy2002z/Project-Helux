# OpenClaw — Comprehensive Specification

> Source: https://docs.openclaw.ai | Crawled: 2026-03-11
> Full doc index: https://docs.openclaw.ai/llms.txt

---

## 1. Overview

OpenClaw = **AI personal assistant gateway** that unifies messaging channels (WhatsApp, Telegram, Discord, Slack, Signal, iMessage, MS Teams, IRC, Line, Zalo, Matrix, etc.) through a single long-lived daemon. Supports multi-agent routing, browser automation, voice/camera nodes, memory management, and scheduled automation.

**Prerequisites:** Node 22+

**Install:**
```bash
# macOS/Linux
curl -fsSL https://openclaw.ai/install.sh | bash
# Windows
iwr -useb https://openclaw.ai/install.ps1 | iex
```

**Core Commands:**
```bash
openclaw onboard --install-daemon   # Setup wizard
openclaw gateway status             # Check service
openclaw dashboard                  # Web UI at http://127.0.0.1:18789/
openclaw message send --target +15555550123 --message "Hello"
```

**Environment Variables:**
- `OPENCLAW_HOME` — home directory
- `OPENCLAW_STATE_DIR` — state directory override
- `OPENCLAW_CONFIG_PATH` — config file override

---

## 2. Architecture

### Core Components

```
┌─────────────────────────────────────────────────────┐
│                    Gateway Daemon                     │
│  (WebSocket + HTTP on port 18789)                    │
│                                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ Channels │  │  Agents  │  │  Tools & Skills   │   │
│  │ WA/TG/DC │  │ Runtime  │  │  exec/browser/web │   │
│  └──────────┘  └──────────┘  └──────────────────┘   │
│                                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ Sessions │  │  Memory  │  │  Automation       │   │
│  │ JSONL    │  │ MD+Vector│  │  cron/hooks/webhook│   │
│  └──────────┘  └──────────┘  └──────────────────┘   │
└───────┬───────────────┬───────────────┬──────────────┘
        │               │               │
   ┌────▼────┐    ┌─────▼─────┐   ┌─────▼─────┐
   │ Clients │    │   Nodes   │   │  HTTP API  │
   │ CLI/Web │    │ iOS/macOS │   │ /v1/chat   │
   │ macOS   │    │ Android   │   │ /v1/resp   │
   └─────────┘    └───────────┘   └───────────┘
```

**Gateway** — single long-lived daemon, owns all messaging surfaces.
- WebSocket API (typed JSON frames) + HTTP API on same port
- JSON Schema validation on all frames
- Domain events: agent, chat, presence, health, heartbeat, cron

**Clients** (CLI, web UI, macOS app) — connect via WebSocket to `127.0.0.1:18789`

**Nodes** (iOS/Android/macOS/headless) — connect as `role: node` with device capabilities (canvas, camera, screen recording, location)

**Remote Access** — Tailscale (preferred), SSH tunnel, or VPN

---

## 3. Gateway Protocol (WebSocket)

### Handshake

1. Server sends challenge: `{type:"event", event:"connect.challenge", payload:{nonce, ts}}`
2. Client responds: `{type:"req", id, method:"connect", params:{...}}`
   - `minProtocol`/`maxProtocol` — version negotiation
   - `role` — `"operator"` or `"node"`
   - `scopes` — permission array (`operator.read`, `operator.write`, `operator.admin`)
   - `auth.token` — authentication credential
   - `device` — fingerprint + cryptographic signature
3. Server response: `{type:"res", id, ok:true, payload:{type:"hello-ok", protocol, policy}}`

### Frame Types

| Type | Structure | Purpose |
|------|-----------|---------|
| Request | `{type:"req", id, method, params}` | Client → Server action |
| Response | `{type:"res", id, ok, payload\|error}` | Server → Client reply |
| Event | `{type:"event", event, payload, seq?, stateVersion?}` | Async broadcast |

### Security
- Token auth via `OPENCLAW_GATEWAY_TOKEN`
- Challenge-response signing with nonce + device metadata
- Idempotency keys required for side-effecting operations
- Device tokens for persistent trust

---

## 4. HTTP APIs

### 4.1 Chat Completions API

**Endpoint:** `POST /v1/chat/completions`

**Auth:** `Authorization: Bearer <token>` (gateway token or password)

**Agent Selection:**
- Model field: `"openclaw:<agentId>"` or `"agent:<agentId>"`
- Header: `x-openclaw-agent-id: <agentId>` (default: `main`)
- Session: `x-openclaw-session-key: <sessionKey>`

**Streaming:** `stream: true` → SSE (`text/event-stream`), ends with `data: [DONE]`

**Session:** Stateless by default. Use `user` field for persistent sessions.

**Enable:** `gateway.http.endpoints.chatCompletions.enabled: true`

### 4.2 OpenResponses API

**Endpoint:** `POST /v1/responses`

Compatible with OpenResponses spec. Key differences from chat completions:
- Item-based architecture (mixed content types)
- Turn-based tool calling with `function_call_output` responses
- Built-in SSE streaming
- Media support: images (base64/URL, 10MB max), files (text/md/html/csv/json/pdf, 5MB max)

### 4.3 Tools Invoke API

**Endpoint:** `POST /tools/invoke`

```bash
curl -sS http://127.0.0.1:18789/tools/invoke \
  -H 'Authorization: Bearer TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"tool": "sessions_list", "action": "json", "args": {}}'
```

**Request fields:** `tool` (required), `action`, `args`, `sessionKey`, `dryRun`
**Default deny:** `sessions_spawn`, `sessions_send`, `gateway`, `whatsapp_login`
**Max payload:** 2MB

### 4.4 Webhooks

**Enable:**
```json5
{
  hooks: {
    enabled: true,
    token: "shared-secret",
    path: "/hooks",
    allowedAgentIds: ["hooks", "main"],
  }
}
```

**Auth:** `Authorization: Bearer <token>` or `x-openclaw-token: <token>`

**Endpoints:**
- `POST /hooks/wake` — enqueue system event (`text`, `mode: "now"|"next-heartbeat"`)
- `POST /hooks/agent` — run isolated agent turn (`message`, `agentId`, `sessionKey`, `deliver`, `channel`, `to`, `model`, `thinking`)
- `POST /hooks/<name>` — custom mapped endpoints

---

## 5. Configuration

**File:** `~/.openclaw/openclaw.json` (JSON5)

### Minimal Config
```json5
{
  agents: { defaults: { workspace: "~/.openclaw/workspace" } },
  channels: { whatsapp: { allowFrom: ["+15555550123"] } },
}
```

### Key Sections

**Channels:** WhatsApp, Telegram, Discord, Slack, Signal, iMessage, etc.
- `enabled`, `dmPolicy` ("pairing"|"allowlist"|"open"|"disabled"), `allowFrom`

**Models:**
```json5
agents: {
  defaults: {
    model: {
      primary: "anthropic/claude-sonnet-4-5",
      fallbacks: ["openai/gpt-5.2"],
    }
  }
}
```
Format: `provider/model`. `imageMaxDimensionPx` defaults to 1200.

**Sessions:**
- `dmScope`: "main"|"per-peer"|"per-channel-peer"|"per-account-channel-peer"
- `reset`: daily (default 4AM) or idle-based (`idleMinutes`)

**Sandbox:**
```json5
sandbox: { mode: "non-main", scope: "agent" }
// mode: off | non-main | all
// scope: session | agent | shared
```

**Hot Reload:** `hybrid` (default) | `hot` | `restart` | `off`

**Env Vars:** Sourced from process env → `.env` → `~/.openclaw/.env`. Substitution: `${VAR_NAME}`

**Modular Config:** `$include` for splitting files, up to 10 nesting levels.

**Programmatic Updates (RPC):**
- `config.apply` — full replacement
- `config.patch` — partial merge (JSON merge patch)
- Rate limit: 3 req/60s per `deviceId+clientIp`

---

## 6. Agent Runtime

### Agent = Workspace + State + Sessions

```
~/.openclaw/openclaw.json                    # config
~/.openclaw/agents/<agentId>/agent           # state (auth profiles, model registry)
~/.openclaw/agents/<agentId>/sessions        # chat history (JSONL)
~/.openclaw/workspace-<agentId>              # workspace
```

Default single-agent: `agentId = "main"`

### Bootstrap Files (injected into context on first session turn)
- **AGENTS.md** — operating instructions, memory
- **SOUL.md** — persona, boundaries, tone
- **TOOLS.md** — user tool guidance
- **BOOTSTRAP.md** — one-time setup (auto-deleted after)
- **IDENTITY.md** — agent name, emoji
- **USER.md** — user profile preferences
- **MEMORY.md** — curated durable info
- **HEARTBEAT.md** — heartbeat behavior

Constraints: per-file max 20K chars, total max 150K chars.

### System Prompt Assembly Order
1. Tooling → 2. Safety → 3. Skills → 4. Self-Update → 5. Workspace → 6. Documentation → 7. Workspace Files → 8. Sandbox → 9. Date/Time → 10. Reply Tags → 11. Heartbeats → 12. Runtime → 13. Reasoning

**Prompt modes:** `full` (default), `minimal` (sub-agents), `none` (identity only)

### Tools
Core: `read`, `exec`, `edit`, `write` (always available)
Optional: `apply_patch` (config-gated)

**Tool Profiles:** `minimal` | `coding` | `messaging` | `full`

**Tool Groups:**
- `group:runtime` → exec, bash, process
- `group:fs` → read, write, edit, apply_patch
- `group:sessions` → session management
- `group:web` → web search/fetch
- `group:ui` → browser, canvas
- `group:automation` → cron, gateway
- `group:messaging` → message sending

---

## 7. Multi-Agent Routing

### Bindings (deterministic routing)

```json5
bindings: [
  { agentId: "home", match: { channel: "whatsapp", accountId: "personal" } },
  { agentId: "work", match: { channel: "whatsapp", accountId: "biz" } },
  { agentId: "alex", match: { channel: "whatsapp", peer: { kind: "direct", id: "+15551230001" } } },
]
```

**Matching hierarchy:**
1. Exact peer match (DM/group/channel ID)
2. Parent peer match (thread inheritance)
3. Discord role + guild ID
4. Discord guild ID only
5. Slack team ID
6. Account ID match
7. Channel-level fallback (`accountId: "*"`)
8. Default agent

First match in same tier wins (config order).

### Per-Agent Sandboxing
```json5
agents: {
  list: [
    {
      id: "family",
      sandbox: { mode: "all", scope: "agent" },
      tools: { allow: ["read"], deny: ["exec", "write"] }
    }
  ]
}
```

### Agent-to-Agent Communication
Off by default. Must be explicitly enabled + allowlisted via `tools.agentToAgent`.

### CLI
```bash
openclaw agents add <name>
openclaw agents list --bindings
```

---

## 8. Session Management

### Session Keys
- Direct: `agent:<agentId>:dm:<peerId>` (varies by dmScope)
- Groups: `agent:<agentId>:<channel>:group:<id>`
- Cron: `cron:<job.id>`
- Webhooks: `hook:<uuid>`

### Storage
```
~/.openclaw/agents/<agentId>/sessions/sessions.json   # session map
~/.openclaw/agents/<agentId>/sessions/<sessionId>.jsonl  # transcripts
```

### Reset Policy
- **Daily:** default 4AM local time
- **Idle:** configurable `idleMinutes` (sliding window)
- Whichever expires first triggers reset
- Manual: `/new` or `/reset`

### Maintenance
- Default mode: `warn` (no mutation)
- Pruning: 30 days, max 500 entries
- Rotation: 10MB threshold
- Archive + purge pipeline

---

## 9. Memory System

### Two Layers
1. **Daily logs** (`memory/YYYY-MM-DD.md`) — append-only, loaded at session start
2. **Long-term** (`MEMORY.md`) — curated, durable, private sessions only

### Memory Tools
- `memory_search` — semantic recall via vector embeddings
- `memory_get` — targeted file/line retrieval

### Search Engine
- **Hybrid:** BM25 (keyword) + Vector (semantic)
- **MMR:** reduces redundant results (lambda 0.7)
- **Temporal decay:** exponential score decay (half-life 30 days)
- **Embedding providers:** local → OpenAI → Gemini → Voyage → Mistral (auto-fallback)
- **Storage:** per-agent SQLite with sqlite-vec acceleration

### Auto Memory Flush
Activates before context compaction — silent agentic turn to persist durable memories.

---

## 10. Sub-Agents

### Spawning
```
/subagents spawn <agentId> <task> [--model x] [--thinking x]
```
Non-blocking, returns `runId` immediately.

### Programmatic (via tools)
```json5
sessions_spawn: {
  runtime: "subagent" | "acp",
  mode: "run" | "session",
  // + task, model, thinking, attachments
}
```

### Communication
On completion → announces summary to parent chat channel.
Delivery: direct → queue routing → retried queue (exponential backoff).

### Nesting (Orchestrator Pattern)
`maxSpawnDepth: 2` enables 3-tier hierarchy:
- Depth 0: Main agent (always spawns)
- Depth 1: Orchestrator (spawns if depth ≥ 2)
- Depth 2: Workers (never spawn)

### Limits
- `maxConcurrent`: 8 (default)
- `maxChildrenPerAgent`: 5 (default)
- `maxSpawnDepth`: 1-5
- Auto-archive after configurable minutes

### Tool Policy
Sub-agents get all tools EXCEPT session tools by default. Depth-1 orchestrators gain session management when nesting enabled.

---

## 11. Automation

### Cron Jobs
Via config or CLI: `openclaw cron add/list/remove/run`
- `maxConcurrentRuns`, `sessionRetention`, `runLog`

### Heartbeat
Periodic check-ins: `every`, `target`, `directPolicy`

### Hooks (Webhooks)
See Section 4.4.

### Polling
Configurable polling intervals for external data sources.

---

## 12. Available Tools Summary

| Tool | Purpose |
|------|---------|
| `exec` | Run shell commands in workspace |
| `process` | Manage background sessions (list/poll/kill) |
| `read`/`write`/`edit` | File operations |
| `apply_patch` | Multi-file structured edits |
| `web_search` | Search via Perplexity/Brave/Gemini/Grok/Kimi |
| `web_fetch` | Fetch URL → markdown |
| `browser` | Full browser automation (tabs, screenshots, click, type, navigate, PDF) |
| `canvas` | Drive node Canvas (present, eval, snapshot) |
| `nodes` | Discover/target paired devices |
| `image` | Analyze images |
| `pdf` | Analyze PDFs |
| `message` | Send across all channels |
| `sessions_list/history/send/spawn/status` | Session management |
| `agents_list` | Enumerate agents |
| `cron` | Scheduled jobs |
| `gateway` | Restart/update gateway, config operations |
| `memory_search`/`memory_get` | Memory recall |
| `lobster` | Typed workflow runtime (plugin) |
| `llm_task` | JSON-only LLM step (plugin) |
| `diffs` | Diff viewer (plugin) |

---

## 13. Supported Channels

WhatsApp, Telegram, Discord, Slack, Signal, iMessage, Google Chat, Mattermost, MS Teams, IRC, LINE, Matrix, Nextcloud Talk, Nostr, Synology Chat, Tlon, Twitch, Zalo, Zalo Personal, BlueBubbles, Feishu, WebChat

---

## 14. Supported Model Providers

Anthropic (Claude), OpenAI, Amazon Bedrock, Cloudflare AI Gateway, Deepgram, GitHub Copilot, GLM, HuggingFace, Kilocode, LiteLLM, MiniMax, Mistral, Moonshot, NVIDIA, Ollama (local), OpenRouter, Qianfan, Qwen, Together, Venice, Vercel AI Gateway, vLLM, Xiaomi MiMo, Z.AI

---

## 15. Platforms

macOS (native app + bundled gateway), iOS, Android, Linux, Windows (WSL2), Raspberry Pi, Docker, Podman

**Deployment:** Fly.io, GCP, Railway, Render, Hetzner, DigitalOcean, Oracle, Northflank, Ansible, Nix

---

## 16. Security Model

- Gateway auth: token or password mode
- Device pairing with cryptographic signatures
- Challenge-response nonce signing
- Per-agent sandboxing (tool allow/deny)
- Idempotency keys for side-effects
- Rate limiting (429 + Retry-After)
- HTTP APIs: loopback/tailnet only (not public internet)
- Exec approvals for dangerous commands
- Tool-loop detection (generic repeat, poll no-progress, ping-pong)

---

## 17. Key Integration Patterns for Helux

### Pattern A: HTTP API Integration
```
Helux Backend → POST /v1/chat/completions → OpenClaw Gateway → Agent → Response
```
- Use `x-openclaw-agent-id` header for agent routing
- Use `user` field for persistent sessions
- Streaming via SSE

### Pattern B: Webhook Integration
```
External Event → POST /hooks/agent → OpenClaw → Process → Deliver to channel
```
- `message`, `agentId`, `deliver`, `channel`, `to`

### Pattern C: Tools Invoke
```
Helux Backend → POST /tools/invoke → Execute specific tool → Result
```
- Direct tool execution without agent context

### Pattern D: WebSocket Control
```
Helux Service → WebSocket 127.0.0.1:18789 → Full bidirectional control
```
- Real-time events, presence, device management

---

## References

- Full doc index: https://docs.openclaw.ai/llms.txt
- OpenAPI spec: https://docs.openclaw.ai/api-reference/openapi.json
- Config reference: https://docs.openclaw.ai/gateway/configuration-reference
- Protocol schema: `src/gateway/protocol/schema.ts`
