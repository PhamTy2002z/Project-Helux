# Phase 1: Schema and Storage Foundation

## Context Links
- [Brainstorm report](../reports/brainstorm-260310-2107-board-chat-file-upload-openclaw-aligned.md)
- [Board memory model](../../backend/app/models/board_memory.py)
- [Board memory API](../../backend/app/api/board_memory.py)
- [Settings](../../backend/app/core/config.py)
- [Compose stack](../../compose.yml)

## Overview
- **Priority**: P1 (hard blocker)
- **Status**: done
- **Effort**: 3h

Create foundational tables and runtime config for file ingestion + MinIO integration.

## Key Insights
- Existing `board_memory` has no attachment relationship.
- Existing queue/worker infrastructure already supports custom task types.
- No object-storage config currently exists in backend settings.

## Requirements
- Functional:
  - Persist uploaded file metadata per board/chat-session.
  - Persist mapping between chat message (`board_memory`) and file assets.
  - Persist per-agent per-file processing state and reports.
  - Support MinIO connection config via env.
- Non-functional:
  - Additive schema only (no breaking migration).
  - Clear indexes for board/session/message/file/task queries.

## Architecture
- New tables:
  - `board_chat_file_assets`
  - `board_chat_message_files`
  - `board_chat_file_tasks`
  - `board_chat_file_reports`
- Add unique constraints:
  - `board_chat_message_files(board_memory_id, file_asset_id)`
  - `board_chat_file_tasks(file_asset_id, agent_id)`
- Add status enums as constrained text (`uploaded|extracting|ready|failed`, `pending|reported|failed|timeout`).

## Related Code Files
### Files to modify:
- `backend/app/core/config.py` - add MinIO/file-ingest settings.
- `backend/app/models/__init__.py` - register new models for metadata discovery.
- `backend/.env.example` - add env template for MinIO and file limits.
- `compose.yml` - add MinIO service and persistent volume.

### Files to create:
- `backend/app/models/board_chat_file_assets.py`
- `backend/app/models/board_chat_message_files.py`
- `backend/app/models/board_chat_file_tasks.py`
- `backend/app/models/board_chat_file_reports.py`
- `backend/migrations/versions/{next}_add_board_chat_file_tables.py`

### Files to delete:
- None.

## Implementation Steps
1. Add 4 SQLModel entities with UUID PKs, FK integrity, and created/updated timestamps.
2. Add indexes for:
   - `board_id + chat_session_id + created_at`
   - `board_memory_id`
   - `file_asset_id + agent_id`
3. Add config fields in `Settings`:
   - `object_storage_provider`, `object_storage_endpoint`, `object_storage_bucket`,
   - `object_storage_access_key`, `object_storage_secret_key`, `object_storage_use_ssl`,
   - `board_chat_file_max_bytes`, `board_chat_file_preview_max_chars=500`,
   - `board_chat_file_max_per_message=3`.
4. Add compose MinIO service with local admin creds for dev and named volume.
5. Generate Alembic migration and verify upgrade/downgrade.

## Todo List
- [x] Model files created with <200 lines/file.
- [x] Config fields added and validated.
- [x] Compose MinIO service added.
- [x] Migration generated and reviewed.
- [ ] DB upgrade/downgrade tested locally.

## Success Criteria
- App boots with MinIO env vars configured.
- New tables exist with expected constraints/indexes.
- Existing board chat flows unchanged when no files involved.

## Risk Assessment
- Risk: over-indexing may slow writes.
  - Mitigation: add only query-critical indexes in v1.
- Risk: schema drift from manual migration edits.
  - Mitigation: run autogenerate then manual review.

## Security Considerations
- Store secrets only via env, never log them.
- Persist hash (`sha256`) to support dedupe and integrity checks.
- Keep tenant scoping (`organization_id` or `board_id`) in all file tables.

## Next Steps
- Phase 2 implements upload+storage+extraction using this schema.
