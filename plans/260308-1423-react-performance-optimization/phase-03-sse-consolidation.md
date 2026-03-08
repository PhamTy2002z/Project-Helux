---
phase: 3
title: "SSE Logic Consolidation"
risk: MEDIUM
effort: 4h
status: pending
---

# Phase 3: SSE Logic Consolidation

## Context
- [plan.md](./plan.md)
- Board page has 4 separate SSE connections inline (tasks, approvals, chat, agents) -- each ~80 LOC with identical reconnect/parse pattern
- `use-board-chat-messages.ts` hook has another SSE connection with same pattern
- Total: ~400 LOC of duplicated SSE boilerplate

## Problem
Each SSE block duplicates:
1. AbortController setup
2. Exponential backoff reconnect
3. SSE text parsing (event type + data extraction)
4. `\r\n` normalization, double-newline boundary detection
5. Cleanup on unmount

## Solution: Shared SSE Hook

### New File: `frontend/src/lib/hooks/use-sse-stream.ts` (~100 LOC)

```tsx
type UseSSEStreamOptions<T> = {
  enabled: boolean;
  connect: (signal: AbortSignal) => Promise<Response>;
  onEvent: (eventType: string, data: string) => void;
  backoffConfig?: { initialMs?: number; maxMs?: number; factor?: number };
};

export function useSSEStream<T>({
  enabled,
  connect,
  onEvent,
  backoffConfig,
}: UseSSEStreamOptions<T>): void {
  // Single useEffect that handles:
  // 1. connect() call
  // 2. ReadableStream parsing (shared parseSSEBuffer)
  // 3. Exponential backoff reconnect
  // 4. AbortController cleanup
}
```

### Shared Parser: `frontend/src/lib/sse-parser.ts` (~30 LOC)

```tsx
export type SSEEvent = { eventType: string; data: string };

export function* parseSSEBuffer(buffer: string): Generator<{ event: SSEEvent; remaining: string }> {
  // Extract event type + data from SSE text
}
```

### Migration Path

1. Create `use-sse-stream.ts` and `sse-parser.ts`
2. Refactor `use-board-chat-messages.ts` to use `useSSEStream` (safest -- isolated hook)
3. Test board chat still works
4. Extract board page SSE effects into `use-board-sse.ts` using `useSSEStream`
5. Board page SSE effects replaced with single hook call

### Board Page SSE Hook: `use-board-sse.ts`

```tsx
type UseBoardSSEOptions = {
  boardId: string;
  isSignedIn: boolean;
  isPageActive: boolean;
  board: Board | null;
  // Callbacks for each stream type
  onTaskEvent: (tasks: Task[], board: Board) => void;
  onApprovalEvent: (approval: Approval, taskCounts?: ...) => void;
  onChatEvent: (message: BoardChatMessage) => void;
  onAgentEvent: (agents: Agent[]) => void;
  // Refs for "since" cursors
  tasksRef: RefObject<Task[]>;
  approvalsRef: RefObject<Approval[]>;
  chatMessagesRef: RefObject<BoardChatMessage[]>;
  agentsRef: RefObject<Agent[]>;
};
```

This consolidates 4 useEffect blocks (~320 LOC) into one hook.

## Todo
- [ ] Create `sse-parser.ts` with shared SSE text parser
- [ ] Create `use-sse-stream.ts` hook
- [ ] Refactor `use-board-chat-messages.ts` to use shared hook, test
- [ ] Create `use-board-sse.ts` for board page streams
- [ ] Replace inline SSE effects in page.tsx
- [ ] Build + test

## Risk Assessment
- MEDIUM: SSE streams are real-time; subtle bugs = silent data loss
- Mitigation: refactor `use-board-chat-messages.ts` first (isolated, existing tests possible)
- Keep old code commented until new version verified
- Test each stream type individually (chat, approvals, tasks, agents)
