# System Audit Report — Project Helux

**Date:** 2026-03-12 | **Branch:** develop | **Auditor:** squirrel v0.0.38 + code analysis

---

## 1. Audit Scores

| Target | Score | Grade | Notes |
|--------|-------|-------|-------|
| Frontend (`:3000`) | 77 | C | Auth wall → chỉ crawl 1 page |
| Backend (`:8000`) | 49 | F | Thiếu security headers, SEO, legal |

> Scores thấp hơn thực tế vì squirrel không bypass auth. Code analysis bổ sung bên dưới.

---

## 2. Issues theo mức độ ưu tiên

### CAO — Cần fix ngay

| # | Issue | Ảnh hưởng | File |
|---|-------|-----------|------|
| 1 | **Backend port 8000 exposed to internet** — không bind `127.0.0.1` trong compose | Direct API access bypass frontend | `compose.yml` |
| 2 | **IP spoofing trong rate limiter** — đọc `X-Forwarded-For` không validate trusted proxy | Bypass rate limit dễ dàng | `backend/app/core/rate_limit.py` |
| 3 | **Không có CSP headers** — cả frontend lẫn backend | XSS risk | `next.config.ts`, `security_headers.py` |
| 4 | **Không có HSTS** | Man-in-the-middle risk | `security_headers.py` |
| 5 | **Security headers mặc định blank** — X-Frame-Options, X-Content-Type-Options, Referrer-Policy đều rỗng | Clickjacking, MIME sniffing | `backend/.env.example` |

### TRUNG BÌNH

| # | Issue | Ảnh hưởng | File |
|---|-------|-----------|------|
| 6 | **Agent token lookup O(n) PBKDF2** — iterate tất cả agents per request | DoS/latency khi scale | `backend/app/core/agent_auth.py` |
| 7 | **Frontend Dockerfile chạy root** | Container escape risk | `frontend/Dockerfile` |
| 8 | **OpenAPI `/docs`, `/redoc` public** — không toggle theo environment | Info disclosure | `app/main.py` |
| 9 | **Không có OG image** | Social sharing thiếu preview | `layout.tsx` |
| 10 | **Sitemap dùng localhost URL** — `NEXT_PUBLIC_SITE_URL` không set | SEO broken khi deploy | `sitemap.ts` |

### THẤP

| # | Issue | Ảnh hưởng |
|---|-------|-----------|
| 11 | `SAAS_MODE`, `SHARED_GATEWAY_TOKEN` trong `.env` nhưng không có trong Settings class | Orphaned config, gây confuse |
| 12 | Hầu hết app pages full CSR (`"use client"`) — không có SSR data fetching | SEO cho protected pages không quan trọng, nhưng initial load chậm hơn |
| 13 | Coverage threshold `fail_under = 0` trong `pyproject.toml` | Không enforce test quality |
| 14 | Không có skip-to-main-content link | A11y gap |
| 15 | No reverse proxy / TLS termination trong compose | Production deployment cần thêm layer |

---

## 3. Phân tích chi tiết theo danh mục

### 3.1 Security

**Tốt:**
- Clerk JWT auth + timing-safe local auth comparison (`hmac.compare_digest`)
- Agent tokens: PBKDF2-HMAC-SHA256 (200K iterations, 16-byte salt)
- `LOCAL_AUTH_TOKEN` minimum 50 chars, block known placeholders
- DB/Redis/MinIO chỉ bind `127.0.0.1`
- Backend chạy non-root user (`appuser:1000`)
- Open redirect prevention trong `resolveSignInRedirectUrl()`

**Cần cải thiện:**
- Rate limiter: validate `X-Forwarded-For` với trusted proxy list
- Add CSP, HSTS, X-Frame-Options headers
- Bind backend port `127.0.0.1` trong compose
- Frontend Dockerfile: thêm non-root user
- Toggle `/docs` theo environment

### 3.2 Performance

**Tốt:**
- Async toàn bộ backend (SQLAlchemy async)
- RQ worker offload webhook/file processing
- `visibilityAwareInterval()` pause polling khi tab hidden
- Dynamic imports cho heavy components (chat panels)
- `optimizePackageImports` cho lucide-react, recharts, framer-motion
- `pool_pre_ping=True` cho stable DB connections

**Cần cải thiện:**
- Agent token lookup O(n) → index token prefix hoặc dùng lookup table
- Không có HTTP cache headers trên API responses
- Most images dùng raw `<img>` thay vì `next/image`
- Redis `maxmemory 128mb` với `allkeys-lru` — rate limit state có thể bị evict

### 3.3 SEO / Web Standards

**Tốt:**
- `robots.ts` — properly disallow app routes, allow public pages
- `sitemap.ts` — 4 public routes với `changeFrequency` và `priority`
- Complete `Metadata` block: title template, description, keywords, OG, Twitter Card
- JSON-LD structured data (WebSite, SoftwareApplication, Organization)
- Per-page metadata override cho public pages

**Cần cải thiện:**
- Thêm OG image cho social sharing
- Set `NEXT_PUBLIC_SITE_URL` cho production
- Squirrel không thấy robots.txt/sitemap vì Next.js generate runtime → cần verify production output

### 3.4 Accessibility

**Tốt:**
- `aria-hidden` trên decorative elements
- `aria-label` trên icon-only buttons
- `role="link"` + `tabIndex={0}` + keyboard handler
- `focus-visible:` ring classes (33+ files)
- `htmlFor` label associations
- `useId()` cho unique SVG IDs

**Cần cải thiện:**
- Coverage partial — nhiều components thiếu aria attributes
- Thiếu skip-to-main-content link
- Form inputs trong board/task area chưa verify label associations
- Color contrast chưa được audit systematic

### 3.5 Docker / Production Readiness

**Tốt:**
- Multi-stage builds (backend + frontend)
- Internal network separation
- Memory limits hợp lý
- Health checks + proper dependencies
- `restart: unless-stopped`
- `DB_AUTO_MIGRATE=false` default

**Cần cải thiện:**
- Backend port bind `127.0.0.1`
- Frontend Dockerfile: non-root user
- Add reverse proxy (Nginx/Traefik) cho TLS
- MinIO SSL disabled
- `ENVIRONMENT=dev` trong template → cần production preset

---

## 4. Đề xuất hành động

### Phase 1: Security Hardening (Ưu tiên cao nhất)

1. **Compose fix** — bind backend port `127.0.0.1:8000:8000`
2. **Security headers** — set sensible defaults trong `config.py`:
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: DENY`
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
3. **Add CSP header** — cả Next.js middleware và backend
4. **Add HSTS** — `Strict-Transport-Security: max-age=63072000; includeSubDomains`
5. **Rate limiter** — add trusted proxy validation, fallback sang direct IP
6. **Frontend Dockerfile** — thêm `USER node` hoặc custom non-root user

### Phase 2: Performance & Reliability

7. **Agent token lookup** — thêm token prefix index để O(1) lookup thay vì O(n)
8. **API cache headers** — add `Cache-Control` cho static/list endpoints
9. **Replace `<img>` với `next/image`** cho optimized loading
10. **Redis memory** — tăng lên 256mb hoặc tách rate-limit store riêng

### Phase 3: SEO & Social

11. **OG image** — tạo default OG image, set trong metadata
12. **`NEXT_PUBLIC_SITE_URL`** — document rõ ràng trong `.env.example` và deployment guide
13. **Verify sitemap/robots** — test production build output

### Phase 4: Polish

14. **A11y** — add skip-to-main-content, audit form labels, color contrast check
15. **Toggle OpenAPI docs** — disable `/docs` khi `ENVIRONMENT=production`
16. **Cleanup orphaned env vars** — `SAAS_MODE`, `SHARED_GATEWAY_TOKEN`
17. **Test coverage** — tăng `fail_under` lên ít nhất 60%

---

## 5. Câu hỏi chưa giải quyết

1. `SAAS_MODE` / `SHARED_GATEWAY_TOKEN` có được đọc ở layer nào khác ngoài Settings class không?
2. OpenAPI docs cần public cho agent/dev tools hay nên ẩn trong production?
3. Reverse proxy (Nginx/Traefik) được assume ở layer nào trong production?
4. Có kế hoạch tăng test coverage threshold không?
5. `MANAGED_GATEWAY_TOKEN` trong frontend `.env` không có `NEXT_PUBLIC_` prefix — chỉ server-side?
