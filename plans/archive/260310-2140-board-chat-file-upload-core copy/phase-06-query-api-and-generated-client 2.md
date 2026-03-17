# Phase 6: Query API and Generated Client

## Context Links
- [Board memory schema](../../backend/app/schemas/board_memory.py)
- [Board memory API client](../../frontend/src/api/generated/board-memory/board-memory.ts)
- [Board chat messages hook](../../frontend/src/lib/hooks/use-board-chat-messages.ts)
- [Main app router registration](../../backend/app/main.py)

## Overview
- **Priority**: P2
- **Status**: pending
- **Effort**: 2h

Expose read APIs for files/reports/status and regenerate frontend client types.

## Key Insights
- Current frontend only reads `BoardMemoryRead` and chat stream events.
- UI requirement #4 needs explicit file/report visibility per message.
- Avoid bloating `BoardMemoryRead` too much with heavy report payloads.

## Requirements
- Functional:
  - List files for a chat session.
  - Read per-file reports and task status.
  - Include lightweight attachment metadata in chat message payloads.
- Non-functional:
  - Keep response size bounded.
  - Preserve backward compatibility for existing board memory consumers.

## Architecture
- New endpoints:
  - `GET /api/v1/boards/{board_id}/chat-files`
  - `GET /api/v1/boards/{board_id}/chat-files/{file_id}`
  - `GET /api/v1/boards/{board_id}/chat-files/{file_id}/reports`
- Optional `BoardMemoryRead` extension:
  - `attachments?: BoardChatMessageAttachmentRead[]` (lightweight only).
- Client regeneration via existing `make api-gen` flow.

## Related Code Files
### Files to modify:
- `backend/app/main.py` - router wiring if phase 2 omitted.
- `backend/app/schemas/board_memory.py` - optional lightweight attachment field.
- `frontend/src/lib/hooks/use-board-chat-messages.ts` - consume attachment fields.

### Files to create:
- `backend/app/api/board_chat_files.py` (if not completed in phase 2)
- `backend/app/schemas/board_chat_files_read.py`

### Files to delete:
- None.

## Implementation Steps
1. Add read schemas for file asset, task status, and report summary/detail.
2. Implement list/detail/report endpoints with board access enforcement.
3. Add pagination/query filters (`chat_session_id`, `message_id`, `status`).
4. Extend chat list/stream serializer to include attachment summary metadata.
5. Regenerate frontend API client (`make api-gen`) and verify generated types compile.

## Todo List
- [ ] File list/detail/report endpoints implemented.
- [ ] Attachment summary exposed in chat payloads.
- [ ] API client regenerated and type-safe imports updated.
- [ ] Backward compatibility for old consumers verified.

## Success Criteria
- Frontend can fetch files and reports without custom ad-hoc calls.
- Chat messages include enough metadata to render attachment chips.
- OpenAPI spec includes new routes and schemas.

## Risk Assessment
- Risk: N+1 queries for message attachment loading.
  - Mitigation: batch query attachment maps by message ids.
- Risk: large report payloads slow list endpoints.
  - Mitigation: split summary and detail endpoints.

## Security Considerations
- Enforce board-level auth on every file/report read route.
- Redact internal storage object keys from public DTOs.

## Next Steps
- Phase 7 wires full chat UI with uploader, chips, and report drawer.
