---
phase: 2
title: "Split boards/[boardId]/page.tsx (4615 LOC)"
risk: MEDIUM
effort: 6h
status: in-progress
---

# Phase 2: Board Page Component Extraction

## Context
- [plan.md](./plan.md)
- Source: `frontend/src/app/boards/[boardId]/page.tsx` -- 4615 lines
- 138 hook calls (useState, useCallback, useEffect, useMemo, useRef)
- ~50 useState, 16 useCallback, many useEffect for SSE streams
- Target: main page file < 500 LOC, each extracted module < 200 LOC

## CRITICAL: Safety Protocol
1. Read EVERY line of the file before making any change
2. Extract one module at a time
3. Run `pnpm build` after each extraction
4. Run `pnpm test` after each extraction
5. Do NOT rename any exported symbol or change any prop interface
6. Preserve all `useCallback` dependency arrays exactly

## Architecture: Proposed File Structure

```
frontend/src/app/boards/[boardId]/
  page.tsx                    # ~400 LOC - orchestrator, state, layout
  board-types.ts              # ~60 LOC - shared types
  board-constants.ts          # ~60 LOC - constants, config
  board-utils.ts              # ~120 LOC - pure helper functions
  board-normalizers.ts        # ~30 LOC - normalizeTask, normalizeAgent, normalizeApproval
  live-feed-utils.ts          # ~180 LOC - LiveFeed event converters
  LiveFeedCard.tsx            # ~90 LOC - already memo'd component
  TaskCommentCard.tsx          # ~40 LOC - already memo'd component
  TaskDetailPanel.tsx          # ~400 LOC - task detail side panel
  TaskCreateDialog.tsx         # ~200 LOC - create task dialog
  TaskEditDialog.tsx           # ~200 LOC - edit task dialog
  TaskDeleteDialog.tsx         # ~60 LOC - delete confirmation
  LiveFeedPanel.tsx            # ~200 LOC - live feed side panel
  AgentsControlDialog.tsx      # ~100 LOC - pause/resume agents
  BoardToasts.tsx              # ~50 LOC - toast notifications
  use-board-sse.ts             # ~200 LOC - all SSE connections (tasks, approvals, chat, agents)
  use-board-live-feed.ts       # ~100 LOC - live feed state + history loading
  custom-field-utils.ts        # (already extracted)
  TaskCustomFieldsEditor.tsx   # (already extracted)
```

## Extraction Order (safest first)

### Step 1: Extract types → `board-types.ts`
Move from page.tsx (lines 136-188):
```
Board, TaskStatus, TaskCustomFieldPayload, Task, Agent, TaskComment,
Approval, BoardChatMessage, LiveFeedEventType, LiveFeedItem
```
No behavior change. page.tsx imports from `./board-types`.

### Step 2: Extract constants → `board-constants.ts`
Move from page.tsx:
- `LIVE_FEED_EVENT_TYPES` (line 190)
- `isLiveFeedEventType` (line 207)
- `priorities` (line 511)
- `statusOptions` (line 516)
- `SSE_RECONNECT_BACKOFF` (line 523)

### Step 3: Extract pure utils → `board-utils.ts`
Move from page.tsx:
- `formatShortTimestamp` (line 530)
- `commentElementId` (line 541)
- `formatActionError` (line 550)
- `resolveBoardAccess` (line 563)
- `latestTaskTimestamp` (line 1204) -- currently inside component, move out
- `latestApprovalTimestamp` (line 1217)
- `latestAgentTimestamp` (line 1230)
- `latestChatTimestamp` (line 1339)

### Step 4: Extract normalizers → `board-normalizers.ts`
- `normalizeTask` (line 487)
- `normalizeAgent` (line 495)
- `normalizeApproval` (line 500)
- `normalizeTagColor` (line 505)

### Step 5: Extract live feed utils → `live-feed-utils.ts`
- `toLiveFeedFromActivity` (line 219)
- `toLiveFeedFromComment` (line 236)
- `mergeCommentsById` (line 247)
- `toLiveFeedFromBoardChat` (line 273)
- `normalizeAgentStatus` (line 289)
- `humanizeAgentStatus` (line 294)
- `toLiveFeedFromAgentSnapshot` (line 297)
- `toLiveFeedFromAgentUpdate` (line 318)
- `humanizeLiveFeedApprovalAction` (line 370)
- `toLiveFeedFromApproval` (line 376)
- `liveFeedEventLabel` (line 427)
- `liveFeedEventPillClass` (line 444)

### Step 6: Extract `TaskCommentCard` → `TaskCommentCard.tsx`
Already a `memo()` component at line 587. Move as-is.

### Step 7: Extract `LiveFeedCard` → `LiveFeedCard.tsx`
Already a `memo()` component at line 624. Move as-is. Imports `liveFeedEventLabel`, `liveFeedEventPillClass` from `./live-feed-utils`.

### Step 8: Extract `TaskDetailPanel.tsx`
This is the largest extraction. Contains:
- Task detail side panel rendering (comment list, edit form fields, dependencies)
- State: `selectedTask`, `comments`, `highlightedCommentId`, `isCommentsLoading`, `commentsError`, `isPostingComment`, `postCommentError`
- Callbacks: `loadComments`, `openComments`, `addTaskDependency`, `removeTaskDependency`

**Props contract:**
```tsx
type TaskDetailPanelProps = {
  board: Board | null;
  selectedTask: Task | null;
  tasks: Task[];
  agents: Agent[];
  tags: TagRead[];
  boardCustomFieldDefinitions: TaskCustomFieldDefinitionRead[];
  selectedTaskCustomFieldValues: TaskCustomFieldValues;
  isDetailOpen: boolean;
  onClose: () => void;
  onEditOpen: () => void;
  onDeleteOpen: () => void;
  onTaskSelect: (task: Task) => void;
  boardId: string;
  currentUserDisplayName: string;
};
```
Internal state (comments, loading) stays inside this component.

### Step 9: Extract `TaskCreateDialog.tsx`
State: `isDialogOpen`, `title`, `description`, `priority`, `createDueDate`, `createTagIds`, `createCustomFieldValues`, `createError`, `isCreating`
Props: `boardId`, `tags`, `boardCustomFieldDefinitions`, `defaultCreateCustomFieldValues`, `agents`, `onTaskCreated`

### Step 10: Extract `TaskEditDialog.tsx`
State: `editTitle`, `editDescription`, `editStatus`, `editPriority`, `editDueDate`, `editAssigneeId`, `editTagIds`, `editDependsOnTaskIds`, `editCustomFieldValues`, `isSavingTask`, `saveTaskError`
Props: `boardId`, `selectedTask`, `tasks`, `agents`, `tags`, `boardCustomFieldDefinitions`, `isOpen`, `onClose`, `onSaved`

### Step 11: Extract `TaskDeleteDialog.tsx`
State: `isDeletingTask`, `deleteTaskError`
Props: `boardId`, `selectedTask`, `isOpen`, `onClose`, `onDeleted`

### Step 12: Extract `AgentsControlDialog.tsx`
State: `agentsControlAction`, `isAgentsControlSending`, `agentsControlError`
Props: `boardId`, `isOpen`, `action`, `onClose`, `onConfirmed`

### Step 13: Extract `LiveFeedPanel.tsx`
Contains: live feed list rendering, history loading button
Props: `liveFeed`, `liveFeedFlashIds`, `isLiveFeedHistoryLoading`, `liveFeedHistoryError`, `hasLoadedHistory`, `onLoadHistory`, `onClose`

### Step 14: Extract `BoardToasts.tsx`
Props: `toasts`, `onDismiss`

## Dependency Graph

```
page.tsx (orchestrator)
  imports: board-types, board-constants, board-utils, board-normalizers
  imports: use-board-sse (Phase 3)
  renders: TaskDetailPanel, TaskCreateDialog, TaskEditDialog,
           TaskDeleteDialog, AgentsControlDialog, LiveFeedPanel,
           BoardToasts, LiveFeedCard, TaskCommentCard
           + TaskBoard (existing), BoardChatPanel (existing),
           DashboardShell (existing)

board-types.ts ← used by ALL extracted files
board-constants.ts ← used by page.tsx, live-feed-utils, use-board-sse
board-utils.ts ← used by page.tsx, TaskDetailPanel
board-normalizers.ts ← used by page.tsx, use-board-sse
live-feed-utils.ts ← used by page.tsx, LiveFeedCard, LiveFeedPanel
```

## Todo
- [x] Step 1: Extract board-types.ts, build check
- [x] Step 2: Extract board-constants.ts, build check
- [x] Step 3: Extract board-utils.ts, build check
- [x] Step 4: Extract board-normalizers.ts, build check
- [x] Step 5: Extract live-feed-utils.ts, build check
- [x] Step 6: Extract TaskCommentCard.tsx, build check
- [x] Step 7: Extract LiveFeedCard.tsx, build check
- [x] Step 8: Extract TaskDetailPanel.tsx, build check
- [x] Step 9: Extract TaskCreateDialog.tsx, build check
- [x] Step 10: Extract TaskEditDialog.tsx, build check
- [x] Step 11: Extract TaskDeleteDialog.tsx, build check
- [x] Step 12: Extract AgentsControlDialog.tsx, build check
- [x] Step 13: Extract LiveFeedPanel.tsx, build check
- [x] Step 14: Extract BoardToasts.tsx, build check
- [ ] Final: verify page.tsx < 500 LOC (currently 2603 — SSE hooks extraction pending)
- [ ] Run full test suite

## Risk Assessment
- MEDIUM: large file, many interdependencies
- Mitigation: extract pure functions first (Steps 1-5), then components
- Each step is independently revertible via git
- No prop interface changes to external components

## Security Considerations
- No auth changes. Board access check (`resolveBoardAccess`) stays in page.tsx.
- No API endpoint changes.
