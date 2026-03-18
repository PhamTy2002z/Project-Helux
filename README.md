# VisgniteAI

A centralized operations and governance platform for AI agents.
Provides unified work orchestration, agent management, approval-driven governance, and API-backed automation with board chat, file uploads, and scalable planning overlays.

## Overview

VisgniteAI is a SaaS platform for teams to operate AI agents with:

- **Work orchestration**: organization → board group → board → task → tag → custom fields
- **Agent management**: create, configure, monitor with workspace templates
- **Board planning overlay**: grouped rendering, density modes, cursor pagination, saved views
- **Board chat**: multi-session with file upload, PDF OCR extraction, full-text indexing
- **Approvals & governance**: approval workflows for sensitive actions
- **Gateway**: OpenClaw Docker gateway with managed workspace provisioning
- **Activity history**: event timeline for debugging and auditing
- **SaaS model**: trial (7d) → pro tiers, token quota enforcement
- **API-first**: REST API + SSE streaming, dual auth (Clerk JWT / Bearer token)

## Tech Stack

| Layer    | Technology                                           |
| -------- | ---------------------------------------------------- |
| Frontend | Next.js 16.1.6 (React 19), TanStack Query 5, Orval, SSE |
| Backend  | FastAPI 0.131.0 (Python 3.12+), SQLModel, Pydantic   |
| Database | PostgreSQL 14+ with Alembic migrations              |
| Queue    | Redis 6+ (RQ Worker), async email delivery          |
| Email    | Resend provider (org invites, notifications)         |
| Storage  | MinIO (S3-compatible, board chat files)              |
| Gateway  | OpenClaw Docker service, workspace templates         |
| Auth     | Clerk JWT or Local Bearer Token                      |
| Deploy   | Docker Compose (7 services)                          |

## Quick Start

### Prerequisites

- Docker Engine + Docker Compose v2
- Or: Node.js 22+, Python 3.12+, PostgreSQL, Redis (for local dev)

### Option A: Docker (recommended)

```bash
# 1. Configure environment
cp .env.example .env
# Set LOCAL_AUTH_TOKEN (minimum 50 characters) when AUTH_MODE=local

# 2. Start services
docker compose -f compose.yml --env-file .env up -d --build

# 3. Run database migrations (automatic on startup, or manual)
# Migrations run automatically in docker container init
# For manual: docker compose -f compose.yml --env-file .env exec backend alembic upgrade head

# 4. Access
# UI:      http://localhost:3000
# Backend: http://localhost:8000/healthz
```

Rebuild after pulling new code:

```bash
docker compose -f compose.yml --env-file .env up -d --build --force-recreate
```

Stop the stack:

```bash
docker compose -f compose.yml --env-file .env down
```

### Option B: Local Development

```bash
# Install dependencies then run both frontend + backend
pnpm dev
# Frontend: http://localhost:3001
# Backend:  http://localhost:8000
```

### Option C: Installer Script

```bash
./install.sh
```

Interactive script that asks for deployment mode (`docker` / `local`), installs dependencies, generates `.env`, and starts the stack.

## Authentication

Two modes supported:

- **`local`**: shared bearer token (default for self-hosted)
- **`clerk`**: Clerk JWT

See `.env.example` files in root, `backend/`, and `frontend/`.

## Project Structure

```
VisgniteAI/
├── backend/          # FastAPI application
│   ├── app/
│   │   ├── api/      # Route handlers
│   │   ├── models/   # SQLModel ORM
│   │   ├── schemas/  # Pydantic schemas
│   │   └── services/ # Business logic
│   ├── migrations/   # Alembic migrations
│   └── tests/
├── frontend/         # Next.js application
│   └── src/
│       ├── app/      # App Router pages
│       ├── components/
│       └── lib/      # API client, hooks
├── compose.yml       # Docker Compose config
├── plans/            # Implementation plans
└── docs/             # Project documentation
```

## Documentation

See [`/docs`](./docs/) for details:

- [Project Overview (PDR)](./docs/project-overview-pdr.md)
- [System Architecture](./docs/system-architecture.md)
- [Code Standards](./docs/code-standards.md)
- [Design Guidelines](./docs/design-guidelines.md)
- [Deployment Guide](./docs/deployment-guide.md)

## Project Status

Under active development. APIs and features may change between releases.

## Contributing

Issues and pull requests are welcome.

- [Open issues](https://github.com/PhamTy2002z/VisgniteAI/issues)

## License

MIT License. See [`LICENSE`](./LICENSE).
