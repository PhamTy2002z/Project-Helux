# CI Failure Investigation — E2E + Installer Docker

**Date:** 2026-03-13
**Run:** `23013004688` (main branch)

---

## Executive Summary

Two CI jobs failing. Root causes identified and fixed.

| Job | Root Cause | Fix |
|-----|-----------|-----|
| `e2e` | `GlobalLoader` never mounts: `AuthProvider` returns `null` during init, blocking `QueryProvider`+`GlobalLoader` | Move `QueryProvider`/`GlobalLoader` outside `AuthProvider` in `(app)/layout.tsx` |
| `Installer (ubuntu)` | `frontend` service has a Docker Compose profile `docker-frontend` → skipped by plain `docker compose up` | Add `--profile docker-frontend` to `docker_compose up` call in `install.sh` |

---

## Issue 1: E2E — `data-cy='global-loader'` not found

### Symptom
All tests calling `cy.waitForAppLoaded()` fail:
```
AssertionError: Timed out retrying after 30000ms:
Expected to find element: `[data-cy='global-loader']`, but never found it.
```

Files: `board_tasks.cy.ts`, `activity_feed.cy.ts` (happy path / empty state / error state tests)

### Root Cause

`(app)/layout.tsx` (before fix):
```tsx
<AuthProvider>          // returns null during init
  <QueryProvider>
    <GlobalLoader />    // ← never mounts
    {children}
  </QueryProvider>
</AuthProvider>
```

`AuthProvider.tsx` line 52-55:
```tsx
if (localMode) {
  if (!localAuthReady) {
    return null;        // ← entire subtree dropped from DOM
  }
```

In CI, `NEXT_PUBLIC_AUTH_MODE=local` → `localMode=true`. On initial render, `localAuthReady=false` (set to true in `useEffect`). So `AuthProvider` returns `null`, which means `QueryProvider` and `GlobalLoader` are never rendered. Cypress waits 30s for the element that never appears.

### Fix
`/Users/typham/Documents/GitHub/Project-Helux/frontend/src/app/(app)/layout.tsx`

Moved `QueryProvider` + `GlobalLoader` outside `AuthProvider`:
```tsx
<QueryProvider>
  <GlobalLoader />
  <AuthProvider>
    {children}
  </AuthProvider>
</QueryProvider>
```

`GlobalLoader` uses `useIsFetching`/`useIsMutating` (React Query hooks) — still has required `QueryProvider` ancestor. During auth init phase, no queries run → `visible=false` → `aria-hidden="true"` → Cypress assertion passes immediately.

---

## Issue 2: Installer (ubuntu) — frontend never starts

### Symptom
```
Installer docker smoke readiness failed: backend_ready=1 frontend_ready=0
```

`docker compose ps` output shows: backend, db, redis, minio, webhook-worker — **no frontend container**.

### Root Cause
`compose.yml` line 137-138:
```yaml
frontend:
  profiles:
    - docker-frontend
```

Frontend service is behind a Docker Compose **profile**. Running `docker compose up -d --build` without specifying the profile skips all profiled services. The installer called:
```bash
docker_compose -f compose.yml --env-file .env up -d --build
```
→ frontend never started → port 13000 never responds → smoke test fails.

### Fix
`/Users/typham/Documents/GitHub/Project-Helux/install.sh`

Added `--profile docker-frontend` flag:
```bash
docker_compose --profile docker-frontend -f compose.yml --env-file .env up -d --build
```

Also updated the summary "Stop stack" hint to include the profile.

---

## Files Changed

1. `frontend/src/app/(app)/layout.tsx` — restructure provider nesting
2. `install.sh` — add `--profile docker-frontend` to docker mode startup

---

## Verification

- `bash -n install.sh` → SYNTAX OK
- `tsc --noEmit` → no errors
- Auth negative tests (no `waitForAppLoaded`) passed in CI already — unaffected by fix
- `activity_smoke.cy.ts` passed in CI already — unaffected (no `waitForAppLoaded`)
