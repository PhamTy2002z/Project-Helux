# Ollama Installation Guide — qwen3.5:9b on Ubuntu for Claude Code

## Server Specs

| Component | Detail |
|-----------|--------|
| **CPU** | 2 × Xeon E5-2680 v4 (28 cores / 56 threads total) |
| **RAM** | 256 GB DDR4 |
| **Storage** | ~111 GiB usable (RAID1 SSD) |
| **GPU** | None (CPU-only inference) |
| **OS** | Ubuntu Linux |

> **Note**: No GPU available. qwen3.5:9b (~5-6GB model) will run entirely on CPU.
> With 256GB RAM the model fits comfortably in memory. Expect slower inference
> compared to GPU but fully functional. The 28-core Xeon setup helps with parallel
> request throughput.

## Prerequisites

- Ubuntu 20.04+ (or any modern Linux distro)
- Root or sudo access

---

## 1. Install Ollama

### Option A: Quick Install (Recommended)

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

This script automatically:
- Downloads the Ollama binary to `/usr/bin/ollama`
- Creates `ollama` system user and group
- Sets up a systemd service

### Option B: Install Specific Version

```bash
curl -fsSL https://ollama.com/install.sh | OLLAMA_VERSION=0.5.7 sh
```

### Verify Installation

```bash
ollama --version
```

---

## 2. Configure Systemd Service

The install script creates the service automatically. To customize it:

```bash
sudo systemctl edit ollama.service
```

Add overrides in the editor:

```ini
[Service]
# Custom model storage directory (default: /usr/share/ollama/.ollama/models)
Environment="OLLAMA_MODELS=/data/ollama/models"
```

Apply changes:

```bash
sudo systemctl daemon-reload
sudo systemctl restart ollama
```

### Manual Service File (if not auto-created)

Create `/etc/systemd/system/ollama.service`:

```ini
[Unit]
Description=Ollama Service
After=network-online.target

[Service]
ExecStart=/usr/bin/ollama serve
User=ollama
Group=ollama
Restart=always
RestartSec=3
Environment="PATH=$PATH"

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo useradd -r -s /bin/false -U -m -d /usr/share/ollama ollama
sudo systemctl daemon-reload
sudo systemctl enable ollama
sudo systemctl start ollama
```

---

## 3. Pull and Run qwen3.5:9b

`qwen3.5:9b` is valid on Ollama and has a large enough context window for Claude Code workflows.
However, Ollama currently recommends coding-focused models such as `qwen3-coder`, `glm-4.7`, or `gpt-oss` for the best coding results.

```bash
# Pull the model (downloads ~5-6GB)
ollama pull qwen3.5:9b

# Verify model is downloaded
ollama list

# Run interactive chat
ollama run qwen3.5:9b

# Run with a specific prompt
ollama run qwen3.5:9b "Explain quantum computing in simple terms"
```

### Pull Latest Version (Update Existing Model)

```bash
# Re-pull only downloads the diff
ollama pull qwen3.5:9b
```

---

## 4. Verify Service Status

```bash
# Check service status
sudo systemctl status ollama

# View logs
sudo journalctl -u ollama -f

# Test API endpoint
curl http://localhost:11434/api/tags
```

**Expected API response**: JSON with model list including `qwen3.5:9b`.

---

## 5. Configure Claude Code Client

Phan expose endpoint ra ngoai khong nam trong guide nay. Gia dinh team DevOps da cung cap san 1 Anthropic-compatible endpoint, vi du:

```bash
https://llm.yourdomain.com
```

Claude Code can 3 bien moi truong sau:

```bash
export ANTHROPIC_BASE_URL="https://llm.yourdomain.com"
export ANTHROPIC_AUTH_TOKEN="sk-ollama-static-token"
export ANTHROPIC_API_KEY=""
```

Luu y:

- `ANTHROPIC_BASE_URL` tro vao endpoint da duoc DevOps expose.
- `ANTHROPIC_AUTH_TOKEN` la bearer token cua endpoint do.
- `ANTHROPIC_API_KEY` de rong de tranh Claude Code uu tien key Anthropic that.
- Claude Code nen di qua Anthropic-compatible API, khong dung Ollama OpenAI-compatible endpoint cho workflow nay.

### 5.1 Linux or macOS

Current shell session:

```bash
export ANTHROPIC_BASE_URL="https://llm.yourdomain.com"
export ANTHROPIC_AUTH_TOKEN="sk-ollama-static-token"
export ANTHROPIC_API_KEY=""
```

Persist for future shells:

```bash
# zsh
cat <<'EOF' >> ~/.zshrc
export ANTHROPIC_BASE_URL="https://llm.yourdomain.com"
export ANTHROPIC_AUTH_TOKEN="sk-ollama-static-token"
export ANTHROPIC_API_KEY=""
EOF
source ~/.zshrc
```

```bash
# bash
cat <<'EOF' >> ~/.bashrc
export ANTHROPIC_BASE_URL="https://llm.yourdomain.com"
export ANTHROPIC_AUTH_TOKEN="sk-ollama-static-token"
export ANTHROPIC_API_KEY=""
EOF
source ~/.bashrc
```

### 5.2 Windows (PowerShell)

Current PowerShell session:

```powershell
$env:ANTHROPIC_BASE_URL = "https://llm.yourdomain.com"
$env:ANTHROPIC_AUTH_TOKEN = "sk-ollama-static-token"
$env:ANTHROPIC_API_KEY = ""
```

Persist for current user:

```powershell
[Environment]::SetEnvironmentVariable("ANTHROPIC_BASE_URL", "https://llm.yourdomain.com", "User")
[Environment]::SetEnvironmentVariable("ANTHROPIC_AUTH_TOKEN", "sk-ollama-static-token", "User")
[Environment]::SetEnvironmentVariable("ANTHROPIC_API_KEY", "", "User")
```

Sau do mo terminal moi de Claude Code nhan bien moi truong.

### 5.3 Run Claude Code

```bash
claude --model qwen3.5:9b
```

Neu can alias model cho mot workflow cu the:

```bash
ollama cp qwen3.5:9b claude-3-5-sonnet
claude --model claude-3-5-sonnet
```

### 5.4 Quick Verification

Kiem tra cac bien da duoc set:

```bash
env | grep '^ANTHROPIC_'
```

Windows PowerShell:

```powershell
Get-ChildItem Env:ANTHROPIC_*
```

---

## 6. Local API Usage Examples

Nhung lenh nay chi de smoke test Ollama tren may Ubuntu, khong phai cach Claude Code ket noi.

### Chat Completion

```bash
curl http://localhost:11434/api/chat -d '{
  "model": "qwen3.5:9b",
  "messages": [{"role": "user", "content": "Hello, how are you?"}]
}'
```

### Generate (Single Prompt)

```bash
curl http://localhost:11434/api/generate -d '{
  "model": "qwen3.5:9b",
  "prompt": "Write a Python function to sort a list"
}'
```

### List Running Models

```bash
curl http://localhost:11434/api/ps
```

### Show Model Info

```bash
curl http://localhost:11434/api/show -d '{"model": "qwen3.5:9b"}'
```

---

## 7. Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_MODELS` | `~/.ollama/models` | Model storage directory |
| `OLLAMA_NUM_PARALLEL` | (auto) | Max parallel requests (tune for 56-thread CPU) |
| `OLLAMA_MAX_LOADED_MODELS` | (auto) | Max models loaded in memory |
| `OLLAMA_KEEP_ALIVE` | `5m` | How long to keep model in memory |

---

## 8. Model Management

```bash
# List all downloaded models
ollama list

# Show model details
ollama show qwen3.5:9b

# Copy/rename a model
ollama cp qwen3.5:9b my-qwen

# Delete a model
ollama rm qwen3.5:9b

# Create custom model with system prompt
cat <<EOF > Modelfile
FROM qwen3.5:9b
SYSTEM "You are a helpful coding assistant."
EOF
ollama create my-coding-assistant -f Modelfile
```

---

## 9. Update and Uninstall

### Update Ollama

```bash
# Re-run the install script (downloads latest version)
curl -fsSL https://ollama.com/install.sh | sh
```

### Uninstall Ollama

```bash
sudo systemctl stop ollama
sudo systemctl disable ollama
sudo rm /etc/systemd/system/ollama.service
sudo rm $(which ollama)
sudo userdel ollama
sudo groupdel ollama
sudo rm -rf /usr/share/ollama
```

---

## Quick Start Summary

```bash
# 1. Install
curl -fsSL https://ollama.com/install.sh | sh

# 2. Pull model
ollama pull qwen3.5:9b

# 3. Configure Claude Code on your client machine
export ANTHROPIC_BASE_URL="https://llm.yourdomain.com"
export ANTHROPIC_AUTH_TOKEN="sk-ollama-static-token"
export ANTHROPIC_API_KEY=""

# 4. Run Claude Code
claude --model qwen3.5:9b
```

## Unresolved Questions

- Final production URL and auth token values from DevOps are not included in this guide.
