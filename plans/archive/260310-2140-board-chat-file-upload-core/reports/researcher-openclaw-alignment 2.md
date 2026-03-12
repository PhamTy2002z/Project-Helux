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

## Unresolved Questions
- None.
