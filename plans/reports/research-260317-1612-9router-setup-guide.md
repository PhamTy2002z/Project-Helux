# 9Router - Setup Guide & Usage Notes

## Tổng quan

**9Router** là AI router local/self-hosted, tự động route request đến nhiều AI provider với smart fallback. Open-source, miễn phí.

- Repo: https://github.com/decolua/9router
- npm: `9router`
- Dashboard: `http://localhost:20128`

## Cách hoạt động

```
CLI Tool (Claude Code, Codex, OpenClaw...)
  → http://localhost:20128/v1
    → 9Router (format translation + quota tracking)
      → Tier 1: Subscription (Claude Code, Codex, Gemini CLI)
      → Tier 2: Cheap (GLM $0.6/1M, MiniMax $0.2/1M)
      → Tier 3: Free (iFlow, Qwen, Kiro - unlimited)
```

## Cài đặt

```bash
npm install -g 9router
9router
```

## Fallback Logic

- **Theo thứ tự ưu tiên**, KHÔNG phải round-robin
- Model đầu lỗi/hết quota → chuyển sang model tiếp theo
- Combo 1 model = không có fallback
- **Multi-account** (nhiều tài khoản cùng provider) mới dùng round-robin

Ví dụ combo 7-8 model:

```
1. cx/gpt-5.2-codex          ← subscription, dùng trước
2. gh/claude-4.5-sonnet      ← subscription backup
3. cursor/gpt-5              ← subscription backup
4. kimi/kimi-latest          ← $9/tháng
5. glm/glm-4.7               ← $0.6/1M
6. minimax/MiniMax-M2.1      ← $0.2/1M
7. if/kimi-k2-thinking       ← free unlimited
8. qw/qwen3-coder-plus       ← free unlimited
```

Sắp xếp: Subscription → Cheap → Free

## Tích hợp Claude Code

Sửa `~/.claude/config.json`:

```json
{
  "anthropic_api_base": "http://localhost:20128/v1",
  "anthropic_api_key": "your-9router-api-key"
}
```

- API key lấy từ dashboard 9Router
- Dùng `/model` trong Claude Code để chọn model = tên combo hoặc model ID
- 9Router tự dịch format Anthropic ↔ OpenAI

## Tích hợp OpenClaw (Docker nội bộ)

Config `~/.openclaw/openclaw.json`:

```json
{
  "agents": {
    "defaults": {
      "model": { "primary": "9router/if/glm-4.7" }
    }
  },
  "models": {
    "providers": {
      "9router": {
        "baseUrl": "http://9router:20128/v1",
        "apiKey": "your-9router-api-key",
        "api": "openai-completions",
        "models": [
          { "id": "if/glm-4.7", "name": "glm-4.7" }
        ]
      }
    }
  }
}
```

Lưu ý: Dùng `http://9router:20128` (tên container) thay vì `localhost` khi chạy Docker.

## Deploy VPS (Docker + Cloudflare Tunnel)

### Docker Compose

```yaml
services:
  9router:
    build: https://github.com/decolua/9router.git
    container_name: 9router
    restart: unless-stopped
    ports:
      - "127.0.0.1:20128:20128"  # chỉ bind localhost, tunnel/proxy truy cập
    environment:
      - PORT=20128
      - HOSTNAME=0.0.0.0
      - JWT_SECRET=your-secure-secret
      - INITIAL_PASSWORD=your-password
      - REQUIRE_API_KEY=true
      - NEXT_PUBLIC_BASE_URL=https://router.yourdomain.com
      - AUTH_COOKIE_SECURE=true
    volumes:
      - 9router-data:/app/data
      - 9router-usage:/root/.9router
    networks:
      - internal

volumes:
  9router-data:
  9router-usage:
```

### Truy cập CLI trong Docker

```bash
docker exec -it 9router 9router
```

### Cloudflare Tunnel (thay nginx)

Thêm ingress rule vào `~/.cloudflared/config.yml`:

```yaml
ingress:
  # ... rules hiện tại ...

  - hostname: router.yourdomain.com
    service: http://localhost:20128
    originRequest:
      noTLSVerify: true
      disableChunkedEncoding: true  # quan trọng cho SSE streaming

  - service: http_status:404
```

Thêm DNS route và restart:

```bash
cloudflared tunnel route dns <tunnel-name> router.yourdomain.com
sudo systemctl restart cloudflared
```

Lợi ích so với nginx:
- Không cần mở port trên router/firewall
- HTTPS tự động qua Cloudflare
- Không cần certbot/Let's Encrypt

### Config Claude Code qua domain

```json
{
  "anthropic_api_base": "https://router.yourdomain.com/v1",
  "anthropic_api_key": "your-9router-api-key"
}
```

### Biến môi trường quan trọng

| Variable | Default | Mô tả |
|----------|---------|-------|
| `JWT_SECRET` | `9router-default-secret-change-me` | JWT secret (BẮT BUỘC đổi) |
| `INITIAL_PASSWORD` | `123456` | Password đăng nhập lần đầu |
| `PORT` | `20128` | Port |
| `NEXT_PUBLIC_BASE_URL` | `http://localhost:3000` | URL public (set domain khi dùng tunnel) |
| `REQUIRE_API_KEY` | `false` | Bật `true` nếu expose ra internet |
| `AUTH_COOKIE_SECURE` | `false` | Bật `true` khi dùng HTTPS/tunnel |

### Bảo mật

- `REQUIRE_API_KEY=true` → bắt buộc API key trên `/v1/*`
- `AUTH_COOKIE_SECURE=true` → bắt buộc khi dùng HTTPS (Cloudflare Tunnel tự có)
- Bind port `127.0.0.1:20128` → không expose trực tiếp ra ngoài

## Provider & Model Reference

| Provider | Prefix | Loại | Giá |
|----------|--------|------|-----|
| Claude Code | `cc/` | Subscription | $20/tháng |
| Codex | `cx/` | Subscription | $20-200/tháng |
| Gemini CLI | `gc/` | Free | 180K/tháng |
| GitHub Copilot | `gh/` | Subscription | $10-19/tháng |
| GLM | `glm/` | Cheap | $0.6/1M |
| MiniMax | `minimax/` | Cheap | $0.2/1M |
| Kimi | `kimi/` | Cheap | $9/tháng flat |
| iFlow | `if/` | Free | Unlimited |
| Qwen | `qw/` | Free | Unlimited |
| Kiro | `kr/` | Free | Unlimited |

## Combo gợi ý

### Free hoàn toàn ($0/tháng)

```
1. gc/gemini-3-flash         (180K free/tháng)
2. if/kimi-k2-thinking       (unlimited)
3. qw/qwen3-coder-plus       (unlimited)
```

### Maximize subscription

```
1. cx/gpt-5.2-codex          (subscription)
2. glm/glm-4.7               (cheap backup)
3. if/kimi-k2-thinking       (free fallback)
```
