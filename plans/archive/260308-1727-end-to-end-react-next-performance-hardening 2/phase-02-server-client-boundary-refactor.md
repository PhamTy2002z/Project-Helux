---
phase: 2
title: "Server/Client Boundary Refactor"
risk: HIGH
effort: 7h
status: completed
---

# Phase 02: Server/Client Boundary Refactor

## Context Links
- [plan.md](./plan.md)
- [Root layout](../../frontend/src/app/layout.tsx)
- [Auth provider](../../frontend/src/components/providers/AuthProvider.tsx)
- [Local auth token handling](../../frontend/src/auth/localAuth.ts)

## Overview
- Priority: P1
- Status: completed
- Reduce global client hydration by moving non-interactive render paths to Server Components.

## Key Insights
- Root layout mounts client auth/query providers globally.
- Local auth token in `sessionStorage` blocks server-side auth checks.

## Requirements
- Functional: preserve auth behavior for `local` and `clerk` modes.
- Non-functional: reduce unnecessary client hydration and keep UX unchanged.

## Architecture
- Split route groups: public shell and authenticated dashboard shell.
- Move local auth credential transport to secure cookie flow for SSR compatibility.
- Keep only interactive shells as client components.

## Related Code Files
- Modify: `frontend/src/app/layout.tsx`, `frontend/src/components/providers/AuthProvider.tsx`, `frontend/src/auth/localAuth.ts`, relevant auth route layouts
- Create: grouped layouts under `frontend/src/app/(public)/` and `frontend/src/app/(app)/`
- Delete: none

## Implementation Steps
1. Design grouped route layout map and provider boundaries.
2. Introduce cookie-based local auth handshake (no token in session storage).
3. Keep dashboard-specific providers inside authenticated group only.
4. Remove unnecessary `force-dynamic` usage where no longer required.

## Todo List
- [x] Define route group split plan
- [x] Implement local auth cookie handoff
- [x] Move providers to minimal scope
- [x] Remove redundant `force-dynamic` declarations

## Success Criteria
- Public routes render with minimal hydration footprint.
- Auth behavior parity verified for both auth modes.

## Risk Assessment
- Risk: auth regression for local mode.
- Mitigation: explicit auth mode test matrix before merge.

## Security Considerations
- Store auth credentials only in secure, HTTP-only cookies.
- Validate CSRF/expiry behavior for local mode.

## Next Steps
- Feed the new boundaries into query policy cleanup (Phase 3).
