# FlowGrid Production Deploy Guide

Full step-by-step guide to deploy FlowGrid + OpenClaw on Ubuntu laptop server with Cloudflare Tunnel + GitHub Actions CI/CD.

## Prerequisites

- Ubuntu Server 24.04 laptop (hostname: `flowgrid`, user: `phamty`)
- Docker + cloudflared already installed and tunnel active
- Domain `flowgrid.live` on Cloudflare (tunnel working)
- GitHub repo: `PhamTy2002z/FlowGrid`
- Mac (dev machine) can SSH to laptop: `ssh phamty@192.168.1.5`

---

## Phase 1: Laptop Server Setup

### Step 1.1 — SSH vào laptop server

```bash
ssh phamty@192.168.1.5
```

### Step 1.2 — Tạo project directory

```bash
sudo mkdir -p /opt/projects
sudo chown phamty:phamty /opt/projects
```

### Step 1.3 — Clone source code

```bash
cd /opt/projects
git clone https://github.com/PhamTy2002z/FlowGrid.git .
# Hoặc dùng SSH:
# git clone git@github.com:PhamTy2002z/FlowGrid.git .
```

### Step 1.4 — Update cloudflared config thêm api subdomain

```bash
sudo nano /etc/cloudflared/config.yml
```

Sửa thành:

```yaml
tunnel: 6d5407d7-b3a7-4d7b-b9be-5c04af0e23b9
credentials-file: /home/phamty/.cloudflared/6d5407d7-b3a7-4d7b-b9be-5c04af0e23b9.json

ingress:
  - hostname: flowgrid.live
    service: http://localhost:3000
  - hostname: api.flowgrid.live
    service: http://localhost:8000
    originRequest:
      connectTimeout: 30s
      noTLSVerify: false
  - service: http_status:404
```

### Step 1.5 — Route DNS cho api subdomain + restart tunnel

```bash
cloudflared tunnel route dns flowgrid api.flowgrid.live
sudo systemctl restart cloudflared
sudo systemctl status cloudflared  # Verify: active (running)
```

---

## Phase 2: Generate Production Secrets

### Step 2.1 — Tạo .env.prod

```bash
cd /opt/projects

# Generate random passwords
PG_PASS=$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)
MINIO_PASS=$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)
AUTH_TOKEN=$(openssl rand -base64 48 | tr -d '/+=' | head -c 64)

cat > .env.prod <<EOF
# FlowGrid Production — flowgrid.live

DOMAIN=flowgrid.live
GHCR_OWNER=phamty2002z
GHCR_IMAGE_TAG=latest

# Database
POSTGRES_DB=mission_control
POSTGRES_USER=postgres
POSTGRES_PASSWORD=${PG_PASS}

# MinIO
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=${MINIO_PASS}
OBJECT_STORAGE_BUCKET=board-chat-files

# Auth
AUTH_PROFILE=self_hosted
AUTH_MODE=local
LOCAL_AUTH_TOKEN=${AUTH_TOKEN}

# Backend
LOG_LEVEL=WARNING
RATE_LIMIT_ENABLED=true

# OpenClaw Gateway
MANAGED_GATEWAY_AUTO_PROVISION=true
MANAGED_GATEWAY_URL=ws://openclaw:18789/ws
MANAGED_GATEWAY_TOKEN=

# Worker
WORKER_HEARTBEAT_KEY=mission-control:worker:heartbeat
READINESS_WORKER_HEARTBEAT_KEY=mission-control:worker:heartbeat
EOF

chmod 600 .env.prod
```

### Step 2.2 — Ghi lại LOCAL_AUTH_TOKEN

```bash
grep LOCAL_AUTH_TOKEN .env.prod
# Copy giá trị này — cần dùng khi login vào FlowGrid UI
```

---

## Phase 3: Copy compose.prod.yml lên server

### Step 3.1 — Từ Mac (dev machine)

```bash
scp compose.prod.yml phamty@192.168.1.5:/opt/projects/
```

### Step 3.2 — Verify trên server

```bash
ssh phamty@192.168.1.5
ls -la /opt/projects/
# Should see: compose.prod.yml  .env.prod
```

---

## Phase 4: GitHub Actions Self-Hosted Runner

### Step 4.1 — Lấy runner token từ GitHub

1. Mở browser: `https://github.com/PhamTy2002z/FlowGrid/settings/actions/runners/new`
2. Chọn **Linux**, **x64**
3. Copy token hiển thị (dùng ở bước 4.3)

### Step 4.2 — Download runner trên laptop server

```bash
ssh phamty@192.168.1.5

mkdir -p ~/actions-runner && cd ~/actions-runner

# Download latest runner (check version mới nhất tại GitHub)
curl -o actions-runner-linux-x64-2.322.0.tar.gz -L \
  https://github.com/actions/runner/releases/download/v2.322.0/actions-runner-linux-x64-2.322.0.tar.gz

tar xzf actions-runner-linux-x64-2.322.0.tar.gz
```

### Step 4.3 — Configure runner

```bash
cd ~/actions-runner

./config.sh \
  --url https://github.com/PhamTy2002z/FlowGrid \
  --token <RUNNER_TOKEN_TU_BUOC_4.1> \
  --name flowgrid-laptop \
  --labels self-hosted,linux,x64,production \
  --work /opt/projects/_work \
  --runasservice
```

Khi hỏi:
- Runner group: **Enter** (default)
- Runner name: `flowgrid-laptop`
- Work folder: `/opt/projects/_work`

### Step 4.4 — Install as systemd service (auto-start on boot)

```bash
cd ~/actions-runner
sudo ./svc.sh install phamty
sudo ./svc.sh start
sudo ./svc.sh status  # Verify: active (running)
```

### Step 4.5 — Verify runner online

1. Mở: `https://github.com/PhamTy2002z/FlowGrid/settings/actions/runners`
2. Runner `flowgrid-laptop` hiển thị **Idle** = OK

---

## Phase 5: GitHub Secrets

### Step 5.1 — Add secrets

Mở: `https://github.com/PhamTy2002z/FlowGrid/settings/secrets/actions`

Add **Repository secrets**:

| Secret | Value |
|--------|-------|
| `NEXT_PUBLIC_API_URL` | `https://api.flowgrid.live` |

> Note: `GITHUB_TOKEN` tự động có sẵn, không cần add.

### Step 5.2 — Create "production" environment

1. Mở: `https://github.com/PhamTy2002z/FlowGrid/settings/environments`
2. Click **New environment** → name: `production`
3. (Optional) Enable **Required reviewers** nếu muốn approve trước khi deploy

---

## Phase 6: First Manual Deploy (Test)

### Step 6.1 — Login GHCR trên laptop server

```bash
ssh phamty@192.168.1.5

# Tạo Personal Access Token (classic) tại:
# https://github.com/settings/tokens/new
# Scopes: read:packages, write:packages
echo "<GITHUB_PAT>" | docker login ghcr.io -u phamty2002z --password-stdin
```

### Step 6.2 — Build và push images từ Mac lần đầu

```bash
# Trên Mac (dev machine), tại project root
cd ~/Documents/GitHub/Project-Helux

# Login GHCR
echo "<GITHUB_PAT>" | docker login ghcr.io -u phamty2002z --password-stdin

# Build backend
docker build -t ghcr.io/phamty2002z/flowgrid-backend:latest -f backend/Dockerfile .

# Build frontend
docker build -t ghcr.io/phamty2002z/flowgrid-frontend:latest \
  --build-arg NEXT_PUBLIC_API_URL=https://api.flowgrid.live \
  --build-arg NEXT_PUBLIC_AUTH_MODE=local \
  frontend/

# Push
docker push ghcr.io/phamty2002z/flowgrid-backend:latest
docker push ghcr.io/phamty2002z/flowgrid-frontend:latest
```

### Step 6.3 — Pull và start trên laptop server

```bash
ssh phamty@192.168.1.5
cd /opt/projects

# Pull images
docker compose -f compose.prod.yml --env-file .env.prod pull

# Start all services
docker compose -f compose.prod.yml --env-file .env.prod up -d

# Watch logs
docker compose -f compose.prod.yml --env-file .env.prod logs -f
```

### Step 6.4 — Verify

```bash
# Check containers
docker compose -f compose.prod.yml --env-file .env.prod ps

# Test backend
curl http://localhost:8000/health
# Expected: {"status":"ok",...}

# Test frontend
curl -s http://localhost:3000 | head -5
# Expected: HTML content
```

### Step 6.5 — Test qua internet

Mở browser:
- `https://flowgrid.live` → Frontend load
- `https://api.flowgrid.live/health` → Backend health response
- `https://api.flowgrid.live/docs` → Swagger UI

---

## Phase 7: OpenClaw Gateway (Docker)

OpenClaw chạy trong Docker cùng stack, không cần cài trên host.

### Step 7.1 — Verify OpenClaw container running

```bash
ssh phamty@192.168.1.5
cd /opt/projects

# OpenClaw đã start cùng lúc với docker compose up ở Phase 6
docker compose -f compose.prod.yml --env-file .env.prod ps openclaw
# Expected: openclaw  running (healthy)

# Check logs
docker compose -f compose.prod.yml --env-file .env.prod logs openclaw
```

### Step 7.2 — Onboard gateway (lần đầu)

```bash
# Exec vào container để chạy onboard wizard
docker compose -f compose.prod.yml --env-file .env.prod exec openclaw openclaw onboard

# Hoặc nếu cần interactive terminal:
docker compose -f compose.prod.yml --env-file .env.prod exec -it openclaw sh
openclaw onboard
```

### Step 7.3 — Update MANAGED_GATEWAY_TOKEN (if needed)

Nếu OpenClaw onboard generate token:

```bash
nano /opt/projects/.env.prod
# Update: MANAGED_GATEWAY_TOKEN=<token_from_onboard>

# Restart backend + openclaw to pick up new token
cd /opt/projects
docker compose -f compose.prod.yml --env-file .env.prod restart openclaw backend webhook-worker
```

### Step 7.4 — Verify backend connects to gateway

```bash
# Check backend logs for gateway connection
docker compose -f compose.prod.yml --env-file .env.prod logs backend | grep -i gateway
# Expected: no connection errors
```

---

## Phase 8: Auto Deploy via CI/CD

Từ giờ, mỗi lần merge PR vào `main`:

```
Developer merge PR → main
    │
    ▼
GitHub Actions (cloud) — "build-and-push" job
    ├── Build backend Docker image
    ├── Build frontend Docker image
    └── Push cả 2 lên ghcr.io
    │
    ▼
GitHub Actions (self-hosted runner on laptop) — "deploy" job
    ├── docker compose pull (tải images mới)
    ├── docker compose up -d --no-deps (rolling restart app containers)
    └── docker image prune (dọn images cũ)
    │
    ▼
Live tại flowgrid.live trong ~30 giây
```

### Step 8.1 — Test CI/CD pipeline

```bash
# Trên Mac, tạo branch test
git checkout main
git checkout -b test/cicd-verify
echo "# CI/CD test" >> README.md
git add README.md
git commit -m "chore: verify CI/CD pipeline"
git push -u origin test/cicd-verify
```

1. Tạo PR → merge vào `main`
2. Xem Actions tab: `https://github.com/PhamTy2002z/FlowGrid/actions`
3. Verify cả 2 jobs pass: `build-and-push` + `deploy`
4. Check `https://flowgrid.live` load OK

---

## Operational Commands

### Xem logs

```bash
cd /opt/projects

# All services
docker compose -f compose.prod.yml --env-file .env.prod logs -f

# Specific service
docker compose -f compose.prod.yml --env-file .env.prod logs -f backend
docker compose -f compose.prod.yml --env-file .env.prod logs -f frontend
docker compose -f compose.prod.yml --env-file .env.prod logs -f webhook-worker
docker compose -f compose.prod.yml --env-file .env.prod logs -f openclaw
```

### Restart services

```bash
cd /opt/projects

# Restart app only (db/redis/minio/openclaw stay up)
docker compose -f compose.prod.yml --env-file .env.prod restart backend webhook-worker frontend

# Restart everything
docker compose -f compose.prod.yml --env-file .env.prod restart
```

### Stop everything

```bash
cd /opt/projects
docker compose -f compose.prod.yml --env-file .env.prod down
```

### Manual deploy (without CI/CD)

```bash
cd /opt/projects
docker compose -f compose.prod.yml --env-file .env.prod pull
docker compose -f compose.prod.yml --env-file .env.prod up -d --no-deps backend webhook-worker frontend
```

### Database backup

```bash
cd /opt/projects
docker compose -f compose.prod.yml --env-file .env.prod exec db \
  pg_dump -U postgres mission_control > backup-$(date +%Y%m%d).sql
```

### Database restore

```bash
cd /opt/projects
cat backup-20260314.sql | docker compose -f compose.prod.yml --env-file .env.prod exec -T db \
  psql -U postgres mission_control
```

### Check disk usage

```bash
# Docker disk
docker system df

# Cleanup
docker system prune -f --volumes  # WARNING: removes unused volumes too
docker image prune -f              # Safe: only dangling images
```

### Runner status

```bash
cd ~/actions-runner
sudo ./svc.sh status
```

### Tunnel status

```bash
sudo systemctl status cloudflared
sudo journalctl -u cloudflared -f  # Live logs
```

---

## Troubleshooting

### Container won't start

```bash
# Check logs
docker compose -f compose.prod.yml --env-file .env.prod logs backend

# Common: missing env var → check .env.prod
# Common: port conflict → lsof -i :8000
```

### Frontend shows "Failed to fetch"

- Check `NEXT_PUBLIC_API_URL` in frontend build = `https://api.flowgrid.live`
- Check `CORS_ORIGINS` in backend = `https://flowgrid.live`
- Check cloudflared config has `api.flowgrid.live` entry

### Runner offline

```bash
cd ~/actions-runner
sudo ./svc.sh status
# If stopped:
sudo ./svc.sh start
```

### Tunnel down

```bash
sudo systemctl status cloudflared
# If failed:
sudo systemctl restart cloudflared
sudo journalctl -u cloudflared --since "5 min ago"
```

### Out of disk

```bash
# Check
df -h

# Clean Docker
docker image prune -af  # Remove ALL unused images
docker builder prune -f  # Clear build cache
```
