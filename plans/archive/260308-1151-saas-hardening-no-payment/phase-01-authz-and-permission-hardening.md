# Phase 1: Authz and Permission Hardening

## Context Links

- Plan overview: [plan.md](./plan.md)
- Auth dependency wiring: `backend/app/api/deps.py`
- Current admin check helper: `backend/app/services/admin_access.py`
- Agent API surface: `backend/app/api/agents.py`

## Overview

- **Priority:** P1
- **Status:** Completed (2026-03-08)
- **Effort:** 4d

Close authorization holes and normalize permission checks for all tenant-sensitive mutations.

## Key Insights

- Current `require_admin` validates actor type only, not organization role.
- At least one sensitive endpoint (`rotate-token`) currently misses org-admin + ownership checks.
- Large API surface increases policy drift risk unless policy gates are centralized.

## Requirements

Functional:
- Enforce org-scoped admin checks for all tenant-sensitive mutations.
- Ensure all resource mutations validate resource belongs to active org.
- Add deny-by-default patterns for ambiguous actor contexts.

Non-functional:
- No regression for approved agent flows.
- Policy logic must be centralized, testable, and reusable.

## Architecture

Target policy stack:
1. Request auth context (user or agent).
2. Organization membership and role resolution.
3. Resource ownership check (`resource.organization_id == active_org_id` or resolved via board/gateway).
4. Operation-level permission check (`read`, `write`, `admin`).

Pseudo-policy helper:
```python
async def require_org_admin_for_agent(session, user, agent_id, active_org_id):
    agent = await Agent.objects.by_id(agent_id).first(session)
    if agent is None:
        raise HTTPException(404)
    agent_org_id = await resolve_agent_org_id(session, agent)
    if agent_org_id != active_org_id:
        raise HTTPException(403)
    await require_org_admin_role(session, user, active_org_id)
```

## Related Code Files

Modify:
- `backend/app/services/admin_access.py`
- `backend/app/api/deps.py`
- `backend/app/api/agents.py`
- `backend/app/api/gateway.py`
- `backend/app/api/gateways.py`

Add tests:
- `backend/tests/api/test_agents_authz.py`
- `backend/tests/api/test_gateways_authz.py`
- `backend/tests/api/test_deps_permissions.py`

## Implementation Steps

1. Inventory all mutation endpoints and classify by sensitivity.
2. Implement stricter helper APIs in `admin_access.py` and/or `deps.py`.
3. Patch sensitive endpoints to consume strict helpers.
4. Add ownership checks where endpoint currently fetches by id without org-bound guard.
5. Add table-driven authz tests (allowed/denied matrix by role and org).
6. Add regression tests for existing valid flows.

## Todo List

- [x] Build endpoint sensitivity inventory.
- [x] Introduce strict org-admin helper(s).
- [x] Fix `agents.rotate-token` and similar endpoints.
- [x] Add unit + API tests for permission matrix.
- [x] Document policy map in API reference.

## Success Criteria

- No tenant-sensitive mutation endpoint bypasses org-admin/ownership checks.
- New tests cover cross-org negative cases and pass in CI.
- Authz logic reuse increased; inline ad-hoc checks reduced.

## Risk Assessment

- Risk: over-restricting legitimate service account actions.
- Mitigation: explicit allowlist for service flows, tested with fixtures.

## Security Considerations

- Treat every ID-based endpoint as potential horizontal privilege escalation vector.
- Always resolve org from resource, not only from client payload.

## Next Steps

- Feed hardened permissions into Phase 2 auth-mode tightening.
