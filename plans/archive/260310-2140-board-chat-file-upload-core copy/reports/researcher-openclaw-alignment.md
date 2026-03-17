# Researcher Report: OpenClaw Alignment for Board Chat File Upload

## Scope
Validate OpenClaw constraints that affect Mission Control file-upload design.

## Findings
1. `chat.send` attachment parsing path (`parseMessageWithAttachments`) normalizes to image blocks and drops non-image attachments.
2. Media-understanding path (`applyMediaUnderstanding`) appends `<file ...>` blocks after extracting text from attachments.
3. `agents.files.*` endpoints are workspace allowlist operations, not generic upload/file storage APIs.
4. Current Mission Control board chat dispatch sends text command payloads only; no file contract exists.

## Design Impact
- Must not rely on direct `chat.send` attachments for `txt/md/csv/json/pdf` deterministic visibility.
- Need Mission Control-managed ingest/extract/persist/report pipeline.
- Mention routing must include file manifest + extracted preview contract.
- Agent report must use board chat reply with structured `[FILE_REPORT]` tag — NOT separate HTTP callback (agent interacts via WebSocket gateway, direct HTTP unreliable).
- Agent needs content-access API endpoint to retrieve full extracted text beyond preview.

## Resolved Design Decisions (from brainstorm review 2026-03-10)
1. **Agent callback**: Board chat reply with `[FILE_REPORT:{file_id}]` tag. MC parses from agent message content.
2. **Full content access**: `GET /agent/boards/{id}/chat-files/{file_id}/content` with agent auth.
3. **Message size limits**: Max 3 files/message, 500 chars preview/file. Enforced at API level.
4. **File status refresh**: Reuse existing SSE memory stream + targeted polling (10s interval for pending files).

## Unresolved Questions
- None.
