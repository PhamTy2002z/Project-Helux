# Phase 3: Chat Mention File-Delivery Contract

## Context Links
- [Board memory API](../../backend/app/api/board_memory.py)
- [Board memory schema](../../backend/app/schemas/board_memory.py)
- [Mentions helper](../../backend/app/services/mentions.py)
- [Gateway dispatch](../../backend/app/services/openclaw/gateway_dispatch.py)

## Overview
- **Priority**: P1
- **Status**: pending
- **Effort**: 4h

Bind uploaded files to chat messages and deliver deterministic file context to mentioned agents.

## Key Insights
- Mention routing already exists in `_notify_chat_targets`.
- Current message contract only sends text snippet.
- Requirement #1 needs per-agent per-file delivery state.

## Requirements
- Functional:
  - Allow chat message create with uploaded `file_ids`.
  - Persist message<->file links.
  - Create `board_chat_file_tasks` rows for mention targets.
  - Send gateway message that includes manifest + extracted preview blocks.
- Non-functional:
  - Keep old text-only chat behavior unchanged.
  - Avoid exploding prompt size with large extract text.

## Architecture
- Extend `BoardMemoryCreate` with optional `file_ids: list[UUID]`.
- In `create_board_memory` when `is_chat=true` and `file_ids` present:
  - Validate assets belong to same board/session.
  - Persist join rows.
  - Resolve mention targets.
  - Create task rows `(file_id, agent_id, status=pending)`.
- Dispatch message format:
  - existing header + snippet
  - `File Manifest` section
  - capped `<file name="..." mime="...">preview</file>` blocks
  - callback instructions for report API.

## Related Code Files
### Files to modify:
- `backend/app/schemas/board_memory.py`
- `backend/app/api/board_memory.py`
- `backend/app/models/board_memory.py` (only if extra denormalized fields needed)

### Files to create:
- `backend/app/services/board_chat_files/delivery.py`
- `backend/app/services/board_chat_files/message_contract.py`

### Files to delete:
- None.

## Implementation Steps
1. Extend board memory create payload with optional `file_ids`.
2. Validate `file_ids` ownership and extraction state (`ready` preferred, allow `uploaded/extracting` with notice).
3. Persist mapping rows in `board_chat_message_files`.
4. Build per-agent task rows in `board_chat_file_tasks`.
5. Refactor `_notify_chat_targets` to call delivery service for file-aware payloads.
6. Mark task dispatch metadata (`dispatched_at`, `dispatch_attempts`, `next_retry_at`).
7. Keep `/pause` and `/resume` control path unchanged.

## Todo List
- [ ] Payload schema extended with `file_ids`.
- [ ] Message-file linking implemented.
- [ ] Mention target task creation implemented.
- [ ] File-aware gateway payload implemented.
- [ ] Existing text-only chat tests kept green.

## Success Criteria
- Mentioned agents receive payload containing file manifest and previews.
- Every `(file_id, mentioned_agent_id)` has a persisted task row.
- Non-mentioned agents do not get file task rows.
- Text-only chat behavior remains backward compatible.

## Risk Assessment
- Risk: prompt bloat from many files.
  - Mitigation: cap previews and max files per message.
- Risk: extraction not ready at send time.
  - Mitigation: include explicit "extraction pending" marker in payload.

## Security Considerations
- Validate board scope for every file id before linking.
- Escape/normalize extracted text before embedding in `<file>` blocks.
- Avoid sending raw signed URLs in gateway message payload.

## Next Steps
- Phase 4 adds agent callback endpoint and SLA retry lifecycle.
