# Scout Report - Board Planning Overlay Compatibility

## Scope
- Verify OpenClaw-agent-sensitive contracts that cannot break.
- Map current bottlenecks in board scaling UX.

## Findings
- Agent loop depends on 4-status task model and existing board task route.
- Task transition rules and board-rule gates are enforced server-side.
- Current board UI lacks global filters and renders full columns; scale risk high.
- Snapshot/list query model needs additive filtering and pagination path.

## Decision
- Use planning overlay model (`TaskGroup` + query v2 + feature flags).
- Keep existing task semantics and endpoints default behavior stable.

## Risks
- Prompt/template drift can cause agent route misuse.
- Complex query filters can degrade SQL plans without index design.

## Mitigation
- Contract tests + OpenAPI hint hardening.
- Index-aware query design + canary rollout + rollback playbook.
