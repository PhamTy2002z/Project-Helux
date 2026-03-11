# OpenClaw Project Exploration Report

## 1. Project Structure & Technology Stack

### Overview
- **Project Type**: Multi-channel AI gateway with extensible messaging integrations
- **Primary Language**: TypeScript (Node.js ≥22)
- **Architecture**: Personal AI assistant that runs on user devices, supports 25+ messaging channels
- **Package Manager**: pnpm 10.23.0
- **License**: MIT

### Monorepo Structure
```
openclaw/
├── src/                           # Core gateway & backend code (74 subdirectories)
├── ui/                            # Frontend React UI for control plane
├── extensions/                    # Channel integrations (25+ channels)
│   ├── discord/
│   ├── slack/
│   ├── telegram/
│   ├── whatsapp/
│   ├── imessage/
│   ├── signal/
│   ├── feishu/
│   ├── mattermost/
│   ├── nextcloud-talk/
│   ├── googlechat/
│   ├── line/
│   ├── msteams/
│   ├── matrix/
│   ├── zalo/
│   ├── tlon/
│   ├── synology-chat/
│   ├── lobster/
│   └── others...
├── packages/                      # clawdbot, moltbot
├── apps/                          # Platform-specific apps (macOS, iOS, Android)
├── skills/                        # Built-in skills
├── docs/                          # Comprehensive documentation
└── scripts/                       # Build & deployment scripts

### Core Framework Dependencies
- **HTTP Server**: Express 5.2.1
- **WebSocket**: ws 8.19.0
- **Task Processing**: croner 10.0.1
- **Validation**: Zod 4.3.6, AJV 8.18.0
- **CLI**: Commander 14.0.3, Clack 1.1.0
- **Media Processing**:
  - sharp 0.34.5 (image processing)
  - pdfjs-dist 5.5.207 (PDF extraction)
  - playwright-core 1.58.2 (browser automation)
- **AI/LLM Integration**:
  - AWS Bedrock SDK
  - @mariozechner/pi-* (AI agent core & coding agent)
  - Various model provider SDKs (OpenAI, Anthropic, Gemini, etc.)
- **Database**: SQLite (node:sqlite built-in), with sqlite-vec extension for embeddings
- **Vector DB**: LanceDB (optional, for memory/embeddings)
- **Data Format**: YAML, JSON, JSONL (for session transcripts)

---

## 2. File Upload Mechanism

### Architecture Pattern
OpenClaw handles file uploads through a multi-layer abstraction:

**Files Found**:
- `/src/media/` - Media processing layer
- `/src/media-understanding/` - Attachment analysis & caching
- `/src/gateway/chat-attachments.ts` - Chat attachment normalization
- `/src/media/outbound-attachment.ts` - Outbound media resolution
- `/src/gateway/server-methods/attachment-normalize.ts` - API normalization

### Upload Flow
1. **Inbound Upload** (Channel-specific):
   - Each channel plugin (Slack, Discord, Telegram, etc.) handles its native upload format
   - Example: `/src/slack/send.upload.test.ts` shows Slack file handling

2. **Attachment Normalization** (`/src/gateway/chat-attachments.ts`):
   ```typescript
   export type ChatAttachment = {
     type?: string;
     mimeType?: string;
     fileName?: string;
     content?: unknown;  // base64 or buffer
   };

   export type ChatImageContent = {
     type: "image";
     data: string;      // base64
     mimeType: string;
   };
   ```

3. **Media Storage** (`/src/media/`):
   - Files saved to agent-specific media roots
   - Path policy: inbound vs outbound media separation
   - Temporary file management with cleanup
   - Base64 encoding/decoding with size validation

4. **Outbound Resolution** (`/src/media/outbound-attachment.ts`):
   - `resolveOutboundAttachmentFromUrl()` - downloads from web URLs
   - Saves media buffer with mime type detection
   - Size limits per channel
   - Returns path + contentType

5. **Media Understanding** (`/src/media-understanding/attachments.ts`):
   - `MediaAttachmentCache` - caches processed attachments
   - `normalizeAttachments()` - handles image/video/audio classification
   - `selectAttachments()` - filters by type
   - Integration with agent context for processing

### Multipart Support
- Express 5.2.1 handling for file form submissions
- Channel-specific webhook handlers parse multipart/form-data
- Example: Discord, Slack, Telegram all have native upload mechanisms

### Storage Strategy
- **No cloud bucket integration** (S3, Supabase, etc.) found in core
- Files stored locally in agent workspace directories
- Session transcripts stored as JSONL in `/sessions/` directories
- Temporary media stored with auto-cleanup policies
- Plugin SDK allows extending storage via custom handlers

---

## 3. Chat/Messaging System

### Architecture
OpenClaw uses a **WebSocket-based gateway protocol** as the primary communication backbone.

**Key Files**:
- `/src/gateway/server-chat.ts` - Chat event handling
- `/src/gateway/chat-attachments.ts` - Attachment processing
- `/src/gateway/chat-sanitize.ts` - Security sanitization
- `/src/shared/chat-message-content.ts` - Message structure
- `/src/shared/chat-envelope.ts` - Message envelope
- `/src/tui/gateway-chat.ts` - Terminal UI integration

### WebSocket Protocol (`/src/gateway/protocol/`)

#### Connection Flow
1. **Handshake** (Client → Gateway):
   ```json
   {
     "type": "req",
     "id": "<uuid>",
     "method": "connect",
     "params": {
       "minProtocol": 3,
       "maxProtocol": 3,
       "client": { "id": "cli", "version": "...", "platform": "..." },
       "role": "operator",      // or "node"
       "scopes": ["operator.read", "operator.write"],
       "auth": { "token": "..." }
     }
   }
   ```

2. **Server Response** (Gateway → Client):
   ```json
   {
     "type": "res",
     "id": "<uuid>",
     "ok": true,
     "payload": { "type": "hello-ok", "protocol": 3 }
   }
   ```

3. **Frame Types**:
   - `request`: `{type:"req", id, method, params}`
   - `response`: `{type:"res", id, ok, payload|error}`
   - `event`: `{type:"event", event, payload, seq?, stateVersion?}`

#### Chat Methods
Key gateway methods in `/src/gateway/server-methods/chat.ts`:
- `chat.send` - Send message to channel/agent
- `chat.inject` - Inject message into session (testing/debugging)
- `chat.abort` - Cancel ongoing response
- `chat.history` - Fetch conversation history
- `chat.transcript` - Get full session transcript

#### Message Structure
```typescript
export type ChatMessage = {
  id?: string;
  role?: "user" | "assistant";
  content?: unknown;     // text blocks or structured data
  attachments?: ChatAttachment[];
  timestamp?: number;
  metadata?: Record<string, unknown>;
};
```

### Real-Time Events

**Broadcast System** (`/src/gateway/server-broadcast.ts`):
- `createGatewayBroadcaster()` - Creates event broadcaster
- All connected clients receive broadcasts with scope filtering
- Event sequence tracking (`seq`) for deduplication
- Scope-based access control:
  - `operator.read` / `operator.write` - Standard operator scopes
  - `operator.admin` - Admin operations
  - `operator.approvals` - Approval request events
  - `operator.pairing` - Device pairing events

**Event Examples**:
- `agent` - Agent activity/output
- `chat` - Chat messages
- `channel.status` - Channel connection status
- `health` - System health updates
- `presence` - Client presence changes

### Multi-Channel Message Flow
1. User sends message via channel (WhatsApp, Telegram, Discord, etc.)
2. Channel plugin normalizes to OpenClaw message format
3. Message queued to agent for processing
4. Agent responds/executes tools
5. Response sent back through same channel
6. All operations broadcast to connected clients (CLI, web UI, etc.)

### Session Management
- Sessions stored as JSONL files per agent
- `/src/memory/session-files.ts` - Session file I/O
- Each session entry is a JSON line containing:
  - Message content
  - Role (user/assistant)
  - Metadata (channel, timestamp, etc.)
- `/src/config/sessions/` - Session configuration & paths

---

## 4. Board/Kanban System

**Status**: NOT FOUND in codebase

Searches for board, kanban, card, column, task patterns returned:
- `dashboard.ts` - Onboarding dashboard (not a kanban board)
- `basic-cards.ts` - LINE flex message templates (not kanban)
- No kanban/board implementation found in core or extensions

**Interpretation**: OpenClaw is a **messaging & automation gateway**, not a project management tool. There are no built-in kanban boards or task management UI in the codebase.

---

## 5. Storage/CDN Solution

### Storage Architecture

**No Cloud Integration (S3, Supabase, etc.)**
- Searches for S3, bucket, cloud storage patterns found only usage tracking
- Example: `/src/infra/session-cost-usage.ts` uses "bucket" for aggregation math

### Local File Storage
1. **Agent Workspace** (`/src/config/sessions/paths.js`):
   - Each agent has a dedicated workspace directory
   - Session transcripts: `.openclaw/workspace/<agent-id>/sessions/`
   - Media files: `.openclaw/workspace/<agent-id>/media/`

2. **Memory/Database** (`/src/memory/`):
   - SQLite database per agent for vector embeddings
   - Path: `.openclaw/workspace/<agent-id>/memory.db`
   - Vector extension: sqlite-vec for embeddings
   - Optional LanceDB integration via plugin

3. **Session Files** (`/src/memory/session-files.ts`):
   - JSONL format (one JSON per line)
   - File naming: `.openclaw/workspace/<agent-id>/sessions/*.jsonl`
   - Contains: messages, metadata, timestamps
   - Hash-based deduplication and integrity checking

4. **Media Processing** (`/src/media/`):
   - Inbound media: downloaded/received files stored locally
   - Outbound media: resolved from URLs, saved locally
   - Image processing: sharp library for resizing/conversion
   - Size limits enforced per channel

5. **Configuration** (`/src/config/`):
   - YAML-based config stored in `.openclaw/config.yml`
   - Supports JSON5 for advanced use cases
   - Environment variable overrides

### Multi-Gateway Support
- `/src/gateway/server.impl.ts` - Multiple gateway instances can run
- Each gateway has its own workspace isolation
- Remote pairing via mDNS/Bonjour
- Tailscale integration for network bridging

---

## 6. API Patterns

### Primary Protocol: WebSocket (Not REST/GraphQL/tRPC)

**Why WebSocket?**
- Real-time bidirectional communication
- Perfect for control plane + node communication
- Used by CLI, web UI, mobile nodes, headless nodes
- Single transport for all clients

**Protocol Details** (`/src/gateway/protocol/`):
- **Version**: 3 (as of current codebase)
- **Handshake**: Device identity verification with TLS fingerprint
- **Authentication**:
  - Token-based (auth token in connect params)
  - Device token persistence
  - Role-based access control (operator/node)
- **Frame Format**: JSON text frames
- **Idempotency**: Idempotency keys for side-effecting methods

### Secondary Protocol: HTTP/REST

**Limited REST API** (`/src/gateway/server-http.ts`):
- Health probes
- Metrics endpoints
- Plugin HTTP routes (extensible)
- OpenAI HTTP API compatibility layer
- Slack HTTP webhooks
- Discord HTTP webhooks

**HTTP Endpoints**:
- `POST /chat/completions` - OpenAI API compatibility
- `POST /v1/chat/completions` - Alternative format
- `GET /health` - Health check
- `GET /metrics` - Prometheus metrics
- Plugin-specific routes: `/api/plugins/<plugin-id>/...`

### Gateway Methods (90+ RPC-style methods)

**Pattern**: Request/Response with method names
```json
{
  "type": "req",
  "id": "uuid",
  "method": "chat.send",
  "params": { ... }
}
```

**Key Method Categories**:
- `agent.*` - Agent management (create, delete, list, wait)
- `chat.*` - Chat operations (send, inject, abort, history)
- `channels.*` - Channel operations (login, status, logout)
- `config.*` - Configuration (get, set, patch, apply)
- `models.*` - Model management and switching
- `cron.*` - Scheduled task management
- `devices.*` - Device pairing and discovery
- `nodes.*` - Node operations and invocation
- `push.*` - Push notifications
- `exec-approvals.*` - Execution approval workflows
- `logs.*` - Log retrieval

### No GraphQL/tRPC Found
- No `@apollo/server`, `graphql`, or `trpc` dependencies
- Rationale: WebSocket protocol is more efficient for real-time sync
- Custom protocol designed for OpenClaw's specific needs

---

## 7. Database Schema & Persistence

### Primary Database: SQLite (Node.js Built-in)

**Location**:
- `/src/memory/manager.ts` - Memory manager using SQLite
- `/src/memory/manager-sync-ops.ts` - Synchronous SQLite operations

**Capabilities**:
- **Vector Storage**: sqlite-vec extension for embeddings
- **Embedded Approach**: No separate database server needed
- **File-Based**: Single `.db` file per agent

### Database Schema (Inferred from Code)

**Memory Tables** (`/src/memory/`):
```sql
-- Embeddings/memories
CREATE TABLE files (
  id TEXT PRIMARY KEY,
  source TEXT,
  content TEXT,
  embedding VECTOR,  -- sqlite-vec extension
  metadata JSON,
  createdAt DATETIME,
  updatedAt DATETIME
);

-- Vector search support
-- (sqlite-vec handles vector storage & indexing)
```

### Session Persistence (JSONL Format)

**Files**: `.openclaw/workspace/<agent-id>/sessions/*.jsonl`

**Format**: One JSON object per line
```jsonl
{"type":"message", "role":"user", "content":"...", "timestamp":1234567890}
{"type":"message", "role":"assistant", "content":"...", "timestamp":1234567891}
```

**Repair/Migration**:
- `/src/agents/session-file-repair.ts` - Repair corrupted session files
- `/src/memory/session-files.ts` - JSONL parsing with line-mapping

### Migration System

**State Migrations** (`/src/config/legacy.migrations.ts`):
- Part 1: Basic schema migrations
- Part 2: Configuration updates
- Part 3: Advanced transformations
- Migration runner: `/src/commands/doctor-state-migrations.ts`

**Channel Migrations**:
- `/src/slack/channel-migration.ts` - Slack channel ID updates
- `/src/telegram/group-migration.ts` - Telegram group migration
- `/src/cron/payload-migration.ts` - Cron job payload updates

### Cost & Usage Tracking

**Tracking**: `/src/infra/session-cost-usage.ts`
- Per-agent cost tracking
- Daily aggregation
- Token usage (input/output/cache)
- Cost breakdown per provider
- Time-series data for charts

### No ORM
- Direct SQLite access
- Prepared statements for security
- Manual schema management
- Focus on simplicity & performance

---

## 8. System Architecture Overview

### Control Plane (Gateway)
- **Single Entry Point**: WebSocket server on configurable port (default 18789)
- **HTTP Fallback**: REST endpoints for health, metrics, webhooks
- **Authentication**: Token-based + Device identity verification
- **Broadcast**: All-clients event broadcasting with scope filtering

### Node Architecture
- **Capability Hosts**: macOS, iOS, Android, Linux nodes
- **Node Commands**: camera, canvas, screen, location, voice
- **Two-Way Communication**: Nodes connect to gateway via WebSocket
- **Pairing**: Device-to-gateway pairing with secure key exchange

### Agent Runtime
- **Embedded AI**: Uses @mariozechner/pi-agent-core
- **Tool Integration**: Browser, system.run, messaging tools
- **Memory**: SQLite with embeddings
- **Session Context**: Agent-specific workspace
- **Concurrency**: Task queue system with deduplication

### Channel Integration
- **25+ Messaging Platforms**: Discord, Slack, Telegram, WhatsApp, etc.
- **Plugin Architecture**: Extensions can add new channels
- **Normalization**: Channel-agnostic message format
- **Rate Limiting**: Per-channel rate limit handling

### Media Pipeline
```
Inbound Media → Normalization → Storage → Understanding → Usage
Outbound Context → Media URL → Download/Fetch → Conversion → Channel Format
```

---

## 9. Key Technical Decisions

### WebSocket Over HTTP/GraphQL
- **Real-time requirement**: Bidirectional streaming for agent output
- **Efficiency**: Single persistent connection vs. polling
- **Simplicity**: Custom protocol tailored to OpenClaw workflow
- **Compatibility**: Works across CLI, web, mobile, headless environments

### SQLite Over PostgreSQL/MongoDB
- **Portability**: No server setup required
- **Security**: Local-first, single-user focus
- **Embeddings**: sqlite-vec extension for vector search
- **Simplicity**: Built into Node.js, no additional dependencies

### JSONL Session Format
- **Immutability**: Append-only log format
- **Compatibility**: Human-readable, scriptable
- **Repair**: Line-based format allows recovery from corruption
- **Streaming**: Can parse incrementally without loading entire file

### TypeScript
- **Orchestration Layer**: Not compute-heavy, focus on integration
- **Hackability**: Widely known, easy to read and modify
- **Tooling**: Excellent IDE support, type safety
- **Extensibility**: User scripts can extend functionality

### Plugin Architecture
- **Core Lean**: Minimal required plugins
- **Extension Slots**: Channel, memory, tools, skills
- **Distribution**: npm packages, local development
- **Isolation**: One memory plugin active at a time

---

## 10. Key Files & Directories

### Core Gateway
- `/src/gateway/server.impl.ts` - Gateway initialization
- `/src/gateway/client.ts` - WebSocket client implementation
- `/src/gateway/server-broadcast.ts` - Event broadcasting
- `/src/gateway/server-methods/` - 60+ RPC method implementations
- `/src/gateway/protocol/` - Protocol definitions & schemas

### Chat & Messaging
- `/src/gateway/server-chat.ts` - Chat event handling
- `/src/gateway/chat-attachments.ts` - Attachment processing
- `/src/shared/chat-envelope.ts` - Message wrapper
- `/src/infra/outbound/message.ts` - Outbound message routing

### Agents & AI
- `/src/agents/` - Agent lifecycle & management (530+ files)
- `/src/agents/pi-embedded-runner.ts` - Agent execution
- `/src/agents/tools/` - Built-in tools (browser, message, system.run)
- `/src/memory/manager.ts` - Agent memory management

### Media & Attachments
- `/src/media/` - Media processing & storage
- `/src/media-understanding/` - Attachment analysis & caching
- `/src/browser/` - Playwright browser automation

### Channels
- `/src/channels/` - Channel core abstractions
- `/extensions/` - 25+ channel implementations
- `/src/slack/`, `/src/discord/`, `/src/telegram/`, etc.

### Configuration
- `/src/config/` - YAML schema & validation
- `/src/config/sessions/` - Session paths & storage
- Schema definitions: `zod-schema.*.ts` files

### Memory & Storage
- `/src/memory/` - Vector DB & embeddings
- `/src/infra/` - File I/O, JSON stores, state migrations

### Web UI
- `/ui/` - React frontend
- `/src/web/` - Web backend integration
- `/src/gateway/control-ui.ts` - UI server endpoints

---

## Unresolved Questions

1. **Persistence Details**: How are in-flight messages handled during gateway restarts?
2. **Conflict Resolution**: How are concurrent messages from same user handled?
3. **Retention Policy**: How long are session transcripts retained?
4. **Backup Strategy**: Are there built-in backup mechanisms for user data?
5. **Horizontal Scaling**: Can multiple gateways share state? (Tailscale bridge found, but no distributed state)
6. **Archive Format**: Is there a standard export/archive format for sessions?
