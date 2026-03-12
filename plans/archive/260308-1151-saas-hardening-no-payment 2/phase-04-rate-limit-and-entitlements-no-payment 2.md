# Phase 4: Rate Limiting and Entitlements (No Payment)

## Context Links

- Plan overview: [plan.md](./plan.md)
- Current roadmap notes: `docs/project-roadmap.md`
- API docs gap on limits: `docs/reference/api.md`

## Overview

- **Priority:** P1
- **Status:** Completed (2026-03-08)
- **Effort:** 5d

Add anti-abuse and packaging controls required for SaaS beta without billing integration.

## Key Insights

- No first-class quota/entitlement model exists in current backend schemas.
- Rate limiting is documented as future work, not implemented.
- No-payment phase still needs plan-based limits to protect infra and support operations.

## Requirements

Functional:
- Add per-IP and per-user/org rate limiting policies.
- Introduce manual plan model (`free`, `beta`, `pro`) with entitlements and quotas.
- Provide API/UI surfaces to view current quota usage and limit status.

Non-functional:
- Rate limiting should degrade gracefully with clear error payloads.
- Quota calculations should be cheap and cache-friendly.

## Architecture

Core components:
- `organization_plans` table: org -> plan, effective dates, metadata.
- `entitlement_policies` static config map by plan tier.
- `usage_counters` derived from existing entities or periodic rollups.
- Request limiter middleware using Redis token bucket/leaky bucket.

No-payment control flow:
1. Admin assigns plan manually.
2. Entitlement service resolves limits.
3. Mutating endpoints enforce limits before write.
4. API returns machine-readable quota errors.

## Related Code Files

Modify:
- `backend/app/core/config.py`
- `backend/app/main.py` (middleware wiring)
- `backend/app/api/organizations.py` (plan assignment surface)
- `backend/app/api/metrics.py` (usage visibility)

Create:
- `backend/app/models/organization_plans.py`
- `backend/app/services/rate_limit.py`
- `backend/app/services/entitlements.py`
- `backend/app/schemas/entitlements.py`

Add tests:
- `backend/tests/core/test_rate_limit.py`
- `backend/tests/services/test_entitlements.py`
- `backend/tests/api/test_quota_enforcement.py`

## Implementation Steps

1. Define plan tiers and quotas with product/ops alignment.
2. Implement rate limit middleware and redis-backed counters.
3. Add organization plan model + CRUD/admin assignment endpoint.
4. Implement entitlement checks for critical creation endpoints.
5. Add quota usage endpoint and UI integration hooks.
6. Add docs for limits and quota error codes.

## Todo List

- [x] Finalize tier definitions and quotas.
- [x] Implement rate limit middleware.
- [x] Create plan/entitlement service.
- [x] Enforce quotas on high-cost endpoints.
- [x] Expose usage/limit telemetry.

## Success Criteria

- Burst abuse is throttled consistently.
- Org plan controls are enforceable without payment system.
- Users receive clear responses when hitting limits.

## Risk Assessment

- Risk: false positives throttle legitimate users.
- Mitigation: conservative initial thresholds + observability + override controls.

## Security Considerations

- Prevent brute-force and resource exhaustion patterns.
- Ensure quotas are checked server-side only.

## Next Steps

- Feed quota/limit metrics into Phase 6 observability dashboards.
