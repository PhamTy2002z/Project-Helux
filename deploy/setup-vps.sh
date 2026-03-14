#!/usr/bin/env bash
# FlowGrid production setup for Ubuntu laptop server + Cloudflare Tunnel.
# Run as phamty (with sudo).
#
# Usage: sudo bash deploy/setup-vps.sh
#
# Prerequisites:
#   - Ubuntu Server 24.04 with Docker + cloudflared already installed
#   - Cloudflare Tunnel "flowgrid" already active for flowgrid.live
#
# What this does:
#   1. Create /opt/flowgrid directory
#   2. Generate .env.prod with secure random secrets
#   3. Update cloudflared config (add api.flowgrid.live)
#   4. Install GitHub Actions self-hosted runner
#   5. Print next steps
# Note: OpenClaw runs in Docker (compose.prod.yml), no host install needed.

set -euo pipefail

DOMAIN="flowgrid.live"
GITHUB_USER="<GITHUB_USER>"
GITHUB_REPO="<GITHUB_ORG>/<GITHUB_REPO>"
DEPLOY_USER="<DEPLOY_USER>"
TUNNEL_ID="<TUNNEL_ID>"

echo "==> Setting up FlowGrid production on $(hostname)"
echo "    Domain: ${DOMAIN}"
echo "    User:   ${DEPLOY_USER}"
echo ""

# --- 1. Create project directory ---
echo "==> [1/4] Creating /opt/flowgrid"
mkdir -p /opt/flowgrid
chown "${DEPLOY_USER}:${DEPLOY_USER}" /opt/flowgrid

# --- 2. Generate .env.prod ---
echo "==> [2/4] Generating .env.prod"
ENV_FILE="/opt/flowgrid/.env.prod"
if [ ! -f "$ENV_FILE" ]; then
  PG_PASS=$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)
  MINIO_PASS=$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)
  AUTH_TOKEN=$(openssl rand -base64 48 | tr -d '/+=' | head -c 64)

  cat > "$ENV_FILE" <<ENVEOF
# FlowGrid Production — flowgrid.live
# Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

DOMAIN=${DOMAIN}
GHCR_OWNER=${GITHUB_USER}
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
ENVEOF

  chmod 600 "$ENV_FILE"
  chown "${DEPLOY_USER}:${DEPLOY_USER}" "$ENV_FILE"
  echo "    .env.prod created — review before first deploy!"
else
  echo "    .env.prod already exists, skipping"
fi

# --- 3. Update cloudflared config ---
echo "==> [3/4] Updating cloudflared config"
CF_CONFIG="/etc/cloudflared/config.yml"
if [ -f "$CF_CONFIG" ]; then
  # Backup current config
  cp "$CF_CONFIG" "${CF_CONFIG}.bak.$(date +%s)"
fi

cat > "$CF_CONFIG" <<CFEOF
tunnel: ${TUNNEL_ID}
credentials-file: /home/${DEPLOY_USER}/.cloudflared/${TUNNEL_ID}.json

ingress:
  # Frontend (Next.js)
  - hostname: ${DOMAIN}
    service: http://localhost:3000

  # Backend API (FastAPI)
  - hostname: api.${DOMAIN}
    service: http://localhost:8000
    originRequest:
      connectTimeout: 30s
      noTLSVerify: false

  # Catch-all
  - service: http_status:404
CFEOF

echo "    cloudflared config updated"

# Route api subdomain DNS (idempotent)
cloudflared tunnel route dns flowgrid "api.${DOMAIN}" 2>/dev/null || true
echo "    DNS route: api.${DOMAIN} → tunnel"

# Restart tunnel
systemctl restart cloudflared
echo "    cloudflared restarted"

# --- 4. Setup GitHub Actions self-hosted runner ---
echo "==> [4/4] GitHub Actions runner setup"
RUNNER_DIR="/home/${DEPLOY_USER}/actions-runner"
if [ ! -d "$RUNNER_DIR" ]; then
  echo "    Creating runner directory..."
  mkdir -p "$RUNNER_DIR"
  chown "${DEPLOY_USER}:${DEPLOY_USER}" "$RUNNER_DIR"

  echo ""
  echo "    To install the runner, run AS ${DEPLOY_USER}:"
  echo "    cd ${RUNNER_DIR}"
  echo "    curl -o actions-runner-linux-x64-2.322.0.tar.gz -L https://github.com/actions/runner/releases/download/v2.322.0/actions-runner-linux-x64-2.322.0.tar.gz"
  echo "    tar xzf actions-runner-linux-x64-2.322.0.tar.gz"
  echo "    ./config.sh --url https://github.com/${GITHUB_REPO} --token <RUNNER_TOKEN>"
  echo ""
  echo "    Get RUNNER_TOKEN from:"
  echo "    https://github.com/${GITHUB_REPO}/settings/actions/runners/new"
  echo ""
  echo "    Then install as service:"
  echo "    sudo ./svc.sh install ${DEPLOY_USER}"
  echo "    sudo ./svc.sh start"
else
  echo "    Runner directory exists at ${RUNNER_DIR}"
fi

echo ""
echo "==> Setup complete!"
echo ""
echo "Checklist before first deploy:"
echo "  [ ] Review /opt/flowgrid/.env.prod"
echo "  [ ] Copy compose.prod.yml to /opt/flowgrid/"
echo "  [ ] Install GitHub Actions runner (see above)"
echo "  [ ] OpenClaw runs in Docker — onboard via: docker compose exec openclaw openclaw onboard"
echo "  [ ] Verify: curl https://${DOMAIN} and https://api.${DOMAIN}/health"
echo ""
echo "Deploy trigger: merge to main → GH Actions builds images → runner deploys"
