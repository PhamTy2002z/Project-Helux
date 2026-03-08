# Brainstorm Report - SaaS Gateway Production Strategy

## Problem statement
- Goal: turn current Mission Control into production SaaS AI automation platform.
- Current blocker: gateway setup still manual, not SaaS-grade onboarding.
- Critical risk: OpenClaw implementation details and secrets exposed to tenant-facing surface.
- Need: safer gateway onboarding, better secret isolation, white-label boundary, scalable operations.

## Current-state findings (from code)
- Gateway status API accepts `gateway_url` + `gateway_token` via query params. Risk: token in URL, browser/network logs, observability traces.
- Gateway read schema returns raw `token` to frontend.
- UI detail/edit pages load token back into browser state and reuse for status checks.
- Gateway token stored as plain string in DB model.
- Gateway RPC client appends token into websocket URL query (`?token=...`) and also sends auth token in connect payload.
- Product copy and identifiers leak OpenClaw naming in UI labels, metadata, localStorage keys.

## Approaches evaluated

### Approach A - Keep BYOG manual (small patch only)
- What: keep existing model, only patch obvious leaks.
- Pros: fastest, lowest immediate effort.
- Cons: still operationally manual, still bad SaaS UX, support burden high, weak moat.
- Verdict: acceptable only as temporary stopgap (2-4 weeks max).

### Approach B - BYOG Self-Service Gateway Onboarding (recommended now)
- What: tenant still brings own gateway runtime, but onboarding automated and hardened.
- Pros: fast path to SaaS, no heavy infra spend, clear ownership boundary for runtime compute.
- Cons: tenant environment variance, limited deep control, support still needed for edge network/security.
- Verdict: best balance for near-term launch.

### Approach C - Fully managed gateway runtime by your platform
- What: you run dedicated gateway workers per tenant (or per workspace), full managed experience.
- Pros: best UX, clean abstraction, strongest brand control.
- Cons: highest complexity and cost (isolation, scaling, compliance, incident scope).
- Verdict: strategic phase-2 after PMF/revenue signal.

## Recommended solution
Use **2-step strategy**:
1. **Now (0-8 weeks): Approach B** to launch secure SaaS beta quickly.
2. **Later (after beta traction): evolve to selective Approach C** for high-value tiers.

### Architecture shape (Approach B)
- Add **Gateway Enrollment Service**:
  - SaaS issues short-lived enrollment token + bootstrap script/agent package.
  - Customer runs one command on gateway host; service auto-registers gateway + capabilities.
- Replace URL-token checks with **server-side gateway profile resolution**:
  - `status/sessions` API should use `gateway_id` or `board_id`, never raw token in query.
- Add **Secret Vault abstraction**:
  - store gateway token encrypted at rest using KMS/Vault envelope encryption.
  - app DB stores ciphertext + metadata only.
- Add **Brand abstraction layer**:
  - external naming uses neutral terms (`Runtime`, `Agent Engine`), not OpenClaw.
  - OpenClaw namespace remains internal-only module boundary.
- Add **Gateway Policy Profiles**:
  - enforce TLS mode, device pairing rules, min runtime version, allowed origins.
- Add **Tenant-safe observability**:
  - redact tokens/URLs at ingress logs, traces, error payloads.

## Hard truths / non-negotiables
- If token stays in query params, SaaS security posture is not acceptable.
- If raw gateway token keeps returning to browser, incident is waiting to happen.
- If OpenClaw naming stays in tenant UX, white-label positioning will keep breaking.
- Full managed runtime now (Approach C) without paying tenants likely burns team bandwidth.

## Implementation considerations and risks
- Migration risk: existing APIs depend on `gateway_url/gateway_token` query pattern.
- Backward compatibility: need deprecation window and adapter endpoints.
- Security risk: rotating legacy tokens during migration can break existing gateways.
- Ops risk: automated enrollment needs robust retry + idempotency.
- Product risk: BYOG still needs good docs/runbooks to avoid support spikes.

## Success metrics
- 0 gateway secrets in URL query strings (frontend/backend/network logs).
- 0 raw gateway tokens returned in any tenant-facing API.
- 90%+ new gateways onboarded via self-service enrollment flow (no manual ops touch).
- p95 gateway health check < 2s, enrollment success > 98%.
- Reduce support tickets for gateway onboarding by >= 60% in beta.

## Next steps and dependencies
1. Freeze current gateway API contract and mark insecure params as deprecated.
2. Design new gateway-status contract (`gateway_id` only) + regenerate frontend client.
3. Introduce secret-storage adapter (KMS/Vault first; fallback local encrypted key for dev).
4. Build enrollment token + bootstrap flow (CLI/script).
5. Execute white-label cleanup pass for user-facing OpenClaw strings.
6. Add security regression tests for token leakage in API, logs, and UI payloads.

## Unresolved questions
- You target launch window for SaaS beta: 4 weeks, 8 weeks, or longer?
- Initial customers accept BYOG runtime, or you must deliver fully managed runtime from day 1?
- Compliance target now (SOC2-lite controls only, or formal SOC2 roadmap immediately)?
