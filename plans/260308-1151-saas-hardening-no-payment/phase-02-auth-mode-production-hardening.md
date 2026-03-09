# Phase 2: Production Auth Mode Hardening

## Context Links

- Plan overview: [plan.md](./plan.md)
- Auth core: `backend/app/core/auth.py`
- Config: `backend/app/core/config.py`
- Frontend auth local mode: `frontend/src/auth/localAuth.ts`

## Overview

- **Priority:** P1
- **Status:** Completed (2026-03-08)
- **Effort:** 3d

Separate dev-friendly auth behavior from production auth behavior. Remove risky fallback paths in production.

## Key Insights

- Clerk mode still falls back to local token if present.
- Default sample env emphasizes `AUTH_MODE=local`, useful for self-hosting but risky for public SaaS.
- Production mode needs strict and explicit auth contract.

## Requirements

Functional:
- Introduce explicit production-safe auth behavior flag set.
- Disable local token fallback when running production profile.
- Ensure frontend does not expose local auth UI in production profile.

Non-functional:
- Keep local/dev flow for contributor DX.
- Minimize breaking changes for self-host users by opt-in profile strategy.

## Architecture

Config model extension:
- `AUTH_PROFILE=dev|self_hosted|saas`
- In `saas`: reject local fallback path and require Clerk/JWT-only.

Decision table:
- `AUTH_PROFILE=saas` + `AUTH_MODE=clerk` -> strict JWT only.
- `AUTH_PROFILE=self_hosted` + `AUTH_MODE=local` -> current local token flow.
- `AUTH_PROFILE=dev` -> permissive for local iteration.

## Related Code Files

Modify:
- `backend/app/core/config.py`
- `backend/app/core/auth.py`
- `frontend/src/auth/localAuth.ts`
- `frontend/src/auth/clerk.tsx`
- `.env.example`
- `backend/.env.example`
- `docs/reference/authentication.md`

Add tests:
- `backend/tests/core/test_auth_profiles.py`
- `frontend/tests/auth/profile-mode.test.ts`

## Implementation Steps

1. Add auth profile enum and validation constraints.
2. Gate local fallback paths under non-saas profiles only.
3. Update frontend auth UI gating with profile-aware logic.
4. Update env examples and documentation.
5. Add tests for all profile-mode combinations.

## Todo List

- [x] Define auth profile matrix.
- [x] Implement strict production behavior.
- [x] Remove local fallback path for SaaS profile.
- [x] Update docs and env templates.
- [x] Add profile behavior tests.

## Success Criteria

- SaaS profile cannot authenticate using local bearer fallback.
- Auth behavior is deterministic from config and tested.
- Existing local development workflow still works.

## Risk Assessment

- Risk: accidental lockout from misconfigured profile.
- Mitigation: startup validation with explicit error messages and docs examples.

## Security Considerations

- No mixed-mode auth fallback in internet-facing environments.
- Reduce chance of shared-token abuse.

## Next Steps

- Start schema and query isolation hardening in Phase 3.
