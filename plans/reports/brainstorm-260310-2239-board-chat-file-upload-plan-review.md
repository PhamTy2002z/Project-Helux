# Brainstorm Report: Board Chat File Upload Plan Review

**Date**: 2026-03-10 | **Plan**: `260310-2140-board-chat-file-upload-core`

## Objective
Validate plan feasibility by cross-referencing OpenClaw codebase mechanisms and Project-Helux architecture.

## Research Conducted
- Full scout of `/Users/typham/projects/openclaw` (file upload, chat, storage, API, gateway protocol)
- Full scout of Project-Helux (board memory, mentions, gateway dispatch, queue, frontend chat components)

## Key OpenClaw Findings
- **File upload**: Channel-based, image-first `parseMessageWithAttachments`. Non-image docs unreliable.
- **Chat**: WebSocket gateway protocol v3, RPC-style. NOT REST.
- **Media understanding**: `applyMediaUnderstanding` appends `<file>` blocks after extraction.
- **agents.files.***: Workspace allowlist only (AGENTS.MD, MEMORY.MD), not generic upload.
- **Storage**: Local-first, SQLite per agent, no S3/cloud in core.
- **No board/kanban system**: OpenClaw is messaging gateway, not PM tool.

## Plan Verdict: WORKABLE with 4 fixes applied

### Fix 1: Agent Callback Mechanism (CRITICAL)
- **Problem**: Plan assumed agent makes direct HTTP POST to report endpoint. OpenClaw agents interact via WebSocket gateway; direct HTTP unreliable.
- **Fix**: Agent replies via board chat with structured `[FILE_REPORT:{file_id}]` tag. Mission Control parses report from reply content. No new agent-side protocol needed.
- **Files updated**: Phase 3 (delivery instructions), Phase 4 (complete rewrite to reply-parsing), plan.md (locked decisions)

### Fix 2: Agent Full Content Access (MISSING)
- **Problem**: Plan only sends truncated preview (500 chars). No mechanism for agent to access full extracted text.
- **Fix**: Added `GET /api/v1/agent/boards/{id}/chat-files/{file_id}/content` endpoint. Agent auth + task ownership validation.
- **Files updated**: Phase 3 (content URL in gateway message), Phase 6 (new endpoint spec), plan.md

### Fix 3: Gateway Message Size Budget (RISK)
- **Problem**: No hard limits defined. 5+ files with long previews could exceed LLM context.
- **Fix**: Hard cap: max 3 files/message, 500 chars preview/file. Enforced at API level. Config: `board_chat_file_max_per_message=3`, `board_chat_file_preview_max_chars=500`.
- **Files updated**: Phase 1 (config), Phase 3 (limits in architecture + validation), plan.md

### Fix 4: File Status Refresh Strategy (GAP)
- **Problem**: SSE stream only emits memory events. File status changes (extracting→ready, pending→reported) not covered.
- **Fix**: Reuse existing SSE memory stream (agent reply = new memory event → triggers cache invalidation). Add targeted polling `GET /chat-files?status=pending` every 10s for non-terminal files. No SSE extension needed.
- **Files updated**: Phase 7 (data flow + refresh strategy)

## Updated Plan Files
- `plan.md` — 3 new locked decisions, 1 new OpenClaw constraint
- `phase-01` — added `board_chat_file_max_per_message` config
- `phase-03` — hard limits, content URL, report instructions format
- `phase-04` — complete rewrite: reply-parsing instead of HTTP callback
- `phase-06` — agent content endpoint added
- `phase-07` — file status refresh strategy clarified
- `reports/researcher-openclaw-alignment.md` — 4 resolved design decisions added

## Unresolved Questions
- None.
