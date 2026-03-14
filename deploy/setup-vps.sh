#!/usr/bin/env bash
# One-time setup script for FlowGrid on personal Ubuntu laptop + Cloudflare Tunnel.
# Run as root.
#
# Usage: sudo bash setup-vps.sh <DOMAIN> [GITHUB_USER]
#
# What this does:
#   1. System updates (no swap needed — 16GB RAM)
#   2. Install Docker, Node.js (for OpenClaw)
#   3. Install + configure Cloudflare Tunnel (cloudflared)
#   4. Create deploy user + /opt/flowgrid
#   5. Generate .env.prod template
#   6. Setup systemd services for auto-start on boot

set -euo pipefail

DOMAIN="${1:?Usage: sudo bash setup-vps.sh <DOMAIN> [GITHUB_USER]}"
GITHUB_USER="${2:-phamty2002z}"

echo "==> Setting up FlowGrid on $(hostname)"
echo "    Domain: ${DOMAIN}"
echo "    GitHub: ${GITHUB_USER}"
echo ""

# --- 1. System updates ---
echo "==> [1/6] System updates"
apt-get update && apt-get upgrade -y
apt-get install -y curl wget git unzip jq

# --- 2. Install Docker ---
echo "==> [2/6] Installing Docker"
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
  echo "    Docker installed"
else
  echo "    Docker already installed, skipping"
fi

# --- 3. Install Node.js 22 (for OpenClaw) ---
echo "==> [3/6] Installing Node.js 22"
if ! command -v node &>/dev/null || [[ "$(node -v)" != v22* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
  echo "    Node.js $(node -v) installed"
else
  echo "    Node.js $(node -v) already installed, skipping"
fi

# --- 4. Install Cloudflare Tunnel ---
echo "==> [4/6] Installing cloudflared"
if ! command -v cloudflared &>/dev/null; then
  curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
  dpkg -i cloudflared.deb
  rm -f cloudflared.deb
  echo "    cloudflared installed"
else
  echo "    cloudflared already installed, skipping"
fi

# --- 5. Create deploy user + project directory ---
echo "==> [5/6] Creating deploy user + /opt/flowgrid"
if ! id -u deploy &>/dev/null; then
  useradd -m -s /bin/bash -G docker deploy
  echo "    User 'deploy' created"
else
  usermod -aG docker deploy
  echo "    User 'deploy' already exists, added to docker group"
fi

mkdir -p /opt/flowgrid
chown deploy:deploy /opt/flowgrid

# --- 6. Generate .env.prod template ---
echo "==> [6/6] Generating .env.prod template"
ENV_FILE="/opt/flowgrid/.env.prod"
if [ ! -f "$ENV_FILE" ]; then
  PG_PASS=$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)
  MINIO_PASS=$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)
  AUTH_TOKEN=$(openssl rand -base64 48 | tr -d '/+=' | head -c 64)

  cat > "$ENV_FILE" <<ENVEOF
# FlowGrid Production Environment
# Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Domain
DOMAIN=${DOMAIN}

# GHCR
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
MANAGED_GATEWAY_URL=ws://127.0.0.1:18789/ws
MANAGED_GATEWAY_TOKEN=
MANAGED_GATEWAY_WORKSPACE_ROOT=/home/deploy/.openclaw/managed

# Worker
WORKER_HEARTBEAT_KEY=mission-control:worker:heartbeat
READINESS_WORKER_HEARTBEAT_KEY=mission-control:worker:heartbeat
ENVEOF

  chmod 600 "$ENV_FILE"
  chown deploy:deploy "$ENV_FILE"
  echo "    .env.prod created at ${ENV_FILE}"
else
  echo "    .env.prod already exists, skipping"
fi

echo ""
echo "==> Setup complete!"
echo ""
echo "Next steps:"
echo ""
echo "  1. Authenticate cloudflared:"
echo "     cloudflared tunnel login"
echo ""
echo "  2. Create tunnel:"
echo "     cloudflared tunnel create flowgrid"
echo ""
echo "  3. Configure tunnel — create /etc/cloudflared/config.yml:"
echo "     tunnel: <TUNNEL_ID>"
echo "     credentials-file: /root/.cloudflared/<TUNNEL_ID>.json"
echo "     ingress:"
echo "       - hostname: ${DOMAIN}"
echo "         service: http://localhost:3000"
echo "       - hostname: api.${DOMAIN}"
echo "         service: http://localhost:8000"
echo "       - service: http_status:404"
echo ""
echo "  4. Route DNS:"
echo "     cloudflared tunnel route dns flowgrid ${DOMAIN}"
echo "     cloudflared tunnel route dns flowgrid api.${DOMAIN}"
echo ""
echo "  5. Install as service:"
echo "     cloudflared service install"
echo "     systemctl enable cloudflared"
echo ""
echo "  6. Copy compose.prod.yml to /opt/flowgrid/"
echo "  7. Review /opt/flowgrid/.env.prod"
echo "  8. Install OpenClaw:"
echo "     su - deploy -c 'curl -fsSL https://openclaw.ai/install.sh | bash'"
echo ""
echo "  9. First deploy:"
echo "     su - deploy -c 'cd /opt/flowgrid && docker compose -f compose.prod.yml --env-file .env.prod up -d'"
echo ""
echo "GitHub Secrets for CI/CD (self-hosted runner recommended):"
echo "  Or use SSH: VPS_HOST, VPS_USER, VPS_SSH_KEY"
echo "  NEXT_PUBLIC_API_URL = https://api.${DOMAIN}"
