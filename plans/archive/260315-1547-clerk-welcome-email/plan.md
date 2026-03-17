---
title: "Clerk Welcome Email on Signup"
description: "Send welcome email via Resend when user signs up through Clerk webhook"
status: complete
priority: P2
effort: 4h
branch: develop
tags: [backend, email, clerk, webhook]
created: 2026-03-15
completed: 2026-03-15
---

# Clerk Welcome Email on Signup

## Overview

Add welcome email delivery when new users sign up via Clerk. Leverage existing Resend email infrastructure (queue, worker, sender) and Clerk webhook `user.created` event.

## Architecture

```
Clerk (user.created event)
  → POST /api/v1/webhooks/clerk
    → Verify Svix signature
    → Extract user email + name
    → Enqueue welcome_email_send task
      → Redis queue (existing)
        → Worker picks up
          → Build welcome email (HTML + text)
          → Send via Resend API
```

## Phases

| # | Phase | Status | Effort | Link |
|---|-------|--------|--------|------|
| 1 | Welcome email template + sender | Complete | 1h | [phase-01](./phase-01-welcome-email-template.md) |
| 2 | Queue + worker for welcome email | Complete | 1h | [phase-02](./phase-02-queue-worker.md) |
| 3 | Clerk webhook endpoint | Complete | 1.5h | [phase-03](./phase-03-clerk-webhook-endpoint.md) |
| 4 | Tests | Complete | 0.5h | [phase-04](./phase-04-tests.md) |

## Dependencies

- Clerk account with webhook configured for `user.created`
- `CLERK_WEBHOOK_SECRET` env var for Svix signature verification
- Existing Resend email provider (`EMAIL_PROVIDER=resend`)
- Existing Redis queue + worker infrastructure

## Key Decisions

- **Reuse generic Resend send** — extract shared helper from invite sender to avoid duplication
- **Svix verification** — Clerk uses Svix for webhook signing; use `svix` Python package
- **No new DB model** — welcome emails are fire-and-forget, no tracking table needed
- **AUTH_MODE guard** — only process webhook when `AUTH_MODE=clerk`
