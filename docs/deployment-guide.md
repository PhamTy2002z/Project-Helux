# Deployment Guide

## Overview

FlowGrid supports two deployment modes:
- **Docker Mode**: Production-like deployment with all services containerized
- **Local Mode**: Native development deployment for rapid iteration

## Prerequisites

### System Requirements

#### Docker Mode
- **Operating System**: Linux or macOS
- **Docker Engine**: 20.10+
- **Docker Compose**: v2.0+
- **RAM**: 4GB minimum, 8GB recommended
- **Disk Space**: 10GB minimum for images and data

#### Local Mode
- **Operating System**: Linux or macOS
- **Python**: 3.12+
- **Node.js**: 22+
- **PostgreSQL**: 14+
- **Redis**: 6+
- **RAM**: 4GB minimum, 8GB recommended

### Platform-Specific Requirements

#### macOS
- **Docker Mode**: Docker Desktop for Mac
- **Local Mode**: Homebrew for dependency installation

#### Linux
- **Docker Mode**: Docker Engine and Docker Compose plugin
- **Local Mode**: System package manager (apt, yum, dnf)

## Quick Start

### Option 1: Automated Installation

The installer script handles all setup automatically:

```bash
# If not cloned yet, installer will clone the repo
curl -fsSL https://raw.githubusercontent.com/PhamTy2002z/FlowGrid/main/install.sh | bash

# If already cloned
./install.sh
```

The installer will:
1. Detect your operating system
2. Check for required dependencies
3. Install missing dependencies (with permission)
4. Prompt for deployment mode (docker or local)
5. Generate environment files
6. Bootstrap and start the selected deployment

### Option 2: Manual Installation

Follow the steps below for manual setup and deployment.

## Environment Configuration

### Step 1: Copy Environment Templates

```bash
# Root environment file
cp .env.example .env

# Backend environment file
cp backend/.env.example backend/.env

# Frontend environment file
cp frontend/.env.example frontend/.env
```

### Step 2: Configure Authentication Mode

FlowGrid supports two authentication modes:

#### Local Bearer Token Mode (Default)

For development and internal staging deployments with shared token authentication:

```bash
# In .env file
AUTH_MODE=local
LOCAL_AUTH_TOKEN=your-secure-token-minimum-50-characters-long-random-string
```

**Important**: Generate a secure random token:
```bash
# Generate a secure token
openssl rand -base64 48
```

#### Clerk JWT Mode

For multi-user authentication with Clerk:

```bash
# In .env file
AUTH_MODE=clerk
CLERK_SECRET_KEY=your-clerk-secret-key

# In frontend/.env file
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your-clerk-publishable-key
```

### Step 3: Configure API URL

```bash
# In .env file
NEXT_PUBLIC_API_URL=auto  # Default: auto-detects from current host

# For custom API URL (behind reverse proxy)
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

### Step 4: Database Configuration

```bash
# In backend/.env file
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/openclaw

# For Docker mode, use service name
DATABASE_URL=postgresql+asyncpg://postgres:postgres@db:5432/openclaw
```

### Step 5: Redis Configuration

```bash
# In backend/.env file
REDIS_URL=redis://localhost:6379/0

# For Docker mode, use service name
REDIS_URL=redis://redis:6379/0
```

### Step 6: Organization invite email configuration (optional)

Invite email delivery is disabled by default. Enable it only after you verify
sender/domain readiness in Resend.

```bash
# In backend/.env file (or root .env for Docker compose overrides)
EMAIL_PROVIDER=none
# EMAIL_PROVIDER=resend
# RESEND_API_KEY=re_xxx
# RESEND_WEBHOOK_SECRET=whsec_xxx
# EMAIL_FROM_INVITES=FlowGrid <noreply@example.com>
# EMAIL_REPLY_TO=support@example.com
# INVITE_ACCEPT_BASE_URL=https://app.example.com/invite
```

Rollout sequence:
1. Deploy with `EMAIL_PROVIDER=none`.
2. Confirm invite create/accept still works with copy-link fallback.
3. Enable `EMAIL_PROVIDER=resend` in staging and run a real inbox smoke test.
4. Promote the same config to production.

Rollback:
1. Set `EMAIL_PROVIDER=none`.
2. Restart backend and worker.
3. Continue using invite copy-link flow while provider issues are triaged.

### Step 7: OpenClaw Gateway Configuration (optional)

OpenClaw Docker gateway is auto-started in compose.yml. Configure workspace mounting:

```bash
# In .env file
MANAGED_GATEWAY_WORKSPACE_ROOT=/var/openclaw/workspace
MANAGED_GATEWAY_AUTO_PROVISION=true
MANAGED_GATEWAY_URL=http://openclaw:18789
```

Gateway health check: `GET http://localhost:18789/health` (verify port 18789 accessible)

Model providers auto-configured:
- `gpt-5.1-codex-mini` (fast)
- `gpt-5.3-codex` (standard)
- `gpt-5.4-codex` (advanced)

## Docker Deployment

### Standard Deployment

Start all services:

```bash
docker compose -f compose.yml --env-file .env up -d --build
```

### Development with Hot Reload

For frontend development with automatic rebuilds:

```bash
# Start with watch mode
docker compose -f compose.yml --env-file .env up --build --watch

# Or start normally, then enable watch
docker compose -f compose.yml --env-file .env up -d --build
docker compose -f compose.yml --env-file .env watch
```

**Note**: Compose Watch requires Docker Compose 2.22.0+

### Rebuild After Updates

After pulling new changes:

```bash
# Standard rebuild
docker compose -f compose.yml --env-file .env up -d --build --force-recreate

# Full clean rebuild (no cache)
docker compose -f compose.yml --env-file .env build --no-cache --pull
docker compose -f compose.yml --env-file .env up -d --force-recreate
```

### View Logs

```bash
# All services
docker compose -f compose.yml --env-file .env logs -f

# Specific service
docker compose -f compose.yml --env-file .env logs -f backend
docker compose -f compose.yml --env-file .env logs -f frontend
```

### Stop Services

```bash
# Stop all services
docker compose -f compose.yml --env-file .env down

# Stop and remove volumes (WARNING: deletes data)
docker compose -f compose.yml --env-file .env down -v
```

## Local Development Deployment

### Step 1: Install Dependencies

#### Backend Dependencies

```bash
cd backend

# Create virtual environment
python3.12 -m venv .venv

# Activate virtual environment
source .venv/bin/activate  # macOS/Linux

# Install dependencies
pip install -e ".[dev]"
```

#### Frontend Dependencies

```bash
cd frontend

# Install dependencies
npm install
# or
pnpm install
# or
yarn install
```

### Step 2: Start Database and Redis

#### Using Docker

```bash
# Start only database and redis
docker compose -f compose.yml --env-file .env up -d db redis
```

#### Using Local Installation

```bash
# macOS with Homebrew
brew services start postgresql@14
brew services start redis

# Linux with systemd
sudo systemctl start postgresql
sudo systemctl start redis
```

### Step 3: Run Database Migrations

```bash
cd backend

# Activate virtual environment
source .venv/bin/activate

# Run migrations
alembic upgrade head
```

### Step 4: Start Backend

```bash
cd backend

# Activate virtual environment
source .venv/bin/activate

# Start backend with auto-reload
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Step 5: Start RQ Worker

In a separate terminal:

```bash
cd backend

# Activate virtual environment
source .venv/bin/activate

# Start RQ worker
rq worker --url redis://localhost:6379/0
```

### Step 6: Start Frontend

In a separate terminal:

```bash
cd frontend

# Start frontend with Turbopack
npm run dev
# or
pnpm dev
# or
yarn dev
```

## Accessing the Application

### Default URLs

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/healthz

### First-Time Setup

1. Navigate to http://localhost:3000
2. Sign in (authentication depends on AUTH_MODE)
3. Complete onboarding flow
4. Create your first organization
5. Create your first board

## Database Management

### Running Migrations

```bash
cd backend

# Upgrade to latest
alembic upgrade head

# Downgrade one version
alembic downgrade -1

# View migration history
alembic history

# View current version
alembic current
```

### Creating New Migrations

```bash
cd backend

# Auto-generate migration from model changes
alembic revision --autogenerate -m "description of changes"

# Create empty migration
alembic revision -m "description of changes"
```

### Database Backup

```bash
# Docker mode
docker compose -f compose.yml --env-file .env exec db pg_dump -U postgres openclaw > backup.sql

# Local mode
pg_dump -U postgres openclaw > backup.sql
```

### Database Restore

```bash
# Docker mode
docker compose -f compose.yml --env-file .env exec -T db psql -U postgres openclaw < backup.sql

# Local mode
psql -U postgres openclaw < backup.sql
```

## Production Deployment

### Security Checklist

- [ ] Generate secure random token for LOCAL_AUTH_TOKEN (minimum 50 characters)
- [ ] Use HTTPS with valid SSL certificate
- [ ] Configure CORS allowed origins
- [ ] Set secure database password
- [ ] Enable database connection encryption
- [ ] Configure firewall rules
- [ ] Set up regular automated backups
- [ ] Enable audit logging
- [ ] Review and harden Docker security settings
- [ ] Implement rate limiting at reverse proxy level

### Reverse Proxy Configuration

#### Nginx Example

```nginx
upstream backend {
    server localhost:8000;
}

upstream frontend {
    server localhost:3000;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Frontend
    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket for gateways
    location /ws/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

#### Traefik Example

```yaml
# docker-compose.yml additions
services:
  traefik:
    image: traefik:v2.10
    command:
      - "--api.insecure=true"
      - "--providers.docker=true"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.myresolver.acme.tlschallenge=true"
      - "--certificatesresolvers.myresolver.acme.email=your@email.com"
      - "--certificatesresolvers.myresolver.acme.storage=/letsencrypt/acme.json"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - "/var/run/docker.sock:/var/run/docker.sock:ro"
      - "./letsencrypt:/letsencrypt"

  frontend:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.frontend.rule=Host(`yourdomain.com`)"
      - "traefik.http.routers.frontend.entrypoints=websecure"
      - "traefik.http.routers.frontend.tls.certresolver=myresolver"

  backend:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.backend.rule=Host(`yourdomain.com`) && PathPrefix(`/api`)"
      - "traefik.http.routers.backend.entrypoints=websecure"
      - "traefik.http.routers.backend.tls.certresolver=myresolver"
```

### Environment Variables for Production

```bash
# .env
NODE_ENV=production
PYTHON_ENV=production

# Security
AUTH_MODE=clerk  # or local with strong token
LOCAL_AUTH_TOKEN=<secure-random-token-minimum-50-chars>

# Database
DATABASE_URL=postgresql+asyncpg://user:password@db-host:5432/openclaw
DATABASE_POOL_SIZE=20
DATABASE_MAX_OVERFLOW=10

# Redis
REDIS_URL=redis://redis-host:6379/0

# CORS
CORS_ORIGINS=https://yourdomain.com

# Logging
LOG_LEVEL=INFO

# API
NEXT_PUBLIC_API_URL=https://yourdomain.com

# Managed gateway auto-provision (new organizations: free + paid)
MANAGED_GATEWAY_AUTO_PROVISION=true
MANAGED_GATEWAY_URL=wss://gateway.yourdomain.com/ws
MANAGED_GATEWAY_TOKEN=<gateway-token>
MANAGED_GATEWAY_WORKSPACE_ROOT=/srv/openclaw/managed
MANAGED_GATEWAY_DISABLE_DEVICE_PAIRING=false
```

> **Note:** Keep `MANAGED_GATEWAY_DISABLE_DEVICE_PAIRING=false` unless your
> gateway is explicitly configured for control UI auth bypass and
> `gateway.controlUi.allowedOrigins`.

### Resource Recommendations

#### Minimum Production Resources
- **CPU**: 2 cores
- **RAM**: 4GB
- **Disk**: 20GB SSD
- **Network**: 100 Mbps

#### Recommended Production Resources
- **CPU**: 4 cores
- **RAM**: 8GB
- **Disk**: 50GB SSD
- **Network**: 1 Gbps

#### High-Traffic Production Resources
- **CPU**: 8+ cores
- **RAM**: 16GB+
- **Disk**: 100GB+ SSD
- **Network**: 1 Gbps+
- **Database**: Separate server with read replicas
- **Redis**: Separate server or cluster

## Monitoring and Health Checks

### Health Check Endpoints

```bash
# Backend health
curl http://localhost:8000/healthz

# Database connectivity
curl http://localhost:8000/healthz/db

# Redis connectivity
curl http://localhost:8000/healthz/redis
```

### Docker Health Checks

Health checks are configured in compose.yml:

```yaml
services:
  backend:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/healthz"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

### Monitoring Recommendations

- **Application Monitoring**: Sentry, Datadog, New Relic
- **Infrastructure Monitoring**: Prometheus + Grafana
- **Log Aggregation**: ELK Stack, Loki, CloudWatch
- **Uptime Monitoring**: UptimeRobot, Pingdom, StatusCake

## Troubleshooting

### Common Issues

#### Port Already in Use

```bash
# Find process using port
lsof -i :3000
lsof -i :8000

# Kill process
kill -9 <PID>
```

#### Database Connection Failed

```bash
# Check database is running
docker compose -f compose.yml --env-file .env ps db

# Check database logs
docker compose -f compose.yml --env-file .env logs db

# Verify connection string
echo $DATABASE_URL
```

#### Redis Connection Failed

```bash
# Check Redis is running
docker compose -f compose.yml --env-file .env ps redis

# Test Redis connection
redis-cli ping

# Check Redis logs
docker compose -f compose.yml --env-file .env logs redis
```

#### Frontend Build Errors

```bash
# Clear Next.js cache
cd frontend
rm -rf .next

# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Check Node.js version
node --version  # Should be 22+
```

#### Backend Import Errors

```bash
# Reinstall dependencies
cd backend
pip install -e ".[dev]" --force-reinstall

# Check Python version
python --version  # Should be 3.12+
```

### Debug Mode

#### Backend Debug Mode

```bash
# Set log level to DEBUG
export LOG_LEVEL=DEBUG

# Start with verbose logging
uvicorn app.main:app --reload --log-level debug
```

#### Frontend Debug Mode

```bash
# Enable Next.js debug mode
export DEBUG=*

# Start with verbose logging
npm run dev
```

## Backup and Restore

### Automated Backup Script

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/path/to/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Backup database
docker compose -f compose.yml --env-file .env exec -T db \
  pg_dump -U postgres openclaw > "$BACKUP_DIR/db_$TIMESTAMP.sql"

# Backup Redis (if needed)
docker compose -f compose.yml --env-file .env exec -T redis \
  redis-cli --rdb /data/dump.rdb

# Backup environment files
cp .env "$BACKUP_DIR/env_$TIMESTAMP"

# Compress backups older than 7 days
find "$BACKUP_DIR" -name "*.sql" -mtime +7 -exec gzip {} \;

# Delete backups older than 30 days
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete
```

### Restore from Backup

```bash
# Stop services
docker compose -f compose.yml --env-file .env down

# Restore database
docker compose -f compose.yml --env-file .env up -d db
docker compose -f compose.yml --env-file .env exec -T db \
  psql -U postgres openclaw < backup.sql

# Start all services
docker compose -f compose.yml --env-file .env up -d
```

## Scaling Considerations

### Horizontal Scaling

To run multiple backend instances:

```yaml
# compose.yml
services:
  backend:
    deploy:
      replicas: 3
    # ... rest of config
```

Add load balancer (nginx, traefik, HAProxy) in front of backend instances.

### Database Scaling

- Enable connection pooling (already configured in SQLAlchemy)
- Add read replicas for read-heavy workloads
- Consider PostgreSQL connection pooler (PgBouncer)

### Redis Scaling

- Use Redis Cluster for distributed caching
- Separate Redis instances for cache vs job queue
- Consider Redis Sentinel for high availability

## Unresolved Questions

1. What is the recommended backup retention policy?
2. Should we provide Kubernetes deployment manifests?
3. What is the disaster recovery RTO/RPO target?
4. Should we support blue-green deployments?
5. What monitoring solution should be officially recommended?
