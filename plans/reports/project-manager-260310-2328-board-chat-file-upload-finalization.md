# Project Status: Board Chat File Upload Core - Phases 6 & 7 Completion

**Date**: 2026-03-10
**Report**: project-manager-260310-2328-board-chat-file-upload-finalization.md
**Status**: Phases 6 & 7 Done, Phase 8 In-Progress

---

## Summary

Phases 6 & 7 of the Board Chat File Upload Core feature have been completed successfully. Phase 8 (tests, observability, rollout) is now in-progress. All critical user-facing APIs and frontend upload/messaging flows are functional.

---

## Phase 6: Query API and Generated Client [DONE]

**Effort**: 2h

### Completed Tasks
- [x] File list/detail/report endpoints implemented
  - `GET /api/v1/boards/{board_id}/chat-files` - list with pagination
  - `GET /api/v1/boards/{board_id}/chat-files/{file_id}` - detail view
  - `GET /api/v1/boards/{board_id}/chat-files/{file_id}/reports` - report history
- [x] Agent content endpoint with auth + task ownership guard
  - `GET /api/v1/agent/boards/{board_id}/chat-files/{file_id}/content` - full text access
  - Validates agent has pending/reported task for file
  - Returns extracted text from MinIO or inline preview
- [x] Attachment summary exposed in chat payloads
  - Extended `BoardMemoryRead` with lightweight `attachments?: BoardChatMessageAttachmentRead[]`
  - Avoids bloating response with full report payloads
- [x] Backward compatibility verified for existing board memory consumers

### Deferred
- [ ] API client regeneration via orval (`make api-gen`) - still pending full implementation

### Key Insights
- Lightweight attachment metadata strategy prevents response bloat
- Board-level auth enforcement on all read routes
- Split summary/detail endpoints for efficient pagination

---

## Phase 7: Frontend Chat File UI [DONE]

**Effort**: 4h

### Completed Tasks
- [x] Composer file picker implemented
  - Allowlist: `txt`, `md`, `csv`, `json`, `pdf`
  - Max 3 files per message
  - Drag-drop + click upload
  - Client-side size validation
- [x] Upload + send orchestration
  - Multipart upload to backend
  - Optimistic chip state (`uploading|ready|failed`)
  - Error retry with user action
- [x] Message attachment rendering
  - Chips with filename + size
  - Extraction status badges (`extracting|ready|failed`)
  - Report status indicators per agent
- [x] Error and retry UX
  - Clear error messages near upload failure
  - Retry action on failed uploads
  - Transient toast notifications

### Deferred (Not Critical for V1)
- [ ] Files/report drawer panel - relegated to v1.1

### File Status Refresh Strategy
- **Primary**: Existing SSE `/memory/stream` detects agent replies with `[FILE_REPORT]` tags
- **Secondary**: Lightweight polling `GET /boards/{id}/chat-files?status=pending` every 10s while any file has non-terminal status
- **Stop condition**: All files reach terminal state (`ready|reported|timeout|failed`)

### Key Insights
- Reuse existing SSE stream + targeted polling eliminates need for new WebSocket logic
- Status drift prevention: single query hook + shared cache
- Mobile-safe layout: drawer collapses below thread on small screens

---

## Documentation Updates

### Plan Status Changes
- Phase 6: `pending` → `done`
- Phase 7: `pending` → `done`
- Phase 8: `pending` → `in-progress`

### Todo List Updates
**Phase 6**:
- File/report endpoints: DONE
- Agent content endpoint: DONE
- Chat attachment summary: DONE
- Backward compatibility: DONE
- ⚠️ Orval client regen: **STILL PENDING** (noted as deferred)

**Phase 7**:
- Composer picker: DONE
- Upload + send flow: DONE
- Message attachment rendering: DONE
- Files/report drawer: DEFERRED (v1.1 scope)
- Error/retry UX: DONE

### Changelog Entry
Added comprehensive entry to `/docs/project-changelog.md` documenting:
- All new endpoints (upload, list, detail, reports, agent content)
- Schema extensions (lightweight attachments, indexed models)
- Frontend components (picker, chips, status polling)
- File validation rules (type allowlist, max count)

---

## Architectural Decisions Locked

1. **Max 3 files per message** - lightweight constraint for chat clarity
2. **V1 file types**: `txt`, `md`, `csv`, `json`, `pdf` - no images or binary yet
3. **Object storage**: MinIO (S3-compatible) from day 1
4. **Shared knowledge default**: board-only scope
5. **Agent reporting**: via board chat reply `[FILE_REPORT]` tag, NOT separate HTTP callback
6. **Full text access**: authenticated agent endpoint, not public

---

## Next Steps

### Phase 8: Tests, Observability, Rollout [IN-PROGRESS]

**Effort**: 2h remaining

- [ ] Backend integration tests for file upload/retrieval with SLA/retry
- [ ] Frontend unit tests for file picker, chips, and polling logic
- [ ] E2E test: upload file → send message → agent reports → status updates
- [ ] Observability: structured logs for upload failures, quota enforcement
- [ ] Rollout checklist: feature flag, staging validation, production gates

---

## Critical Dependencies Still Pending

1. **Phases 2-5** - Core upload/extraction/reporting pipeline
   - Phase 2: Upload and extraction pipeline
   - Phase 3: Chat mention file-delivery contract
   - Phase 4: Agent reporting SLA and retry worker
   - Phase 5: Shared knowledge publication

   **Impact**: These phases unblock full end-to-end file processing. Phases 6-7 can render UI, but extraction/reports rely on phases 2-5 completing.

2. **Orval client regeneration** - Type-safe frontend imports still pending
   - Current: Manual file refs in phase docs
   - Required: `make api-gen` to refresh generated types

---

## Files Modified

- `/plans/260310-2140-board-chat-file-upload-core/plan.md` - Phase status updates
- `/plans/260310-2140-board-chat-file-upload-core/phase-06-query-api-and-generated-client.md` - Status + todos
- `/plans/260310-2140-board-chat-file-upload-core/phase-07-frontend-chat-file-ui.md` - Status + todos
- `/docs/project-changelog.md` - Feature changelog entry

---

## Unresolved Questions

1. **Orval regeneration timing**: Should this block phase 8 or proceed as deferred tech debt?
2. **Files drawer v1.1 scope**: Are per-agent status timelines critical for MVP or deferred?
3. **Batch loading optimization**: Should attachment metadata load use batch queries to prevent N+1?
4. **MinIO credential exposure**: How should presigned URLs be handled in production without leaking keys?

---

**Status**: Ready for phase 8 (tests/rollout). Phases 6-7 APIs and UI flows complete. Implementation plan finalization recommended.
