# Brainstorm: Board Chat File Upload (OpenClaw-aligned)

## Problem
Need core feature: upload file in board chat so mentioned agent really reads/processes file, writes summary/report, other agents can reuse knowledge, UI shows uploaded files.

Hard constraint: implementation must align with real OpenClaw mechanics, not assumptions.

## OpenClaw Reality (validated)
1. `chat.send`/`agent` attachments are parsed by `parseMessageWithAttachments` and converted to `images[]` only.
2. Non-image attachments are dropped from this path (warning log), not guaranteed agent-visible.
3. OpenClaw has separate media pipeline (`applyMediaUnderstanding`) that can append `<file ...>` blocks with extracted text for document-like attachments.
4. `agents.files.*` is not generic file storage API. It only allows a fixed allowlist of workspace files (`AGENTS.md`, `SOUL.md`, `MEMORY.md`, etc.).
5. Mission Control currently dispatches board chat to agents as text via gateway `chat.send`; no file object exists in board chat payload.

Implication: if we naively pass docs via gateway attachments, requirement #1 fails for non-image files.

## Current Helux Gap
- `BoardMemoryCreate` has `content/tags/source/chat_session_id` only.
- No upload endpoint, no file model/table, no extraction service, no attachment rendering in board chat UI.
- Mention routing exists, but file context cannot be attached to agent notification contract.

## Options

### Option A: Gateway attachment passthrough
- Idea: add `attachments` to `chat.send` payload from Helux.
- Pros: minimal API changes.
- Cons: only reliable for images; docs/pdf/csv/txt not guaranteed visible to agent. Violates core requirement.
- Verdict: reject for core.

### Option B: Workspace file staging per agent + path-based prompts
- Idea: upload file, copy/symlink into each target agent workspace, notify agent with file path.
- Pros: agent can read real file via tools.
- Cons: replication complexity, path/sandbox permission risks, cleanup burden, race conditions across agents.
- Verdict: feasible but high ops complexity for v1.

### Option C (Recommended): Ingest + Extract + File Task Contract + Shared Report
- Idea: platform-level file ingest in Helux, extract text (and preview), persist file metadata, notify mentioned agents with explicit file references + extracted context block, require structured report persisted server-side, auto-publish shared summary memory.
- Pros: deterministic, auditable, OpenClaw-compatible for docs, independent from gateway attachment limitations, strong UX observability.
- Cons: more backend work upfront.
- Verdict: best fit for “core feature”.

## Recommended Architecture (Option C)

### 1) Data model
Add:
- `board_chat_file_assets`
  - `id`, `board_id`, `chat_session_id`, `uploader_user_id`, `storage_path`, `filename`, `mime_type`, `size_bytes`, `sha256`, `extract_status`, `extract_preview`, `extract_text_ref`, `created_at`.
- `board_chat_message_files`
  - `id`, `board_memory_id`, `file_asset_id`, `position`.
- `board_chat_file_reports`
  - `id`, `file_asset_id`, `agent_id`, `board_memory_id`, `report_type(summary|detailed)`, `summary`, `details_json`, `created_at`.

Keep `board_memory` as canonical chat stream; attachments linked by join table.

### 2) Upload + extraction pipeline
- New endpoint `POST /api/v1/boards/{board_id}/chat-files` (multipart).
- Validate allowlist mime + size (start strict: txt/md/csv/json/pdf; optional png/jpg).
- Store in local managed storage path (or object storage later).
- Extract text preview synchronously for small files, async worker for larger files.
- For PDFs: extract text first; if low text, mark as `image_pdf` and produce fallback notice.

### 3) Mentioned-agent delivery contract
On message send with files:
- Create `board_memory` chat row.
- Link attachments.
- Resolve mention targets using current logic.
- Send agent notification containing:
  - user message snippet,
  - file manifest (`file_id`, filename, mime, checksum),
  - extracted preview block using OpenClaw-like `<file name="..." mime="...">...</file>` format,
  - required callback instruction: submit report via API.

Do not rely on gateway attachments for documents.

### 4) Report capture + shared knowledge
- New agent route `POST /api/v1/agent/boards/{board_id}/chat-files/{file_id}/reports`.
- Agent must post at least summary.
- Server auto-writes shared memory entry:
  - board-local: non-chat `board_memory` tags `file_report,shared_knowledge,file:<id>`.
  - optional board-group fanout (if board has group): `board_group_memory` same tags.

This makes other agents queryable via existing memory endpoints.

### 5) UI proposal (new in board chat)
- Composer:
  - attach button + drag/drop zone,
  - selected file chips with remove/retry.
- Message bubble:
  - attachment chips (name, size, status),
  - report badge (e.g., `Analyzed`, `Pending`, `Failed`).
- Right-side drawer: “Files & Reports”
  - per file: extraction status, analyzed agents, latest summary, open detailed report.
- Session-level filter: show only messages/files with attachments.

## Processing Guarantees for 4 Requirements
1. Mentioned agent really sees/processes file:
- deterministic per-target dispatch + persisted `file_task` state + required report callback.

2. Summary/report exists:
- enforce report write API; track `report_status` per `(file_id, agent_id)`.

3. Shared knowledge:
- auto-publish summary to board memory/group memory with stable tags.

4. UI visibility:
- attachment chips + status + report drawer tied to backend file/report state.

## Rollout Plan (pragmatic)
1. Phase 1: schema + upload API + extraction + attachment rendering (no report enforcement).
2. Phase 2: mention-delivery file contract + agent report endpoint + status tracking.
3. Phase 3: shared knowledge auto-publish + group propagation + retries/alerts.
4. Phase 4: polish (search/filter file reports, RBAC, retention cleanup).

## Risks
- Token bloat if full extracted text always injected.
  - Mitigation: inject preview + API fetch on demand; cap chars.
- Binary/unsupported files.
  - Mitigation: strict allowlist in v1, explicit unsupported state in UI.
- Agent non-compliance with report contract.
  - Mitigation: timeout + resend + lead notification.
- Storage growth.
  - Mitigation: retention TTL and dedupe by checksum.

## Success Metrics
- >= 99% mentioned file tasks reach `agent_seen=true` within SLA (e.g., 60s).
- >= 95% file tasks end with `summary_reported=true` within SLA (e.g., 5m).
- other agents can retrieve report via tagged memory query in one call.
- UI shows exact upload/extract/report status without manual refresh drift.

## Validation
- E2E: upload pdf + mention 1 agent -> report exists -> shared memory record exists -> second agent answers using shared summary.
- Negative: unsupported mime, oversized file, extract failure, agent timeout.
- Regression: plain chat without files unchanged.

## Unresolved Questions
1. V1 file type scope: docs only (`txt/md/csv/json/pdf`) or include images now?
2. Storage backend now: local disk under backend or object storage from day 1?
3. Shared knowledge default scope: board-only or board-group by default?
4. SLA for “agent processed file” and retry policy thresholds?
