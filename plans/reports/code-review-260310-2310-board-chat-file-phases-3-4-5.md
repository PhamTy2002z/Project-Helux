# Code Review: Board Chat File Upload - Phases 3, 4, 5

## Scope
- **Files (new)**: `delivery.py`, `message_contract.py`, `report_parser.py`, `reporting.py`, `report_deadline_queue.py`, `report_deadline_worker.py`, `shared_knowledge.py`
- **Files (modified)**: `board_memory.py` (schema + API), `config.py`, `queue_worker.py`
- **LOC**: ~450 new, ~60 modified
- **Focus**: Correctness, security, idempotency, backward compatibility

## Overall Assessment

Solid implementation. Clean separation of concerns across delivery, reporting, and shared knowledge modules. The fast-path skip in report parser, idempotent upserts, and deterministic dedupe tags are well-designed. Several issues found, one critical and a few high-priority.

---

## Critical Issues

### 1. Bare `except` swallows all errors silently (board_memory.py:500-502)

```python
except Exception:
    # Never fail the message create on report processing errors
    pass
```

**Problem**: This silently swallows ALL exceptions including `IntegrityError`, connection failures, and programming bugs. No logging means zero observability into report processing failures.

**Fix**:
```python
except Exception:
    logger.exception(
        "file_report.processing_error",
        extra={
            "agent_id": str(actor.agent.id),
            "file_asset_id": str(pr.file_asset_id),
        },
    )
```

**Impact**: Without logging, failed report processing is invisible in production. Debugging SLA timeouts becomes impossible.

---

## High Priority

### 2. Double `session.commit()` in `_notify_chat_targets` creates split transaction risk (board_memory.py:282 + API level)

Inside `_notify_chat_targets` at line 282, there's `await session.commit()` after creating file tasks. Then back in `create_board_memory` at line 504, there's another `await session.commit()` after report processing. The file linking at line 472 also has its own `await session.commit()`.

**Problem**: Three separate commits for what should be one atomic operation. If the gateway dispatch fails between commits, task rows exist but no message was sent. The session state may also be stale after intermediate commits.

**Recommendation**: Use `session.flush()` instead of `session.commit()` inside `_notify_chat_targets` and let the outer `create_board_memory` handle the single commit. The `enqueue_report_deadline` calls should happen AFTER the final commit succeeds (since queue enqueue is not transactional with DB).

### 3. `reporting.py` imports at function body level (line 88-89)

```python
from app.services.board_chat_files.shared_knowledge import publish_board_shared_summary
```

**Problem**: Circular import workaround is fine, but the import happens on every `process_agent_file_report` call. Should be moved to top-level `TYPE_CHECKING` guard or cached.

**Impact**: Minor perf hit per report. Low risk but worth noting.

### 4. `_MAX_SUMMARY_CHARS` evaluated at module load time (reporting.py:20)

```python
_MAX_SUMMARY_CHARS = settings.board_chat_file_preview_max_chars * 4
```

**Problem**: `settings` is accessed at import time. If module is imported before settings are fully initialized (e.g., during testing with patched env), this value is baked in incorrectly.

**Fix**: Compute inside the function or use a property/function.

### 5. Deadline worker commits inside `_send_reminder` scope without error guard (report_deadline_worker.py:62)

```python
await _send_reminder(session, file_task)
file_task.retry_count += 1
...
await session.commit()
```

If `_send_reminder` succeeds but the subsequent commit fails, the reminder was sent but retry_count is not incremented. Next deadline check will re-send the same reminder. Not catastrophic (idempotent), but the retry_count tracking becomes inaccurate.

### 6. `shared_knowledge.py` board_id param logic is confusing (lines 47-50)

```python
else:
    # board_id param might be the file_asset_id by mistake, resolve properly
    asset = await BoardChatFileAsset.objects.by_id(file_asset_id).first(session)
    if asset is not None:
        board_id = asset.board_id
```

**Problem**: When `board_id` IS provided, code still overrides it with asset's `board_id`. The comment says "might be the file_asset_id by mistake" which is a code smell. Either trust the caller or don't accept the param.

**Fix**: Remove the `board_id` parameter entirely. Always resolve from asset. Simpler and more secure (prevents board scope bypass).

---

## Medium Priority

### 7. No board-scope validation in `process_agent_file_report` (reporting.py)

The function validates that a task exists for (file_asset_id, agent_id) but does NOT verify the file belongs to the same board as the agent's current context. An agent with a valid task row for board A could theoretically submit a report while authenticated against board B.

**Recommendation**: Add board_id param and cross-check `asset.board_id == board_id`.

### 8. `validate_and_link_files` uses N+1 query pattern (delivery.py:53-59)

```python
for fid in unique_ids:
    asset = await BoardChatFileAsset.objects.by_id(fid).first(session)
```

With max 3 files this is acceptable. But the pattern should have a comment noting the cap justification.

### 9. Report parser regex allows case-insensitive UUID but UUID() constructor is strict

The regex uses `re.IGNORECASE` which allows `[FILE_REPORT:ABC...]` with uppercase hex. The `UUID()` constructor handles this fine, so no actual bug. But the regex pattern `[0-9a-f]` only matches lowercase -- the `IGNORECASE` flag doesn't affect character classes. This means uppercase UUIDs like `A1B2C3...` would NOT match the regex.

**Impact**: Low. UUIDs are typically lowercase. But if agent generates uppercase UUID, report silently ignored.

**Fix**: Change regex char class to `[0-9a-fA-F]` or use `\w` with validation.

### 10. `enqueue_report_deadline` called after `session.commit()` but outside try/except (board_memory.py:283-284)

If `enqueue_report_deadline` fails (Redis down), task rows exist in DB but no deadline check is scheduled. The file task will be stuck in "pending" forever with no timeout enforcement.

**Recommendation**: Wrap in try/except with warning log, or add a periodic sweep job as safety net.

### 11. `shared_knowledge.py` uses `.contains()` for tag search (line 62)

```python
.filter(col(BoardMemory.tags).contains([dedupe_tag]))
```

This relies on PostgreSQL JSON containment operator `@>`. Works correctly but:
- No index on `tags` JSON column for containment queries
- As board_memory grows, this query gets slow

**Recommendation**: Add GIN index on `tags` column, or document that this is acceptable for v1 scale.

---

## Low Priority

### 12. `_parse_backoff_schedule` called on every deadline task (report_deadline_worker.py:22-24)

Parses comma-separated string from config every invocation. Could cache the result.

### 13. `message_contract.py` does not escape file_name in XML-like blocks (line 47)

```python
f'<file name="{asset.file_name}" id="{asset.id}">{preview}{status_note}</file>'
```

If `file_name` contains `"` or `<`, the payload is malformed. Low risk since file names are validated at upload, but defense-in-depth would escape.

### 14. `BoardChatFileReport` model missing unique constraint on (file_asset_id, agent_id)

The `reporting.py` code does manual upsert check, but the DB has no unique constraint to enforce idempotency at the database level. A race condition between two concurrent report submissions could create duplicate rows.

**Fix**: Add `UniqueConstraint("file_asset_id", "agent_id")` to `BoardChatFileReport` model.

---

## Edge Cases Found

1. **Text-only backward compat**: Confirmed safe. `file_ids=None` skips all file paths. `parse_file_reports` fast-path returns `[]` for normal messages.
2. **Agent mentions self**: `_chat_targets` correctly excludes self-agent from targets.
3. **Empty file_ids list**: `validate_and_link_files` receives `[]`, passes length check, returns empty list. `_notify_chat_targets` gets `file_assets=[]`, which is falsy. Clean.
4. **Multiple reports in one message**: Parser regex with lookahead `(?=\[FILE_REPORT:|$)` correctly splits. Each processed independently.
5. **Report for already-timed-out task**: `process_agent_file_report` finds task, overwrites status from "timeout" to "reported". This may be intentional (accept late reports) but should be documented.
6. **Concurrent deadline worker + report submission**: Race between worker marking timeout and agent submitting report. No DB-level lock. Possible inconsistency where report is accepted but task is then overwritten to timeout by worker.

---

## Positive Observations

- Fast-path skip in report parser (`_TAG_PREFIX not in content`) avoids regex overhead for 99%+ of messages
- Deterministic dedupe tags in shared knowledge prevent duplicate board memory entries
- Clean separation: delivery, message contract, parser, reporting, deadline each in own module
- Idempotent report upsert design
- Configurable SLA/retry policy via settings with sensible defaults
- Structured logging with consistent event naming convention
- Hard caps enforced (3 files/msg, 500 chars preview, summary truncation)

---

## Recommended Actions (Priority Order)

1. **[Critical]** Add `logger.exception()` to the bare `except` in `create_board_memory` report processing
2. **[High]** Consolidate commits -- use `flush()` internally, single `commit()` at API boundary
3. **[High]** Add `UniqueConstraint("file_asset_id", "agent_id")` to `BoardChatFileReport` model
4. **[High]** Simplify `shared_knowledge.py` -- remove `board_id` param, always resolve from asset
5. **[Medium]** Add board_id cross-validation in `process_agent_file_report`
6. **[Medium]** Wrap `enqueue_report_deadline` in try/except with fallback logging
7. **[Medium]** Plan GIN index on `board_memory.tags` for production scale
8. **[Low]** Escape file_name in XML-like payload blocks
9. **[Low]** Cache backoff schedule parse result

## Metrics
- Type Coverage: Good (TYPE_CHECKING guards, typed params throughout)
- Test Coverage: Not yet (Phase 8 planned)
- Linting Issues: 0 syntax issues found

## Unresolved Questions

1. Should late reports (task already timed out) be accepted? Current code allows it -- is this intentional?
2. Is there a periodic sweep job planned for orphaned "pending" tasks where deadline enqueue failed?
3. The `board_chat_file_publish_group_memory` config flag exists but is never checked in code. Is group memory fanout deferred to a future phase?
