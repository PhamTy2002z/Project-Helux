# Tester Agent Memory

## Project Context
- **Project:** VisgniteAI (full-stack agent coordination platform)
- **Repo Root:** /Users/typham/Dev/VisgniteAI
- **Backend:** FastAPI + SQLAlchemy (Python)
- **Focus Areas:** Phase 6 (board-chat-file-upload), quota enforcement, webhook dispatch

## Backend Tech Stack
- Framework: FastAPI
- Testing: pytest with async support
- Database: SQLAlchemy + SQLModel with async sessions
- Object Storage: MinIO (S3-compatible)
- Config: pydantic_settings with validation

## Testing Conventions
- **Test Runner:** pytest
- **Base Command:** `python -m pytest tests/ -v --tb=line`
- **Config File:** `pyproject.toml` with pytest section
- **Conftest Location:** `tests/conftest.py`
- **Reports Location:** `/Users/typham/Dev/VisgniteAI/plans/reports/`

## Critical Configuration Issue (FIXED)
**Problem:** `tests/conftest.py` was setting only `AUTH_MODE=local` but not `AUTH_PROFILE`, causing validation errors when `.env` had `AUTH_PROFILE=saas` and `AUTH_MODE=clerk`.

**Fix:** Add `os.environ["AUTH_PROFILE"] = "self_hosted"` to conftest.py at import time, before Settings() instantiation.

**Root Cause:** Pydantic model validator enforces `AUTH_PROFILE=saas` requires `AUTH_MODE=clerk` (in app/core/config.py line 140).

## Test Suite Status
- **Total Tests:** 522
- **Pass Rate:** 97.3% (508 passed)
- **Known Failures:** 14 (pre-existing, not Phase 6 related)
- **Execution Time:** ~9.4 seconds

## Phase 6 Implementation Status
✓ All chat-file endpoints properly registered (6 routes + 1 agent endpoint)
✓ No import errors or missing dependencies
✓ Configuration variables complete
⚠ No dedicated test coverage yet — needs new test files

## Failing Tests Breakdown (Pre-existing Issues)
1. **Quota Enforcement (5 tests):** Token limit expectations changed (15K → 5M). Tests need update.
2. **Session Usage Sync (2 tests):** Usage tracking logic changed. Tests expect zero delta but get non-zero.
3. **Task Permissions (2 tests):** Mocks missing `organization_id` parameter added in recent changes.
4. **Webhook Dispatch (2 tests):** Payload object missing `organization_id` field expected by service.
5. **Org Deletion (1 test):** Table cleanup order assertion mismatch.

## Environment Variables (Phase 6)
```
OBJECT_STORAGE_ENDPOINT=http://localhost:9000
OBJECT_STORAGE_ACCESS_KEY=minioadmin
OBJECT_STORAGE_SECRET_KEY=minioadmin
OBJECT_STORAGE_BUCKET=board-chat-files
OBJECT_STORAGE_USE_SSL=false
BOARD_CHAT_FILE_MAX_BYTES=10485760
BOARD_CHAT_FILE_MAX_PER_MESSAGE=3
BOARD_CHAT_FILE_PREVIEW_MAX_CHARS=500
BOARD_CHAT_FILE_ALLOWED_TYPES=txt,md,csv,json,pdf
```

## Key Locations
- Backend: `/Users/typham/Dev/VisgniteAI/backend/`
- Tests: `backend/tests/`
- Config: `backend/app/core/config.py`
- Conftest: `backend/tests/conftest.py`
- Chat Files Module: `backend/app/api/board_chat_files.py`
- Chat Files Service: `backend/app/services/board_chat_files/`
