# System Architecture

## High-Level Architecture

FlowGrid follows a three-tier architecture with clear separation between presentation, application, and data layers.

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                          │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │  Browser   │  │ API Client │  │  Gateway   │            │
│  │    UI      │  │  (cURL)    │  │  WebSocket │            │
│  └────────────┘  └────────────┘  └────────────┘            │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     Application Layer                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Next.js Frontend (Port 3000)            │   │
│  │  - React 19 Server/Client Components                 │   │
│  │  - TanStack Query for data fetching                  │   │
│  │  - Generated API client (Orval)                      │   │
│  └──────────────────────────────────────────────────────┘   │
│                           │                                  │
│                           ▼                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              FastAPI Backend (Port 8000)             │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐     │   │
│  │  │ API Routes │→ │  Services  │→ │   Models   │     │   │
│  │  └────────────┘  └────────────┘  └────────────┘     │   │
│  │                                                       │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │         OpenClaw Integration Layer            │  │   │
│  │  │  - Gateway RPC                                │  │   │
│  │  │  - Lifecycle Orchestrator                     │  │   │
│  │  │  - Provisioning Service                       │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
│                           │                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           RQ Worker (Background Jobs)                │   │
│  │  - Webhook processing                                │   │
│  │  - Async task execution                              │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                       Data Layer                             │
│  ┌────────────────────┐      ┌────────────────────┐         │
│  │   PostgreSQL       │      │      Redis         │         │
│  │  (Port 5432)       │      │   (Port 6379)      │         │
│  │  - Primary data    │      │   - Job queue      │         │
│  │  - Relational      │      │   - Caching        │         │
│  └────────────────────┘      └────────────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

## Component Architecture

### Frontend Architecture (Next.js)

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Next.js App Router                      │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │  Route Groups                                  │  │   │
│  │  │  - (app): Protected routes (auth required)     │  │   │
│  │  │  - (public): Public routes (no auth)           │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  │                      │                                │   │
│  │                      ▼                                │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │  Pages (app/ directory)                        │  │   │
│  │  │  - Server Components (default)                 │  │   │
│  │  │  - Client Components ('use client')            │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  │                      │                                │   │
│  │                      ▼                                │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │  Components (Atomic Design)                    │  │   │
│  │  │  atoms → molecules → organisms → templates     │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  │                      │                                │   │
│  │                      ▼                                │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │  State Management + Streaming                  │  │   │
│  │  │  - TanStack Query (server state + policies)    │  │   │
│  │  │  - useSSEStream (consolidated SSE hook)        │  │   │
│  │  │  - React useState/useReducer (local state)     │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  │                      │                                │   │
│  │                      ▼                                │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │  API Client (Generated by Orval)              │  │   │
│  │  │  - Type-safe API calls                         │  │   │
│  │  │  - Request/response schemas                    │  │   │
│  │  │  - SSE parsing via parseSSEBuffer             │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼ HTTP/HTTPS + SSE
                    Backend API (Port 8000)
```

### Backend Architecture (FastAPI)

```
┌─────────────────────────────────────────────────────────────┐
│                    FastAPI Application                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  API Layer (app/api/)                                │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │  Route Handlers (24 modules)                   │  │   │
│  │  │  - Request validation (Pydantic)               │  │   │
│  │  │  - Response serialization                      │  │   │
│  │  │  - Authentication/Authorization                │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  │                      │                                │   │
│  │                      ▼                                │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │  Service Layer (app/services/)                 │  │   │
│  │  │  - Business logic                              │  │   │
│  │  │  - Orchestration                               │  │   │
│  │  │  - External integrations                       │  │   │
│  │  │  - Billing simulated checkout + entitlement    │  │   │
│  │  │                                                 │  │   │
│  │  │  ┌──────────────────────────────────────────┐  │  │   │
│  │  │  │  OpenClaw Integration                    │  │  │   │
│  │  │  │  - Gateway RPC                           │  │  │   │
│  │  │  │  - Lifecycle Orchestrator                │  │  │   │
│  │  │  │  - Provisioning Service                  │  │  │   │
│  │  │  └──────────────────────────────────────────┘  │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  │                      │                                │   │
│  │                      ▼                                │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │  Model Layer (app/models/)                     │  │   │
│  │  │  - SQLModel ORM                                │  │   │
│  │  │  - Database schema                             │  │   │
│  │  │  - Relationships                               │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
│                           │                                  │
│                           ▼                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Database Session (Async SQLAlchemy)                 │   │
│  │  - Connection pooling                                │   │
│  │  - Transaction management                            │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
                      PostgreSQL
```

## Billing V1 & Token Quota Runtime Flow

```
Frontend UpgradeModal
    │
    ├─→ POST /api/v1/billing/simulate/checkout (org admin, idempotent)
    └─→ GET  /api/v1/billing/me/subscription
             │
             ▼
        Billing service
             │
             ├─ updates organization_plans
             ├─ writes billing_checkout_attempts (idempotency key)
             └─ emits admin billing audit event

Runtime write paths (boards/board-groups/agents/tasks)
    │
    └─→ entitlements service
          - resolves tier (`trial_7d`/`pro`)
          - enforces hard quotas (board-groups, agents-per-board)
          - returns 402 `blocked_for_payment` when trial expired

Token Quota Enforcement
    │
    ├─→ Agent daily ledger: agent_token_daily_usage
    │     - incremented per agent on execution
    │     - aggregated by day for quota checks
    │
    ├─→ Quota surfaces: GET /api/v1/metrics/quotas
    │     - derives from ledger with metadata fallback
    │     - exposes: token_used_today, token_limit_today, token_remaining_today
    │
    └─→ Agent UI: Agents table shows "Tokens left" column with reset hint
```

## Data Flow Patterns

### SSE Streaming Architecture

```
Frontend useSSEStream Hook
    │
    ├─→ Connects to SSE endpoint
    │     - Exponential backoff retry (up to N attempts)
    │     - Event message buffering
    │
    ├─→ parseSSEBuffer Parser
    │     - Decodes SSE event chunks
    │     - Handles multi-line data fields
    │     - Calls onMessage callback with parsed events
    │
    └─→ TanStack Query Cache Update
          - Maintains cache consistency
          - Triggers component re-renders

Backend SSE Endpoint
    │
    ├─→ /api/v1/boards/{board_id}/memory/stream
    │     - Yields ServerSentEvent with chat messages
    │     - Applies query filters (is_chat, chat_session_id)
    │
    └─→ FastAPI StreamingResponse
          - Async event generator
          - Proper SSE formatting
```

### Board Chat Multi-Session & File Upload Flow

```
BoardChatPanel (frontend)
    │
    ├─→ Session CRUD: /api/v1/boards/{board_id}/chat-sessions
    │     - list/create/rename/archive session metadata
    │
    ├─→ Message reads: /api/v1/boards/{board_id}/memory?is_chat=true&chat_session_id=...
    │     - latest-first paged message reads
    │
    ├─→ File upload: POST /api/v1/boards/{board_id}/chat-files/upload (multipart)
    │     - Client-side allowlist: txt, md, csv, json, pdf
    │     - Server: MinIO storage + PDF OCR extraction
    │     - Response: file_id + task queue job reference
    │
    ├─→ SSE stream: /api/v1/boards/{board_id}/memory/stream?is_chat=true&chat_session_id=...
    │     - session-scoped SSE updates via useSSEStream
    │     - parsed by parseSSEBuffer
    │     - includes attachment metadata for uploaded files
    │
    └─→ Message write: POST /api/v1/boards/{board_id}/memory
          - chat message write with chat_session_id + file references
          - auto-title when untouched title is "New chat"
          - attachments linked via board_message_files junction

PostgreSQL Models:
    ├─ board_chat_sessions (id, board_id, title, created_by, ...)
    ├─ board_chat_file_assets (id, board_id, file_name, status, created_at, ...)
    ├─ board_chat_file_reports (id, file_asset_id, extraction_status, ...)
    ├─ board_chat_message_files (id, board_memory_id, file_asset_id, ...)
    └─ board_memory.chat_session_id (nullable FK)
```

### Standard CRUD Operation Flow

```
User Action (Browser)
    │
    ▼
React Component
    │
    ▼
TanStack Query Hook
    │
    ▼
Generated API Client (Orval)
    │
    ▼ HTTP Request
FastAPI Route Handler
    │
    ├─→ Authentication Check (deps.py)
    │
    ├─→ Request Validation (Pydantic Schema)
    │
    ▼
Service Layer Function
    │
    ├─→ Business Logic
    │
    ├─→ Database Query (SQLModel)
    │
    ▼
Database (PostgreSQL)
    │
    ▼
Response (Pydantic Schema)
    │
    ▼ HTTP Response
API Client
    │
    ▼
TanStack Query Cache Update
    │
    ▼
React Component Re-render
    │
    ▼
Updated UI
```

### Async Job Processing Flow

```
API Request
    │
    ▼
FastAPI Route Handler
    │
    ▼
Enqueue Job (Redis RQ)
    │
    ├─→ Return Job ID immediately
    │
    ▼
RQ Worker Process
    │
    ├─→ Dequeue Job
    │
    ├─→ Execute Job Function
    │     - gateway activation/provisioning tasks
    │     - lifecycle reconcile tasks
    │     - webhook dispatch tasks
    │     - organization invite email send tasks (Resend adapter)
    │
    ├─→ Update Job Status
    │
    ▼
Job Completion
    │
    ├─→ Webhook Notification (optional)
    │
    └─→ Database Update
```

### Organization invite email delivery flow

```text
POST /api/v1/organizations/me/invites
  -> persist invite + commit
  -> enqueue organization_invite_email_send (best-effort, non-blocking)
  -> return invite token + payload

POST /api/v1/organizations/me/invites/{invite_id}/resend
  -> validate org admin + pending invite
  -> enqueue organization_invite_email_send (best-effort)
  -> return invite payload

Frontend `/organization` invites table
  -> Resend email action calls resend endpoint
  -> keeps invite list refreshed via query invalidation

queue worker
  -> decode invite task + send_key
  -> load invite/org from DB
  -> build accept URL from INVITE_ACCEPT_BASE_URL + token
  -> send via Resend with deterministic idempotency key
  -> retry only retryable provider/network failures using existing queue policy
```

### Organization Bootstrap + Managed Gateway Flow

```
User Authentication / First Org Creation
    │
    ▼
Organization bootstrap service
    │
    ├─→ Create org + owner membership
    │
    ├─→ Auto-create managed gateway row (org-scoped workspace root)
    │
    ├─→ Upsert gateway-main agent record immediately (DB only)
    │     - avoids race where board create happens before worker runs
    │
    └─→ Enqueue async gateway activation task
          - worker performs compatibility + runtime provisioning
          - status transitions: activating → ready | degraded
```

### Gateway Communication Flow

```
FlowGrid Backend
    │
    ▼
WebSocket Connection
    │
    ├─→ Gateway Registration
    │   └─→ Store gateway metadata
    │
    ├─→ Health Check (periodic)
    │   └─→ Update gateway status
    │
    ├─→ Agent Provisioning Request
    │   │
    │   ▼
    │   Gateway (Remote)
    │   │
    │   ├─→ Create Agent Instance
    │   │
    │   ├─→ Configure Agent
    │   │
    │   └─→ Return Agent Status
    │
    └─→ Agent Lifecycle Events
        └─→ Update FlowGrid state
```

## Authentication and Authorization Flow

### Clerk Authentication Mode

```
User Login
    │
    ▼
Clerk Sign-In Component
    │
    ▼
Clerk Authentication Service
    │
    ├─→ JWT Token Generated
    │
    ▼
Frontend (Next.js)
    │
    ├─→ Store JWT in Clerk Session
    │
    ▼
API Request with JWT
    │
    ▼
Backend (FastAPI)
    │
    ├─→ Extract JWT from Authorization header
    │
    ├─→ Verify JWT with Clerk API
    │
    ├─→ Extract user_id from JWT claims
    │
    ├─→ Load user from database
    │
    ▼
Authorized Request Processing
```

### Local Bearer Token Mode

```
User Login
    │
    ▼
Frontend Login Form
    │
    ├─→ Submit credentials (or use pre-shared token)
    │
    ▼
Backend (FastAPI)
    │
    ├─→ Validate token against LOCAL_AUTH_TOKEN env var
    │
    ├─→ Create session
    │
    ▼
Frontend
    │
    ├─→ Store token in localStorage/sessionStorage
    │
    ▼
API Request with Bearer Token
    │
    ▼
Backend (FastAPI)
    │
    ├─→ Extract token from Authorization header
    │
    ├─→ Validate against LOCAL_AUTH_TOKEN
    │
    ▼
Authorized Request Processing
```

## Database Schema Overview

### Core Entities

```
Organizations
    │
    ├─→ OrganizationMembers (users in org)
    │
    ├─→ OrganizationInvites (pending invites)
    │
    ├─→ OrganizationBoardAccess (board permissions)
    │
    ├─→ WorkspaceTemplates (pre-built agent configurations)
    │
    └─→ BoardGroups
            │
            ├─→ BoardGroupMemory (shared memory)
            │
            └─→ Boards
                    │
                    ├─→ BoardMemory (board-specific memory)
                    │
                    ├─→ BoardOnboarding (setup state)
                    │
                    ├─→ BoardWebhooks
                    │   └─→ BoardWebhookPayloads
                    │
                    ├─→ Agents (assigned to board)
                    │   └─→ uses WorkspaceTemplate during provisioning
                    │
                    └─→ Tasks
                            │
                            ├─→ TaskCustomFields (metadata)
                            │
                            ├─→ TaskDependencies (task relationships)
                            │
                            ├─→ TaskFingerprints (deduplication)
                            │
                            ├─→ TagAssignments
                            │   └─→ Tags
                            │
                            └─→ ApprovalTaskLinks
                                    └─→ Approvals
```

### Key Relationships

- **Organizations** → **BoardGroups**: One-to-many
- **BoardGroups** → **Boards**: One-to-many
- **Boards** → **Tasks**: One-to-many
- **Boards** → **Agents**: Many-to-many (through assignment)
- **Tasks** → **Tags**: Many-to-many (through TagAssignments)
- **Tasks** → **Approvals**: Many-to-many (through ApprovalTaskLinks)
- **Tasks** → **Tasks**: Many-to-many (through TaskDependencies)

### Supporting Entities

- **Gateways**: Remote execution environments
- **Skills**: Agent capabilities from marketplace
- **ActivityEvents**: Audit trail for all operations
- **Users**: Managed by Clerk or local auth

## API Structure

### REST API Endpoints

```
/api/
├── /auth
│   ├── POST /login
│   └── POST /logout
│
├── /organizations
│   ├── GET    /organizations
│   ├── POST   /organizations
│   ├── GET    /organizations/{id}
│   ├── PATCH  /organizations/{id}
│   ├── DELETE /organizations/{id}
│   ├── GET    /organizations/{id}/members
│   ├── POST   /organizations/{id}/invites
│   └── GET    /organizations/{id}/boards
│
├── /board-groups
│   ├── GET    /board-groups
│   ├── POST   /board-groups
│   ├── GET    /board-groups/{id}
│   ├── PATCH  /board-groups/{id}
│   ├── DELETE /board-groups/{id}
│   ├── GET    /board-groups/{id}/memory
│   └── POST   /board-groups/{id}/memory
│
├── /boards
│   ├── GET    /boards
│   ├── POST   /boards
│   ├── GET    /boards/{id}
│   ├── PATCH  /boards/{id}
│   ├── DELETE /boards/{id}
│   ├── GET    /boards/{id}/tasks
│   ├── GET    /boards/{id}/agents
│   ├── GET    /boards/{id}/memory
│   ├── POST   /boards/{id}/memory
│   ├── GET    /boards/{id}/webhooks
│   └── POST   /boards/{id}/webhooks
│
├── /tasks
│   ├── GET    /tasks
│   ├── POST   /tasks
│   ├── GET    /tasks/{id}
│   ├── PATCH  /tasks/{id}
│   ├── DELETE /tasks/{id}
│   ├── GET    /tasks/{id}/dependencies
│   ├── POST   /tasks/{id}/dependencies
│   └── GET    /tasks/{id}/custom-fields
│
├── /agents
│   ├── GET    /agents
│   ├── POST   /agents
│   ├── GET    /agents/{id}
│   ├── PATCH  /agents/{id}
│   ├── DELETE /agents/{id}
│   ├── POST   /agents/{id}/start
│   ├── POST   /agents/{id}/stop
│   └── GET    /agents/{id}/logs
│
├── /gateways
│   ├── GET    /gateways
│   ├── POST   /gateways
│   ├── GET    /gateways/{id}
│   ├── PATCH  /gateways/{id}
│   ├── DELETE /gateways/{id}
│   └── GET    /gateways/{id}/health
│
├── /approvals
│   ├── GET    /approvals
│   ├── POST   /approvals
│   ├── GET    /approvals/{id}
│   ├── POST   /approvals/{id}/approve
│   └── POST   /approvals/{id}/reject
│
├── /tags
│   ├── GET    /tags
│   ├── POST   /tags
│   ├── GET    /tags/{id}
│   ├── PATCH  /tags/{id}
│   └── DELETE /tags/{id}
│
├── /activity
│   └── GET    /activity
│
├── /metrics
│   └── GET    /metrics
│
├── /skills
│   ├── GET    /skills/marketplace
│   └── POST   /skills/install
│
└── /workspace-templates
    ├── GET    /workspace-templates
    ├── POST   /workspace-templates
    ├── GET    /workspace-templates/{id}
    ├── PATCH  /workspace-templates/{id}
    └── DELETE /workspace-templates/{id}
```

### WebSocket Endpoints

```
/ws/gateway/{gateway_id}
    - Gateway registration and health checks
    - Agent provisioning requests
    - Lifecycle event streaming
```

## Deployment Architecture

### Docker Compose Deployment

```
┌─────────────────────────────────────────────────────────────┐
│                      Docker Host                             │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │  frontend (Next.js)                                │     │
│  │  Port: 3000                                        │     │
│  │  Depends: backend                                  │     │
│  └────────────────────────────────────────────────────┘     │
│                           │                                  │
│  ┌────────────────────────────────────────────────────┐     │
│  │  backend (FastAPI)                                 │     │
│  │  Port: 8000                                        │     │
│  │  Depends: db, redis                                │     │
│  └────────────────────────────────────────────────────┘     │
│                           │                                  │
│  ┌────────────────────────────────────────────────────┐     │
│  │  webhook-worker (RQ Worker)                        │     │
│  │  Depends: backend, redis                           │     │
│  └────────────────────────────────────────────────────┘     │
│                           │                                  │
│  ┌──────────────────┐    │    ┌──────────────────┐          │
│  │  db (PostgreSQL) │◄───┴───►│  redis (Redis)   │          │
│  │  Port: 5432      │         │  Port: 6379      │          │
│  │  Volume: pgdata  │         │  Volume: redisdata│         │
│  └──────────────────┘         └──────────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

### Local Development Deployment

```
┌─────────────────────────────────────────────────────────────┐
│                      Local Machine                           │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Next.js Dev Server (npm run dev)                  │     │
│  │  Port: 3000                                        │     │
│  │  Hot reload enabled                                │     │
│  └────────────────────────────────────────────────────┘     │
│                           │                                  │
│  ┌────────────────────────────────────────────────────┐     │
│  │  FastAPI (uvicorn --reload)                        │     │
│  │  Port: 8000                                        │     │
│  │  Hot reload enabled                                │     │
│  └────────────────────────────────────────────────────┘     │
│                           │                                  │
│  ┌────────────────────────────────────────────────────┐     │
│  │  RQ Worker (rq worker)                             │     │
│  │  Watches Redis queue                               │     │
│  └────────────────────────────────────────────────────┘     │
│                           │                                  │
│  ┌──────────────────┐    │    ┌──────────────────┐          │
│  │  PostgreSQL      │◄───┴───►│  Redis           │          │
│  │  (Docker or      │         │  (Docker or      │          │
│  │   local install) │         │   local install) │          │
│  └──────────────────┘         └──────────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

## Security Architecture

### Network Security

- All services bind to localhost in development
- Production deployment behind reverse proxy (nginx/traefik)
- HTTPS termination at reverse proxy
- CORS configuration for allowed origins

### Authentication Security

- JWT tokens with expiration (Clerk mode)
- Secure token storage (httpOnly cookies preferred)
- Bearer token validation (local mode)
- Environment-based secret management

### Database Security

- Connection pooling with max connections limit
- Parameterized queries (SQLModel/SQLAlchemy)
- Row-level security for multi-tenant isolation
- Regular automated backups

### API Security

- Rate limiting per endpoint
- Input validation with Pydantic
- SQL injection prevention (ORM)
- XSS prevention (output encoding)

## Performance Considerations

### Backend Performance

- Async database operations (asyncpg)
- Connection pooling (SQLAlchemy)
- Redis caching for frequently accessed data
- Background job processing (RQ)
- Database indexes on foreign keys and query columns

### Frontend Performance

- Server-side rendering (Next.js)
- Code splitting (dynamic imports)
- Heavy markdown parsing isolated behind lazy boundaries (`LazyMarkdown`)
- Image optimization (Next.js Image)
- TanStack Query caching
- Optimistic UI updates
- Board chat ordering kept in hook state (render path avoids full-list sort loops)
- Long chat lists use `content-visibility` to reduce offscreen render cost

### Database Performance

- Indexes on frequently queried columns
- Pagination for large result sets
- Eager loading to prevent N+1 queries
- Query optimization with EXPLAIN ANALYZE

## Scalability Patterns

### Horizontal Scaling

- Stateless backend API (multiple instances behind load balancer)
- Shared PostgreSQL database
- Shared Redis instance for job queue
- Session storage in database or Redis (not in-memory)

### Vertical Scaling

- Increase database resources (CPU, RAM, storage)
- Increase Redis memory + backend worker processes

### Future Scaling

- Database read replicas, Redis cluster, message queues, CDN

## Monitoring and Observability

- `/healthz` health check endpoint with db, redis, gateway status
- API latency metrics (P50, P95, P99) + job queue monitoring
- Board overlay telemetry: `/api/v1/metrics/board-overlay` (latency, filters, cursor usage, regression markers)
- Billing health: `/api/v1/metrics/saas-billing-health` (trial status, entitlements, events)
- Structured JSON logging with audit trail via ActivityEvents

## Board Planning Overlay Compatibility Guardrails

- Contract matrix source of truth: `docs/reference/board-planning-overlay-contract-matrix.md`
- Locked contracts for OpenClaw runtime compatibility:
  - Task status model remains `inbox`, `in_progress`, `review`, `done`
  - Agent discovery route stays `GET /api/v1/agent/boards/{board_id}/tasks`
  - Task event taxonomy remains unchanged
  - Heartbeat workflow stays task-comment-first
- Overlay changes must stay additive:
  - Optional task-group metadata (`task_group_id`, `sort_index`, `archived_at`)
  - Optional filter/cursor query paths for scalable UI reads
- Rollout and observability controls:
  - Feature flags: `board_planning_overlay_v1`, `board_query_v2`
  - Canary targeting via board/org allowlists from runtime configuration
  - Runtime telemetry endpoint: `GET /api/v1/metrics/board-overlay`
  - Query instrumentation: latency samples, filter usage, cursor usage
  - Compatibility signal: `agent_task_loop_regression_count`

## Unresolved Questions

1. What concurrent user load target for production?
2. Database read replicas needed for scaling?
3. Disaster recovery strategy and RTO/RPO targets?
