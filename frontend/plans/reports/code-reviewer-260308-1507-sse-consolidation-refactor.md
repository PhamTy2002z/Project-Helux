# Code Review: SSE Consolidation Refactor

## Scope
- Files: `sse-parser.ts`, `use-sse-stream.ts`, `use-board-chat-messages.ts`, `page.tsx` (board detail)
- Focus: Structural refactor — extract duplicated SSE logic into shared hook
- LOC added: ~140 (new files), ~net reduction in consumers

## Overall Assessment

Clean, well-executed extraction. The hook API is intuitive, the ref pattern is correct, and behavioral equivalence is preserved. A few issues found, mostly medium priority.

## Critical Issues

None.

## High Priority

### 1. SSE parser drops multi-line `data:` fields
`sse-parser.ts` line 27: `data += line.slice(5).trim()` concatenates multiple `data:` lines without a newline separator. Per SSE spec, multiple `data:` lines should be joined with `\n`. If the server ever sends multi-line data payloads, the JSON will be corrupted.

**Fix:**
```ts
// line 20
let dataLines: string[] = [];
// line 27
} else if (line.startsWith("data:")) {
  dataLines.push(line.slice(5).trim());
}
// after loop
data = dataLines.join("\n");
```

**Impact:** Low risk today if server sends single-line JSON, but violates SSE spec and will break silently if server behavior changes.

### 2. AbortController reused across reconnections
`use-sse-stream.ts`: A single `AbortController` is created at line 50 and reused for every `run()` call (reconnections). Once `abort()` is called during cleanup, this is fine. But if the first `connect()` fails and the stream reconnects, the same signal is passed — which is correct. However, if a previous `reader.read()` rejects due to abort mid-reconnect-timeout, the abort controller is already spent for subsequent retries.

Actually on closer inspection: abort only happens in cleanup, so this is safe. The single controller correctly scopes to the effect lifecycle. **No action needed** — false alarm.

## Medium Priority

### 3. `backoffConfig` changes ignored after mount
`use-sse-stream.ts` line 51: `createExponentialBackoff(backoffConfigRef.current)` is called once when the effect runs. If `backoffConfig` changes, the backoff instance won't update until `enabled` or `key` changes trigger effect re-run. This is acceptable for current usage (static config) but worth documenting.

### 4. `onMessageCreated` in `use-board-chat-messages.ts` not wrapped in ref
Line 233: `onMessageCreated?.(payload.memory)` is called inside `onEvent` which uses `onEventRef`. However, `onMessageCreated` is captured in the closure of `onEvent` passed to `useSSEStream`. Since `useSSEStream` uses `onEventRef.current`, this closure is re-created each render and the ref always points to the latest — so `onMessageCreated` will always be current. **Correct behavior.**

### 5. SSE parser `trim()` strips meaningful whitespace
Line 27: `line.slice(5).trim()` trims both leading and trailing whitespace from data values. The SSE spec says only a single leading space after `data:` should be stripped. Using `.trim()` could strip significant trailing whitespace in data payloads.

**Fix:** `line.slice(5).replace(/^ /, "")` — strip only the optional leading space per spec.

Same issue on line 24 for `event:` — less impactful but still technically incorrect.

## Low Priority

### 6. `key` parameter convention
Good pattern for triggering reconnection. The eslint-disable comment on line 103 is correctly placed and necessary.

### 7. Type assertion `as Response`
Lines like `return streamResult.data as Response` in consumers — unavoidable given the generated API types. Acceptable.

## Positive Observations

- **Ref pattern for callbacks**: Correctly prevents stale closures without adding callbacks to deps array. Textbook implementation.
- **Separation of concerns**: Parser is pure, testable. Hook handles lifecycle. Consumers stay focused on domain logic.
- **Cleanup correctness**: `isCancelled` flag + `AbortController` + timeout cleanup covers all edge cases.
- **Backoff reset on data received**: Smart — resets backoff counter when actual data arrives (line 69), so healthy connections don't accumulate backoff state.
- **`key` parameter**: Elegant solution for re-triggering the effect when external deps change without listing them all.

## Edge Cases Verified

- Stream ends normally (server closes) -> reconnects with backoff. Correct.
- `enabled` flips false -> cleanup runs, stream stops. Correct.
- `key` changes -> effect re-runs, old stream aborted, new one starts. Correct.
- Component unmounts mid-reconnect-timeout -> timeout cleared. Correct.
- `connect` throws -> caught, triggers reconnect. Correct.

## Recommended Actions

1. **Fix multi-line data concatenation** in `sse-parser.ts` (spec compliance)
2. **Fix `trim()` -> single leading space strip** in `sse-parser.ts` (spec compliance)
3. Both are low-risk today but prevent future bugs when server behavior evolves

## Metrics
- Type Coverage: Good — proper typing throughout
- Test Coverage: No tests for `sse-parser.ts` or `use-sse-stream.ts` — recommend adding unit tests for the parser at minimum
- Linting Issues: 1 eslint-disable (justified)

## Unresolved Questions
- Are there unit tests planned for `sse-parser.ts`? Pure function, very easy to test.
- Does the server ever send multi-line `data:` fields currently?
