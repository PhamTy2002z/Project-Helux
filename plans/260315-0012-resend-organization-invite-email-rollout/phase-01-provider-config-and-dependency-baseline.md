---
phase: 1
title: "Provider config and dependency baseline"
status: completed
effort: 1.5h
---

# Phase 1: Provider config and dependency baseline

## Context links

- `backend/app/core/config.py`
- `backend/pyproject.toml`
- `backend/.env.example`
- `.env.example`
- `compose.yml`

## Overview

Add email provider runtime config with strict validation and install Resend SDK.
Default behavior remains disabled to avoid accidental sending in dev.

## Key insights

- Project already validates provider-specific billing config in `Settings`.
- Worker already loads `backend/.env`, so new email env vars propagate naturally.
- `AUTH_MODE=local` is common here; password reset is out of current auth design.

## Requirements

- Functional:
  - Support `EMAIL_PROVIDER=none|resend`.
  - Require Resend credentials only when provider is `resend`.
  - Define sender identity and invite accept base URL.
- Non-functional:
  - Fail fast on invalid config at startup.
  - Keep defaults safe (no delivery when unset).

## Architecture

- Extend `Settings` with email fields and provider-conditional validation.
- Add `resend` SDK dependency pinned to stable major.

## Related code files

Modify:
- `backend/app/core/config.py`
- `backend/pyproject.toml`
- `backend/.env.example`
- `.env.example`

Create:
- none

Delete:
- none

## Implementation steps

1. Add dependency in `backend/pyproject.toml`: `resend>=2.23.0,<3`.
2. Add settings fields:
   - `email_provider` (`none` default)
   - `resend_api_key`
   - `resend_webhook_secret` (phase-2 readiness)
   - `email_from_invites`
   - `email_reply_to`
   - `invite_accept_base_url`
3. Validate:
   - `email_provider` in allowed set.
   - when `resend`: require `resend_api_key`, `email_from_invites`,
     `invite_accept_base_url`.
   - ensure `invite_accept_base_url` is absolute http(s).
4. Update env example files with comments and safe defaults.
5. Verify compose worker receives env through existing `env_file`.

## Todo list

- [x] Add resend dependency.
- [x] Extend settings model.
- [x] Add conditional validator and URL normalization.
- [x] Update env examples.
- [x] Validate startup behavior for `none` and `resend` modes.

## Success criteria

- Backend starts with `EMAIL_PROVIDER=none` and no resend keys.
- Backend fails with explicit message when `EMAIL_PROVIDER=resend` but keys missing.
- Config values normalized (trimmed, URL normalized, no trailing slash).

## Risk assessment

- Risk: accidental outbound mail from developer env.
  - Mitigation: default provider `none`, explicit opt-in only.

## Security considerations

- Never log `RESEND_API_KEY` or webhook secret.
- Restrict sender config to environment vars only.

## Next steps

- Phase 2 consumes config for concrete sender implementation.

## Unresolved questions

- None.
