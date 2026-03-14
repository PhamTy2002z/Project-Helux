---
phase: 2
title: "Invite email contract and resend sender"
status: completed
effort: 2h
---

# Phase 2: Invite email contract and resend sender

## Context links

- `backend/app/services/polar_client.py` (existing external client pattern)
- `backend/app/services/webhooks/dispatch.py` (structured log patterns)
- Resend docs: send API, idempotency, python sdk

## Overview

Create a small email domain layer for organization invites: payload contract,
message builder, and Resend sender adapter.

## Key insights

- Keep one use case now: invite email.
- Deterministic idempotency key avoids duplicate sends during retries.
- Message composition must avoid exposing raw token in logs.

## Requirements

- Functional:
  - Build invite URL from `invite_accept_base_url` + token.
  - Generate subject + html + text body.
  - Send via Resend when provider enabled.
- Non-functional:
  - SDK error handling must classify retryable/non-retryable failures.
  - Keep function signatures typed and testable.

## Architecture

- `organization_invite_email.py`: pure builder for subject/html/text.
- `email_sender.py`: provider-agnostic send interface.
- `resend_sender.py`: concrete provider adapter.

## Related code files

Create:
- `backend/app/services/email/organization_invite_email.py`
- `backend/app/services/email/email_sender.py`
- `backend/app/services/email/resend_sender.py`

Modify:
- `backend/app/services/__init__.py` (if exports needed)

Delete:
- none

## Implementation steps

1. Define typed payload contract for invite email send input.
2. Implement URL-safe message builder:
   - friendly subject
   - concise plain text
   - minimal HTML with explicit accept button and fallback URL
3. Implement resend adapter:
   - init by settings
   - map payload to `resend.Emails.send(...)`
   - pass `idempotency_key` option
4. Normalize reply-to handling (optional when empty).
5. Add structured logs:
   - `email.invite.send_started`
   - `email.invite.send_succeeded`
   - `email.invite.send_failed`

## Todo list

- [x] Define typed send contract.
- [x] Implement invite email builder.
- [x] Implement resend sender.
- [x] Add idempotency key wiring.
- [x] Add non-sensitive structured logging.

## Success criteria

- Sender can send one invite email with deterministic idempotency key.
- Builder output contains valid accept URL and fallback text URL.
- Errors surfaced with retry classification metadata.

## Risk assessment

- Risk: malformed URL due base URL/token concatenation.
  - Mitigation: dedicated URL join helper + test coverage.
- Risk: duplicate send on retries.
  - Mitigation: deterministic idempotency key.

## Security considerations

- Do not log invite token, email body, or full provider response payload.
- Escape dynamic text content in HTML template.

## Next steps

- Phase 3 wraps sender into queue pipeline for async delivery.

## Unresolved questions

- None.
