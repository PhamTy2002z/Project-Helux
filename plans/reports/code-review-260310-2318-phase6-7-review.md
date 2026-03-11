# Code Review: Phase 6 (Query API) + Phase 7 (Frontend Chat File UI)

**Reviewer:** code-reviewer | **Date:** 2026-03-10 | **Branch:** develop

## Scope

- Files: 9 (4 backend, 5 frontend)
- LOC: ~900 new/modified
- Focus: Board chat file upload endpoints, frontend upload hook, composer + thread + panel wiring

## Overall Assessment

Solid implementation with good auth checks, proper error handling, and clean separation of concerns. However, there are **2 critical issues** and several medium-priority items to address before merge.

---

## Critical Issues

### C1. `attachments` field never populated by backend API

**File:** `backend/app/schemas/board_memory.py` (line 41), `backend/app/api/board_memory.py`

The `BoardMemoryRead` schema declares `attachments: list[BoardChatMessageAttachmentRead] | None = None`, but the board_memory API endpoint never hydrates this field. It creates the memory row and links files via `validate_and_link_files`, but when reading memories back (list/stream), it returns raw `BoardMemory` model instances that have no `attachments` relationship populated.

**Impact:** Frontend renders attachment chips per message, but they will always be empty. The entire attachment rendering in `BoardChatThread.tsx` (lines 106-130) is dead code in production.

**Fix:** Add a post-query hydration step in the list/stream endpoints:
```python
# After fetching memories, batch-load linked file assets
memory_ids = [m.id for m in memories]
file_links = await session.exec(
    select(BoardChatMessageFile)
    .where(BoardChatMessageFile.board_memory_id.in_(memory_ids))
    .options(selectinload(BoardChatMessageFile.file_asset))
)
# Map attachments to each memory's response
```

### C2. Generated TypeScript type missing `attachments` field

**File:** `frontend/src/api/generated/model/boardMemoryRead.ts`

The orval-generated `BoardMemoryRead` interface does NOT include `attachments`. The frontend works around this with unsafe type assertions:

```typescript
// BoardChatThread.tsx line 106
(message as BoardMemoryRead & { attachments?: { id: string; file_name: string; status: string }[] })
```

**Impact:** Type safety completely bypassed. If the generated client is regenerated, this cast silently hides the missing data issue instead of surfacing it at compile time.

**Fix:** Regenerate the orval client after ensuring the backend OpenAPI schema includes the `attachments` field. Then remove the manual cast.

---

## High Priority

### H1. `onRemovePendingFile` clears ALL pending files instead of the targeted one

**File:** `frontend/src/components/boards/BoardChatPanel.tsx` (line 259)

```tsx
onRemovePendingFile={() => filesState.clearPendingUploads()}
```

The `BoardChatComposer` calls `onRemovePendingFile(id)` with a specific file ID, but the handler ignores the ID and clears all pending uploads. If a user uploads 3 files and wants to remove 1, all 3 disappear.

**Fix:** Add a `removePendingUpload(id: string)` method to `useBoardChatFiles` hook:
```typescript
const removePendingUpload = useCallback((targetId: string) => {
  setPendingUploads((prev) => {
    const next = prev.filter((u) => u.id !== targetId);
    pendingRef.current = next;
    return next;
  });
}, []);
```

### H2. Read-only endpoints use `get_board_for_actor_write` dependency

**File:** `backend/app/api/board_chat_files.py` (lines 206-216, 225-244, etc.)

All GET endpoints (get file, list files, list reports, list tasks) use `BOARD_WRITE_DEP = Depends(get_board_for_actor_write)`. Users with read-only board access cannot view file statuses or reports.

**Fix:** Use `get_board_for_actor_read` for GET endpoints. Keep `get_board_for_actor_write` only for POST (upload).

### H3. `refreshFiles` response shape mismatch

**File:** `frontend/src/lib/hooks/use-board-chat-files.ts` (line 94)

```typescript
const data = (await response.json()) as { items?: BoardChatFile[] };
setFiles(data.items ?? []);
```

The backend `list_board_chat_files` endpoint returns `list[BoardChatFileRead]` directly (a JSON array), not `{ items: [...] }`. This means `data.items` will always be `undefined` and `setFiles` will always set an empty array.

**Fix:**
```typescript
const data = (await response.json()) as BoardChatFile[];
setFiles(data);
```

### H4. No pagination on `list_board_chat_files` endpoint

**File:** `backend/app/api/board_chat_files.py` (lines 219-244)

The list endpoint returns all files for a board with no `limit`/`offset`. For boards with many uploaded files over time, this could return unbounded result sets.

**Fix:** Add `limit: int = 50` and `offset: int = 0` query params, apply `.offset(offset).limit(limit)` to the statement.

---

## Medium Priority

### M1. Inline file read into memory without streaming

**File:** `backend/app/api/board_chat_files.py` (line 109)

`data = await file.read()` loads the entire file (up to 10MB) into memory before validation. For concurrent uploads this could spike memory.

**Recommendation:** For V1 with 10MB limit this is acceptable. Consider chunked reading for future size limit increases.

### M2. `_extract_json` can produce very large output

**File:** `backend/app/services/board_chat_files/extractor.py` (lines 97-101)

Pretty-printing JSON with `indent=2` can massively expand minified JSON. A 1MB minified file could expand to 5-10MB of text.

**Recommendation:** Add a size guard or truncation after extraction.

### M3. Duplicate `PendingFileChip` type definition

**Files:** `BoardChatComposer.tsx` (lines 19-23), `BoardChatThread.tsx` (lines 12-16)

The `PendingFileChip` type is defined identically in both files.

**Fix:** Extract to a shared types file, e.g. `frontend/src/lib/types/board-chat.ts`.

### M4. `credentials` value can be `undefined` in fetch

**File:** `frontend/src/lib/hooks/use-board-chat-files.ts` (lines 91, 149)

```typescript
credentials: isLocalAuthMode() ? "same-origin" : undefined,
```

Passing `undefined` for `credentials` is fine in practice (browser uses default), but it's inconsistent with other hooks in the codebase that may use `"include"`. Verify this is intentional.

---

## Low Priority

### L1. `storage.ensure_bucket()` called on every upload

**File:** `backend/app/api/board_chat_files.py` (line 138)

Could be called once at app startup or cached. Minor perf overhead.

### L2. File hash (`sha256`) computed but never used for dedup

**File:** `backend/app/api/board_chat_files.py` (line 124)

The SHA256 is stored but no deduplication check uses it. YAGNI -- if not planned, consider removing to simplify.

---

## Positive Observations

1. **Auth on all endpoints** -- every endpoint requires actor context and board ownership validation
2. **No storage key leakage** -- `object_storage_key` is correctly excluded from all read schemas
3. **Good error handling** -- storage failures return 502 with user-friendly message, inline extraction failures are caught and recorded
4. **Clean hook API** -- `useBoardChatFiles` has well-typed return value and clear separation from message hook
5. **Board-scoped file paths** -- `_build_object_key` uses org_id/board_id prefix to prevent cross-tenant access
6. **Proper MIME resolution** with extension fallback

---

## Recommended Actions (Priority Order)

1. **[C1]** Hydrate `attachments` on memory list/stream endpoints, or remove field from schema until implemented
2. **[C2]** Regenerate orval client after fixing C1; remove unsafe casts in `BoardChatThread.tsx`
3. **[H1]** Implement per-file removal instead of clearing all pending uploads
4. **[H2]** Switch GET endpoints to read-only board dependency
5. **[H3]** Fix response shape parsing in `refreshFiles` (array vs `{items}`)
6. **[H4]** Add pagination to list endpoint
7. **[M3]** Extract shared `PendingFileChip` type

---

## Unresolved Questions

1. Is `attachments` hydration planned for a separate phase, or was it missed?
2. Should read-only board members see file statuses at all? (affects H2 decision)
3. The `enqueue_extraction` function for large files -- is the async worker implemented and tested?
