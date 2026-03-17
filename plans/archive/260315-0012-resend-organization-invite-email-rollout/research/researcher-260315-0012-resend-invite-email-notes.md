# Resend invite email notes

## Scope decision

- Implement org invite email first.
- Do not add password reset flow in this phase.

## Key references

- Resend send email API
- Resend python SDK usage
- Resend idempotency key behavior
- Resend webhook verification and event types

## Integration notes

- Use idempotency key per invite send attempt.
- Keep invite creation API non-blocking via queue enqueue.
- Use existing worker retry policy.

## Risks

- Provider/network transient failures.
- Domain setup issues affecting deliverability.

## Mitigations

- Retry with capped attempts.
- Fallback to manual copy-link flow.
- Add structured logs for send lifecycle.

## Unresolved questions

- Should resend endpoint enforce cooldown in phase 1?
