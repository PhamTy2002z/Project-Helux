# FlowGrid Production Deploy Guide

Full step-by-step guide to deploy FlowGrid + OpenClaw on Ubuntu laptop server with Cloudflare Tunnel + GitHub Actions CI/CD.

## Prerequisites

- Ubuntu Server 24.04 laptop (hostname: `flowgrid`, user: `phamty`)
- Docker (with at least **6GB memory** allocated) + cloudflared installed and tunnel active
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
git clone https://github.com/PhamTy2002z/FlowGrid.git Project-Helux
# Hoặc dùng SSH:
# git clone git@github.com:PhamTy2002z/FlowGrid.git Project-Helux
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

> **Note:** `compose.prod.yml` hardcodes several values (CORS_ORIGINS, BASE_URL,
> DB_AUTO_MIGRATE, DATABASE_URL, etc.) from `DOMAIN`. Only set variables that
> compose passes through via `${VAR}`. See `compose.prod.yml` for the full list.

> **Frontend env:** `NEXT_PUBLIC_*` vars are baked into the Next.js bundle at
> build time — they cannot be injected at runtime. Set them in `frontend/.env`
> on the build machine (Mac/CI) before building the frontend image. They do
> **not** need to be in `.env.prod` on the server.

```bash
cd /opt/projects/Project-Helux

# Generate random passwords
PG_PASS=$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)
MINIO_PASS=$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)
AUTH_TOKEN=$(openssl rand -base64 48 | tr -d '/+=' | head -c 64)
GW_TOKEN=$(openssl rand -hex 24)

cat > .env.prod <<EOF
# FlowGrid Production — flowgrid.live
# See compose.prod.yml for which vars are passed to each container.
# NEXT_PUBLIC_* vars live in frontend/.env on the build machine, NOT here.

# --- Domain & images ---
DOMAIN=flowgrid.live
GHCR_OWNER=phamty2002z
GHCR_IMAGE_TAG=latest

# --- Database (Postgres) ---
POSTGRES_DB=mission_control
POSTGRES_USER=postgres
POSTGRES_PASSWORD=${PG_PASS}

# --- Object storage (MinIO) ---
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=${MINIO_PASS}
OBJECT_STORAGE_BUCKET=board-chat-files

# --- Auth ---
AUTH_PROFILE=self_hosted
AUTH_MODE=local
LOCAL_AUTH_TOKEN=${AUTH_TOKEN}

# --- Logging ---
LOG_LEVEL=WARNING

# --- Billing & payments ---
BILLING_MODE=simulated
PAYMENT_PROVIDER=none
# Polar (required when PAYMENT_PROVIDER=polar):
# POLAR_ACCESS_TOKEN=polar_at_xxx
# POLAR_WEBHOOK_SECRET=whsec_xxx
# POLAR_PRODUCT_ID_PRO=1e83f145-db6f-41cb-ad76-00ba9d66a2f7
# POLAR_ENVIRONMENT=production
# POLAR_SUCCESS_URL=https://flowgrid.live/checkout/success?checkout_id={CHECKOUT_ID}

# --- Invite email (organization invite delivery only) ---
EMAIL_PROVIDER=none
# EMAIL_PROVIDER=resend
# RESEND_API_KEY=re_xxx
# EMAIL_FROM_INVITES=FlowGrid <noreply@flowgrid.live>
# EMAIL_REPLY_TO=support@flowgrid.live
# INVITE_ACCEPT_BASE_URL=https://flowgrid.live/invite

# --- Managed gateway ---
# Must match gateway.auth.token in openclaw/openclaw.json
MANAGED_GATEWAY_AUTO_PROVISION=true
MANAGED_GATEWAY_TOKEN=${GW_TOKEN}

# --- Worker & readiness ---
WORKER_HEARTBEAT_KEY=mission-control:worker:heartbeat
READINESS_WORKER_HEARTBEAT_KEY=mission-control:worker:heartbeat
EOF

chmod 600 .env.prod
```

### Step 2.1b — Chuẩn bị frontend/.env trên build machine (Mac)

Edit `frontend/.env` before building the frontend image. Key production values:

```env
NEXT_PUBLIC_API_URL=https://api.flowgrid.live
NEXT_PUBLIC_AUTH_MODE=local
NEXT_PUBLIC_AUTH_PROFILE=self_hosted
NEXT_PUBLIC_SITE_URL=https://flowgrid.live
NEXT_PUBLIC_BOARD_PLANNING_OVERLAY_V1=false
NEXT_PUBLIC_BOARD_QUERY_V2=false
# NEXT_PUBLIC_CLERK_* — only needed when AUTH_MODE=clerk
```

All vars in `frontend/.env.example` are accepted as build ARGs in `frontend/Dockerfile`.

### Step 2.2 — Ghi lại LOCAL_AUTH_TOKEN và MANAGED_GATEWAY_TOKEN

```bash
grep -E '(LOCAL_AUTH_TOKEN|MANAGED_GATEWAY_TOKEN)' .env.prod
# Copy LOCAL_AUTH_TOKEN — cần dùng khi login vào FlowGrid UI
# Copy MANAGED_GATEWAY_TOKEN — cần set vào openclaw config (Phase 7)
```

### Step 2.3 — Lấy cấu hình Resend trên dashboard

1. Mở Resend dashboard: `https://resend.com`
2. Vào **API Keys** -> **Create API Key** -> copy key dạng `re_...`
3. Vào **Domains** -> chọn `flowgrid.live` (status phải là **Verified**)
4. Chọn địa chỉ gửi tại domain đã verify:
   `FlowGrid <noreply@flowgrid.live>` cho `EMAIL_FROM_INVITES`
5. (Optional) Chọn mailbox nhận phản hồi cho `EMAIL_REPLY_TO`, for example
   `support@flowgrid.live`

> Note: scope hiện tại chỉ cần gửi outbound invite email. `RESEND_WEBHOOK_SECRET`
> chưa bắt buộc vì backend chưa dùng inbound Resend webhook.

### Step 2.4 — Bật Resend trong `.env.prod` (khi đã sẵn sàng production)

```bash
cd /opt/projects/Project-Helux
nano .env.prod
```

Set giá trị như sau:

```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_xxx
EMAIL_FROM_INVITES=FlowGrid <noreply@flowgrid.live>
EMAIL_REPLY_TO=support@flowgrid.live
INVITE_ACCEPT_BASE_URL=https://flowgrid.live/invite
# Optional (reserved for future inbound webhook support):
# RESEND_WEBHOOK_SECRET=whsec_xxx
```

Các biến bắt buộc khi `EMAIL_PROVIDER=resend`:
- `RESEND_API_KEY`
- `EMAIL_FROM_INVITES`
- `INVITE_ACCEPT_BASE_URL`

Restart backend + worker để nhận env mới:

```bash
cd /opt/projects/Project-Helux
docker compose -f compose.prod.yml --env-file .env.prod restart backend webhook-worker
```

### Step 2.5 — Bật Polar billing trong `.env.prod`

```bash
nano .env.prod
```

Set giá trị:

```env
BILLING_MODE=provider
PAYMENT_PROVIDER=polar
POLAR_ACCESS_TOKEN=polar_at_xxx
POLAR_WEBHOOK_SECRET=whsec_xxx
POLAR_PRODUCT_ID_PRO=1e83f145-db6f-41cb-ad76-00ba9d66a2f7
POLAR_ENVIRONMENT=production
POLAR_SUCCESS_URL=https://flowgrid.live/checkout/success?checkout_id={CHECKOUT_ID}
```

Các biến bắt buộc khi `PAYMENT_PROVIDER=polar`:
- `POLAR_ACCESS_TOKEN`
- `POLAR_WEBHOOK_SECRET`
- `POLAR_PRODUCT_ID_PRO`

Restart backend:

```bash
cd /opt/projects/Project-Helux
docker compose -f compose.prod.yml --env-file .env.prod restart backend
```

### Step 2.6 — Verify env blocks

```bash
# Check Resend vars
grep -E '^(EMAIL_PROVIDER|RESEND_API_KEY|EMAIL_FROM_INVITES|EMAIL_REPLY_TO|INVITE_ACCEPT_BASE_URL)=' .env.prod

# Check Polar vars
grep -E '^(BILLING_MODE|PAYMENT_PROVIDER|POLAR_)' .env.prod
```

---

## Phase 3: Copy compose.prod.yml lên server

### Step 3.1 — Từ Mac (dev machine)

```bash
scp compose.prod.yml phamty@192.168.1.5:/opt/projects/Project-Helux/
```

### Step 3.2 — Verify trên server

```bash
ssh phamty@192.168.1.5
ls -la /opt/projects/Project-Helux/
# Should see: compose.prod.yml  .env.prod  backend/  frontend/  ...
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

Add **Repository secrets** — these are injected as build args when CI builds
the frontend image (`NEXT_PUBLIC_*` are baked into the Next.js bundle):

| Secret | Value |
|--------|-------|
| `NEXT_PUBLIC_API_URL` | `https://api.flowgrid.live` |
| `NEXT_PUBLIC_AUTH_MODE` | `local` |
| `NEXT_PUBLIC_AUTH_PROFILE` | `self_hosted` |
| `NEXT_PUBLIC_SITE_URL` | `https://flowgrid.live` |
| `NEXT_PUBLIC_BOARD_PLANNING_OVERLAY_V1` | `false` |
| `NEXT_PUBLIC_BOARD_QUERY_V2` | `false` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | _(leave empty unless AUTH_MODE=clerk)_ |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | `/boards` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_OUT_URL` | `/` |

> Note: `GITHUB_TOKEN` tự động có sẵn, không cần add.
>
> These secrets must be passed as `--build-arg` in the CI workflow's
> `docker build` step for frontend. See `frontend/Dockerfile` for the full
> ARG list.

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

# Build backend (context: repo root)
docker build -t ghcr.io/phamty2002z/flowgrid-backend:latest -f backend/Dockerfile .

# Build frontend — NEXT_PUBLIC_* baked at build time, inject from frontend/.env
# frontend/Dockerfile accepts all vars as ARGs; compose.yml wires them automatically
env $(grep -E '^NEXT_PUBLIC_' frontend/.env | xargs) \
  docker compose --profile docker-frontend build frontend

docker tag project-helux-frontend:latest ghcr.io/phamty2002z/flowgrid-frontend:latest

# Push
docker push ghcr.io/phamty2002z/flowgrid-backend:latest
docker push ghcr.io/phamty2002z/flowgrid-frontend:latest
```

### Step 6.3 — Pull và start trên laptop server

```bash
ssh phamty@192.168.1.5
cd /opt/projects/Project-Helux

# Pull images
docker compose -f compose.prod.yml --env-file .env.prod pull

# Start all services (frontend requires --profile docker-frontend)
docker compose -f compose.prod.yml --env-file .env.prod --profile docker-frontend up -d

# Watch logs
docker compose -f compose.prod.yml --env-file .env.prod --profile docker-frontend logs -f
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

## Phase 6b: Database Migrations

Migrations run automatically on startup when `DB_AUTO_MIGRATE=true` (default in
compose). If auto-migrate is disabled or you want to run migrations manually:

```bash
ssh phamty@192.168.1.5
cd /opt/projects/Project-Helux

docker compose -f compose.prod.yml --env-file .env.prod exec backend \
  alembic upgrade head
```

### Notable migration: CASCADE delete on agent_token_daily_usage

Migration `95fef896018c_cascade_delete_agent_token_daily_usage_.py` adds
`ON DELETE CASCADE` to `agent_token_daily_usage.agent_id` FK. This migration
must run before deleting agents — otherwise deleting an agent with daily usage
records will fail with a FK constraint error.

If upgrading an existing deployment, verify migration has been applied:

```bash
docker compose -f compose.prod.yml --env-file .env.prod exec backend \
  alembic current
# Should include: 95fef896018c (head)
```

---

## Phase 7: OpenClaw Gateway (Docker)

OpenClaw chạy trong Docker cùng stack. No public registry image — phải build
từ source. Config mount qua directory bind mount (không mount single file vì
Docker atomic rename issue trên macOS/Linux).

### Architecture

```
compose.prod.yml
├── openclaw service
│   ├── image: openclaw/gateway:latest (built from source)
│   ├── command: --bind lan --allow-unconfigured
│   ├── OPENCLAW_CONFIG_PATH=/data/config/openclaw.json
│   ├── OPENCLAW_STATE_DIR=/data/.openclaw
│   ├── volumes:
│   │   ├── openclaw_data:/data          (state, sessions, agents)
│   │   ├── device_identity:/shared/...  (shared with backend)
│   │   └── ./openclaw:/data/config      (config directory bind mount)
│   └── port: 127.0.0.1:18789
├── backend → ws://openclaw:18789/ws
└── webhook-worker → ws://openclaw:18789/ws
```

### Step 7.1 — Build OpenClaw image (lần đầu)

> **Yêu cầu:** Docker cần ít nhất **6GB RAM** để build (pnpm build rất nặng).
> Trên Ubuntu server, kiểm tra: `docker system info | grep "Total Memory"`.

```bash
ssh phamty@192.168.1.5

# Clone openclaw source (one-time build only)
cd /tmp
git clone https://github.com/openclaw/openclaw.git
cd openclaw

# Build image
docker build -t openclaw/gateway:latest .

# Cleanup source after build
cd /opt/projects/Project-Helux
rm -rf /tmp/openclaw
```

### Step 7.2 — Tạo openclaw config directory

```bash
cd /opt/projects/Project-Helux
mkdir -p openclaw
```

### Step 7.3 — Tạo openclaw config cho production

`compose.prod.yml` mount `./openclaw` → `/data/config` trong container.
Config file: `openclaw/openclaw.json` (not `.prod.json` — compose reads this name).

> **IMPORTANT:** `MANAGED_GATEWAY_TOKEN` trong `.env.prod` phải **khớp** với
> `gateway.auth.token` trong config file.

```bash
cd /opt/projects/Project-Helux

# Lấy gateway token đã tạo ở Step 2.1
GW_TOKEN=$(grep MANAGED_GATEWAY_TOKEN .env.prod | cut -d= -f2)
echo "Gateway token: ${GW_TOKEN}"

cat > openclaw/openclaw.json <<OCEOF
{
  "models": {
    "mode": "merge",
    "providers": {
      "custom-model": {
        "baseUrl": "http://CLIPROXY_HOST_IP:8317/api/provider/codex",
        "apiKey": "ccs-internal-managed",
        "api": "anthropic-messages",
        "models": [
          {
            "id": "gpt-5.4",
            "name": "gpt-5.4 (Custom Provider)",
            "api": "anthropic-messages",
            "reasoning": false,
            "input": ["text"],
            "cost": {"input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0},
            "contextWindow": 1000000,
            "maxTokens": 24384
          }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {"primary": "custom-model/gpt-5.4"},
      "contextTokens": 400000,
      "compaction": {"mode": "safeguard"}
    }
  },
  "tools": {
    "profile": "full",
    "exec": {"host": "gateway", "security": "full"}
  },
  "gateway": {
    "port": 18789,
    "mode": "local",
    "bind": "lan",
    "controlUi": {
      "dangerouslyAllowHostHeaderOriginFallback": true
    },
    "auth": {
      "mode": "token",
      "token": "${GW_TOKEN}"
    }
  }
}
OCEOF

chmod 600 openclaw/openclaw.json
```

> **Note:** Thay `CLIPROXY_HOST_IP` bằng IP thực của host nếu cliproxy chạy
> trên server. Trên Linux production, **KHÔNG** dùng `host.docker.internal`
> (chỉ macOS/Windows). Dùng `172.17.0.1` (Docker bridge gateway) hoặc
> thêm `extra_hosts: ["host.docker.internal:host-gateway"]` vào compose.

### Step 7.4 — Fix volume permissions

Container chạy dưới user `node` (uid 1000). Volume `/data` mặc định owned by
root → cần fix permissions lần đầu:

```bash
# Chạy 1 lần sau khi tạo volume
docker compose -f compose.prod.yml --env-file .env.prod up -d openclaw
docker compose -f compose.prod.yml --env-file .env.prod stop openclaw

# Fix permissions
docker run --rm \
  -v flowgrid-prod_openclaw_data:/data \
  alpine sh -c "mkdir -p /data/.openclaw && chown -R 1000:1000 /data/.openclaw /data"

# Start lại
docker compose -f compose.prod.yml --env-file .env.prod up -d openclaw
```

### Step 7.5 — Onboard gateway + device pairing

```bash
cd /opt/projects/Project-Helux

# Chạy onboard wizard
docker compose -f compose.prod.yml --env-file .env.prod exec -it openclaw openclaw onboard
# Lưu ý:
# - Model provider: chọn Custom Provider
# - Base URL: dùng IP thực (không dùng host.docker.internal trên Linux)
# - Channel: Skip for now (hoặc chọn channel nếu cần)
```

### Step 7.6 — Verify gateway

```bash
cd /opt/projects/Project-Helux

# Check container health
docker compose -f compose.prod.yml --env-file .env.prod ps openclaw
# Expected: openclaw  running (healthy)

# Test healthz endpoint
curl -s http://localhost:18789/healthz
# Expected: {"ok":true,"status":"live"}

# Check backend connects to gateway
docker compose -f compose.prod.yml --env-file .env.prod logs backend | grep -i gateway
# Expected: no connection errors
```

### Step 7.7 — Approve device pairing (lần đầu truy cập Control UI)

Khi mở Control UI (http://localhost:18789), nhập gateway token, nếu thấy
"pairing required":

```bash
# List pending requests
docker compose -f compose.prod.yml --env-file .env.prod exec openclaw \
  openclaw devices list

# Approve request
docker compose -f compose.prod.yml --env-file .env.prod exec openclaw \
  openclaw devices approve <REQUEST_ID>
```

Refresh browser sau khi approve → Control UI sẽ connect.

### Step 7.8 — Update OpenClaw image

Khi cần update gateway version:

```bash
cd /tmp
git clone https://github.com/openclaw/openclaw.git
cd openclaw && git checkout v2026.x.x  # specific version
docker build -t openclaw/gateway:latest .
rm -rf /tmp/openclaw

cd /opt/projects/Project-Helux
docker compose -f compose.prod.yml --env-file .env.prod up -d openclaw
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

> **Note:** CI/CD chỉ deploy backend + frontend + webhook-worker.
> OpenClaw gateway image phải build thủ công (Step 7.8) vì không có public registry.

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
cd /opt/projects/Project-Helux

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
cd /opt/projects/Project-Helux

# Restart app only (db/redis/minio/openclaw stay up)
docker compose -f compose.prod.yml --env-file .env.prod --profile docker-frontend \
  restart backend webhook-worker frontend

# Restart everything
docker compose -f compose.prod.yml --env-file .env.prod --profile docker-frontend restart
```

### Stop everything

```bash
cd /opt/projects/Project-Helux
docker compose -f compose.prod.yml --env-file .env.prod --profile docker-frontend down
```

### Manual deploy (without CI/CD)

```bash
cd /opt/projects/Project-Helux
docker compose -f compose.prod.yml --env-file .env.prod --profile docker-frontend pull
docker compose -f compose.prod.yml --env-file .env.prod --profile docker-frontend \
  up -d --no-deps backend webhook-worker frontend
```

### Database backup

```bash
cd /opt/projects/Project-Helux
docker compose -f compose.prod.yml --env-file .env.prod exec db \
  pg_dump -U postgres mission_control > backup-$(date +%Y%m%d).sql
```

### Database restore

```bash
cd /opt/projects/Project-Helux
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

- `NEXT_PUBLIC_API_URL` is baked at **build time** — verify the image was built
  with the correct value: `docker inspect <image> | grep NEXT_PUBLIC_API_URL`
- If wrong, rebuild the frontend image with the correct `frontend/.env` and
  use `env $(grep -E '^NEXT_PUBLIC_' frontend/.env | xargs) docker compose --profile docker-frontend build frontend`
- Check `CORS_ORIGINS` in backend = `https://flowgrid.live` (set via DOMAIN in compose.prod.yml)
- Check cloudflared config has `api.flowgrid.live` entry

### Frontend container not starting (profile not activated)

The frontend service requires `--profile docker-frontend`. Without it, `docker compose up`
silently skips the frontend container. Always include the flag:

```bash
docker compose -f compose.prod.yml --env-file .env.prod --profile docker-frontend up -d
```

### Billing/payments not working

- Verify vars passed to container: `docker compose -f compose.prod.yml --env-file .env.prod exec backend env | grep POLAR`
- Must have: `BILLING_MODE=provider`, `PAYMENT_PROVIDER=polar`, and all `POLAR_*` vars set

### OpenClaw gateway won't start

```bash
# Check logs
docker compose -f compose.prod.yml --env-file .env.prod logs openclaw

# Common issues:
# 1. "non-loopback Control UI requires..." → config missing controlUi.dangerouslyAllowHostHeaderOriginFallback
# 2. "EACCES: permission denied, mkdir '/data/.openclaw'" → run volume permission fix (Step 7.4)
# 3. "unauthorized: gateway token mismatch" → MANAGED_GATEWAY_TOKEN in .env.prod must match gateway.auth.token in config
```

### OpenClaw Control UI "pairing required"

```bash
# Approve device from inside container
docker compose -f compose.prod.yml --env-file .env.prod exec openclaw openclaw devices list
docker compose -f compose.prod.yml --env-file .env.prod exec openclaw openclaw devices approve <REQUEST_ID>
```

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
