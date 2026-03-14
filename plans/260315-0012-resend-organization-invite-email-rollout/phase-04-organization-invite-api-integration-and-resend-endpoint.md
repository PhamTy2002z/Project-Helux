---
phase: 4
title: "Organization invite API integration and resend endpoint"
status: completed
effort: 2h
---

# Phase 4: Organization invite API integration and resend endpoint

## Context links

- `backend/app/api/organizations.py`
- `backend/app/models/organization_invites.py`
- `frontend/src/app/(app)/organization/page.tsx`

## Overview

Trigger async email delivery after invite creation commit. Add explicit resend
endpoint for admins to re-queue delivery without generating a new invite token.

## Key insights

- Current API returns token immediately; keep this behavior.
- Enqueue must happen post-commit to avoid orphan queue tasks.
- Resend endpoint reduces support overhead when first delivery misses inbox.

## Requirements

- Functional:
  - On create invite: enqueue send task after commit.
  - Add `POST /api/v1/organizations/me/invites/{invite_id}/resend`.
  - Reject resend for accepted invites.
- Non-functional:
  - API remains backward compatible for current frontend.
  - Queue failure must not fail invite creation.

## Architecture

- Existing `create_org_invite` flow:
  1. persist invite
  2. commit
  3. enqueue send task (best-effort)
- New resend route:
  1. validate admin + invite status
  2. enqueue send task
  3. return invite payload

## Related code files

Modify:
- `backend/app/api/organizations.py`
- `backend/app/schemas/organizations.py` (only if response payload changed)
- `frontend/src/app/(app)/organization/page.tsx` (optional: add resend action)

Create:
- none required

Delete:
- none

## Implementation steps

1. Add helper `_enqueue_invite_email_send(...)` in organizations API/service layer.
2. In `create_org_invite`, call helper after `commit` and `refresh`.
3. Add resend endpoint with guardrails:
   - invite belongs to active org
   - not accepted
   - optional cooldown by `updated_at` window
4. Keep response contract stable.
5. Optional frontend enhancement:
   - add “Resend email” action in invites table
   - surface success/error toast

## Todo list

- [x] Add post-commit enqueue in create-invite route.
- [x] Add resend invite endpoint.
- [x] Add accepted-invite guard.
- [x] Add optional frontend resend action.
- [x] Add API tests for both paths.

## Success criteria

- Creating invite queues one email task.
- Resend endpoint queues another send attempt safely.
- Existing copy-link flow still works with no regressions.

## Risk assessment

- Risk: enqueue failure hidden from admin.
  - Mitigation: log warning + optional response hint field in future phase.
- Risk: spam by repeated resend clicks.
  - Mitigation: apply cooldown or rate-limit per invite.

## Security considerations

- Only org admin/owner can trigger resend.
- Do not expose token in error messages.

## Next steps

- Phase 5 hardens behavior with tests and operational signals.

## Unresolved questions

- Decide if resend cooldown is strict in phase 2 or deferred again.
