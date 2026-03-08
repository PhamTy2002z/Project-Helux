---
phase: 4
title: "Fetch Optimization"
risk: LOW-MEDIUM
effort: 3h
status: pending
---

# Phase 4: Fetch Optimization

## Context
- [plan.md](./plan.md)
- BoardChatPanel has waterfall: session creation -> activate -> load messages
- Board page `loadBoard` fetches snapshot then group snapshot sequentially

## 4A: Parallel Board Snapshot Loading

Current (sequential):
```
loadBoard → getBoardSnapshot → then → getBoardGroupSnapshot
```

Fix: Use `Promise.all` or `Promise.allSettled` for independent fetches.

### Implementation
In `page.tsx` `loadBoard` callback (~line 1243):
- Fetch board snapshot and group snapshot in parallel
- Group snapshot failure should not block board rendering (already handles error separately)

## 4B: BoardChatPanel Session Waterfall

Current flow in `BoardChatPanel`:
1. Create/get chat session
2. Wait for session ID
3. Activate session
4. Wait for activation
5. Load messages with session ID

Optimization: steps 2+3 can overlap. After getting session ID, fire activate + load messages in parallel.

**Note:** Read `BoardChatPanel.tsx` fully before touching. The waterfall may be intentional if activation must complete before messages are valid.

## 4C: Barrel Export Consideration

`frontend/src/api/generated/model/index.ts` has 257 `export *` lines. Since this is orval-generated, we should NOT modify it. Instead:
- Ensure `tsconfig.json` has `"moduleResolution": "bundler"` (Next.js 16 default)
- Verify tree-shaking works via build output analysis
- If barrel causes bundle bloat, add specific imports in hot paths only

## Todo
- [ ] Parallelize board + group snapshot fetch in loadBoard
- [ ] Analyze BoardChatPanel waterfall; parallelize if safe
- [ ] Verify barrel export tree-shaking with `pnpm build` analysis
- [ ] Build + test

## Risk Assessment
- LOW-MEDIUM: fetch ordering changes could surface race conditions
- Mitigation: use `Promise.allSettled` so one failure doesn't block the other
- BoardChatPanel needs careful analysis before changing activation order
