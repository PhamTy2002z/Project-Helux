# Phase 5: Shared Knowledge Publication (Board Scope)

## Context Links
- [Board memory model](../../backend/app/models/board_memory.py)
- [Board group memory model](../../backend/app/models/board_group_memory.py)
- [Board memory API](../../backend/app/api/board_memory.py)
- [Board group memory API](../../backend/app/api/board_group_memory.py)

## Overview
- **Priority**: P2
- **Status**: pending
- **Effort**: 2h

Auto-publish report summaries into board memory so other agents can reuse knowledge immediately.

## Key Insights
- `board_memory` already serves durable board context.
- `board_group_memory` exists but rollout decision is board-only for now.
- Requirement #3 can be satisfied via tagged memory records without new retrieval protocol.

## Requirements
- Functional:
  - On successful report, write board memory summary entry (`is_chat=false`).
  - Tag entries for deterministic retrieval by future agents.
  - Keep optional hooks for board-group fanout later (disabled by default).
- Non-functional:
  - Avoid duplicate shared entries on report update retries.
  - Keep summary concise and query-friendly.

## Architecture
- New publisher service consumes `board_chat_file_reports` writes.
- Shared memory entry format:
  - `source`: `file-report:{agent_name}`
  - `tags`: `file_report`, `shared_knowledge`, `file:{id}`, `agent:{id}`
  - `content`: normalized summary + report metadata
- Feature flag placeholder: `board_chat_file_publish_group_memory=false`.

## Related Code Files
### Files to modify:
- `backend/app/services/board_chat_files/reporting.py`
- `backend/app/core/config.py`

### Files to create:
- `backend/app/services/board_chat_files/shared_knowledge.py`

### Files to delete:
- None.

## Implementation Steps
1. Implement `publish_board_shared_summary(report)` helper.
2. Ensure idempotency via deterministic dedupe key tag (`file_report:{file_id}:{agent_id}`).
3. Insert board memory row with `is_chat=false`.
4. Wire publisher call into report write path after successful persistence.
5. Add config flag for future board-group fanout and keep disabled in v1.

## Todo List
- [ ] Shared summary publisher service implemented.
- [ ] Idempotent dedupe for repeated report updates implemented.
- [ ] Board memory entry format finalized and tagged.
- [ ] Board-group fanout flag added but disabled.

## Success Criteria
- New report creates exactly one board shared knowledge memory entry.
- Other agents can retrieve summary through existing board memory read endpoint.
- No board-group memory writes occur by default.

## Risk Assessment
- Risk: noisy memory feed if every retry republishes.
  - Mitigation: deterministic dedupe key and upsert semantics.
- Risk: summary quality too low for reuse.
  - Mitigation: require non-empty summary in report schema.

## Security Considerations
- Do not include raw file content in shared summary unless needed.
- Preserve board tenancy boundaries; no cross-board writes.

## Next Steps
- Phase 6 exposes file/report read APIs for UI and operator visibility.
