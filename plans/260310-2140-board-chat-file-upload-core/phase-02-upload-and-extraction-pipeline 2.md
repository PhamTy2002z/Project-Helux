# Phase 2: Upload and Extraction Pipeline

## Context Links
- [Queue worker](../../backend/app/services/queue_worker.py)
- [Generic queue](../../backend/app/services/queue.py)
- [Board memory API](../../backend/app/api/board_memory.py)
- [Backend dependencies](../../backend/pyproject.toml)

## Overview
- **Priority**: P1
- **Status**: pending
- **Effort**: 4h

Implement upload endpoint, MinIO storage adapter, extraction pipeline, and asset status lifecycle.

## Key Insights
- Current backend has no multipart upload endpoint.
- Existing worker loop already dispatches typed tasks with retry/backoff.
- V1 scope only needs text extraction for `txt/md/csv/json/pdf`.

## Requirements
- Functional:
  - `POST /api/v1/boards/{board_id}/chat-files` accepts multipart upload.
  - Validate type/size and store object in MinIO bucket.
  - Extract preview text and persist extraction status.
  - Return file asset payload consumable by composer.
- Non-functional:
  - Fast response for small files, async fallback for large files.
  - Deterministic status transitions (`uploaded -> extracting -> ready|failed`).

## Architecture
- New API module `board_chat_files.py` for file-only operations.
- Storage abstraction:
  - `ObjectStorageService` interface
  - `MinioObjectStorageService` implementation
- Extraction abstraction:
  - `FileTextExtractor` with per-mime handlers.
- Queue task type for async extraction: `board_chat_file_extract`.

## Related Code Files
### Files to modify:
- `backend/app/main.py` - register new router.
- `backend/app/services/queue_worker.py` - register extraction task handler.
- `backend/pyproject.toml` - add `minio` and `pypdf` deps.

### Files to create:
- `backend/app/api/board_chat_files.py`
- `backend/app/schemas/board_chat_files.py`
- `backend/app/services/storage/object_storage.py`
- `backend/app/services/storage/minio_storage.py`
- `backend/app/services/board_chat_files/extractor.py`
- `backend/app/services/board_chat_files/queue.py`
- `backend/app/services/board_chat_files/worker.py`

### Files to delete:
- None.

## Implementation Steps
1. Add request/response schemas for upload and file status.
2. Implement MIME allowlist and max-size guardrails.
3. Implement MinIO client wrapper (`put_object`, `get_object`, `presign_get_url` optional).
4. Save asset row before upload; update row after upload success/failure.
5. For files under threshold (ex: 1MB), do inline extraction; otherwise enqueue async extraction.
6. Persist:
   - `extract_preview` (truncated)
   - `extract_text_ref` (object key for full extracted text if needed)
   - `extract_status`, `extract_error`
7. Return normalized API payload to frontend.

## Todo List
- [ ] Upload route implemented with auth and board access checks.
- [ ] MinIO service adapter implemented.
- [ ] Extraction handlers for `txt/md/csv/json/pdf` implemented.
- [ ] Async extraction queue path wired to worker.
- [ ] Error paths update status to failed with safe error details.

## Success Criteria
- User can upload each allowed file type successfully.
- Unsupported type and oversize file return clear `422` errors.
- `extract_preview` available for successful extracts.
- Async extraction reaches terminal state with retries on transient errors.

## Risk Assessment
- Risk: PDF extraction quality varies by scanned docs.
  - Mitigation: return fallback note when no text extracted.
- Risk: MinIO connectivity issues block upload.
  - Mitigation: fail fast, do not create dangling "ready" records.

## Security Considerations
- Enforce content-type + extension + magic-byte validation for file trust hardening.
- Use object keys scoped by org/board/date to avoid collisions.
- Do not expose raw internal object keys to untrusted callers if not required.

## Next Steps
- Phase 3 binds uploaded file ids into board chat messages and mention delivery.
