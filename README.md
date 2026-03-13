# FlowGrid

A centralized operations and governance platform for AI agents.
Provides unified work orchestration, agent management, approval-driven governance, and API-backed automation with board chat, file uploads, and scalable planning overlays.

## Overview

FlowGrid is a SaaS platform for teams to operate AI agents with:

- **Work orchestration**: organization → board group → board → task → tag
- **Agent management**: create, configure, and monitor agent lifecycle
- **Approvals & governance**: approval flows for sensitive actions
- **Gateway**: connect and control distributed execution environments
- **Activity history**: event timeline for debugging and auditing
- **API-first**: supports both web UI and automation clients

## Tech Stack

| Layer    | Technology                                           |
| -------- | ---------------------------------------------------- |
| Frontend | Next.js (React 19), TanStack Query, Orval, SSE      |
| Backend  | FastAPI (Python 3.12+), SQLModel, Pydantic           |
| Database | PostgreSQL 14+                                       |
| Queue    | Redis 6+ (RQ Worker)                                 |
| Auth     | Clerk JWT or Local Bearer Token                      |
| Deploy   | Docker Compose                                       |

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
FlowGrid/
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

- [Open issues](https://github.com/PhamTy2002z/FlowGrid/issues)

## License

MIT License. See [`LICENSE`](./LICENSE).
