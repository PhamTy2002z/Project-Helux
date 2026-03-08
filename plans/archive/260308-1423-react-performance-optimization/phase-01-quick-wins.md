---
phase: 1
title: "Quick Wins: Dynamic Imports + memo()"
risk: LOW
effort: 3h
status: pending
---

# Phase 1: Quick Wins

## Context
- [plan.md](./plan.md)
- Zero `dynamic()` or `lazy()` calls in entire frontend
- Only 5/442 components use `memo()` (TaskBoard, TaskCommentCard, LiveFeedCard, Markdown, activity page)

## Overview
Add `next/dynamic` for heavy components and `memo()` for frequently-re-rendered leaf components. These are safe, isolated changes.

## 1A: Dynamic Imports (Code Splitting)

### Target Components
Heavy deps that shouldn't be in initial bundle:

| Component | Import Location | Heavy Dep |
|-----------|----------------|-----------|
| `BoardOnboardingChat` | `boards/[boardId]/page.tsx` (dialog) | Self-contained 650 LOC |
| `BoardApprovalsPanel` | `boards/[boardId]/page.tsx` (tab) | recharts (PieChart) |
| `BoardChatPanel` | `boards/[boardId]/page.tsx` (side panel) | chat + SSE |
| `BoardChatComposer` | `boards/[boardId]/page.tsx` (side panel) | textarea logic |

### Implementation Pattern
```tsx
// In boards/[boardId]/page.tsx, replace:
import { BoardOnboardingChat } from "@/components/BoardOnboardingChat";
// With:
import dynamic from "next/dynamic";
const BoardOnboardingChat = dynamic(
  () => import("@/components/BoardOnboardingChat").then(m => m.BoardOnboardingChat),
  { ssr: false }
);
```

Apply same pattern for `BoardApprovalsPanel`, `BoardChatPanel`, `BoardChatComposer`.

### Validation
- `pnpm build` -- check for new chunks in `.next/static/chunks`
- Manual: open board page, verify dialog/panel loads correctly

## 1B: memo() Additions

### Candidates (re-render on parent state changes in board page)

| Component | File | Reason |
|-----------|------|--------|
| `TaskCard` | `components/molecules/TaskCard.tsx` | Rendered per-task in kanban; parent has 50+ useState |
| `BoardChatComposer` | `components/BoardChatComposer.tsx` | Re-renders on every board page state change |
| `DependencyBanner` | `components/molecules/DependencyBanner.tsx` | Rendered per-task detail |
| `StatusDot` | `components/atoms/StatusDot.tsx` | Tiny leaf, many instances |

### Implementation
Wrap default export with `memo()`. Example:
```tsx
// Before:
export function TaskCard({ ... }: TaskCardProps) { ... }
// After:
export const TaskCard = memo(function TaskCard({ ... }: TaskCardProps) { ... });
```

Ensure no inline object/function props at call sites that would defeat memo.

## Todo
- [ ] Add `next/dynamic` for BoardOnboardingChat
- [ ] Add `next/dynamic` for BoardApprovalsPanel
- [ ] Add `next/dynamic` for BoardChatPanel + BoardChatComposer
- [ ] Wrap TaskCard with memo()
- [ ] Wrap BoardChatComposer with memo()
- [ ] Wrap DependencyBanner with memo()
- [ ] Wrap StatusDot with memo()
- [ ] Run `pnpm build` and verify
- [ ] Run `pnpm test` and verify

## Risk Assessment
- LOW: `dynamic()` and `memo()` are additive, no behavior change
- Fallback: remove any individual change that causes issues
