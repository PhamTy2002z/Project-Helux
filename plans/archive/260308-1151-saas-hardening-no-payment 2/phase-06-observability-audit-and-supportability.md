# Phase 6: Observability, Audit and Supportability

## Context Links

- Plan overview: [plan.md](./plan.md)
- Metrics API: `backend/app/api/metrics.py`
- Activity model/service: `backend/app/models/activity_events.py`, `backend/app/services/activity_log.py`
- Logging core: `backend/app/core/logging.py`, `backend/app/core/error_handling.py`

## Overview

- **Priority:** P2
- **Status:** Completed (2026-03-08)
- **Effort:** 4d

Make tenant-level debugging, incident triage, and support workflows operationally viable.

## Key Insights

- Request ID plumbing exists and is useful baseline.
- Tenant-aware operational SLO metrics are still limited.
- Audit event coverage is broad but not explicitly complete for all admin-sensitive actions.

## Requirements

Functional:
- Add tenant-level slices for key metrics (error rate, latency, queue lag, quota usage).
- Ensure all admin-sensitive mutations emit structured audit events.
- Provide support playbook for incident triage by request id + org id.

Non-functional:
- Keep PII exposure minimal in logs and events.
- Logging format must be consistent for automated parsing.

## Architecture

Observability primitives:
- Correlated log fields: `request_id`, `organization_id`, `actor_id`, `endpoint`.
- Metrics dimensions by organization and endpoint class.
- Audit catalog mapping endpoint -> required event_type.

## Related Code Files

Modify:
- `backend/app/core/logging.py`
- `backend/app/api/metrics.py`
- `backend/app/services/activity_log.py`
- `backend/app/api/*` (where admin-sensitive actions need missing audit calls)
- `docs/operations/README.md`

Create:
- `docs/operations/incident-triage.md`
- `docs/reference/audit-catalog.md`

Add tests:
- `backend/tests/services/test_activity_audit_coverage.py`
- `backend/tests/api/test_metrics_tenant_dimensions.py`

## Implementation Steps

1. Define minimal SaaS SLO metrics and dimensions.
2. Extend metrics endpoints or exporters with tenant slices.
3. Build endpoint-to-audit-event catalog.
4. Backfill missing audit events in sensitive mutations.
5. Document support triage flow with concrete commands.

## Todo List

- [x] Finalize SLO metric list.
- [x] Add tenant dimensions for metrics.
- [x] Complete audit catalog.
- [x] Patch missing audit emissions.
- [x] Publish incident triage runbook.

## Success Criteria

- Support can isolate incident per tenant quickly.
- Audit trail exists for all privileged actions.
- Metrics can drive alerting and quota tuning.

## Risk Assessment

- Risk: high-cardinality metric labels.
- Mitigation: cap label sets and aggregate by bounded dimensions.

## Security Considerations

- No sensitive payload dumps in logs.
- Access to audit and metrics endpoints remains role-gated.

## Next Steps

- Consume metrics/audit outputs in Phase 7 go-live gates.
