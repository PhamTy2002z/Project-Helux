# Phase 3: Frontend Status Indicator + Chat Blocking

## Context

- [plan.md](./plan.md)
- [Phase 1](./phase-01-backend-readiness-endpoint.md)
- [Phase 2](./phase-02-lifecycle-orchestrator-fix.md)

## Overview

- **Priority:** P1
- **Status:** Complete
- **Effort:** 2h

Add visual indicator when agent bootstrapping, block chat input until ready. Enterprise UX pattern: contextual setup state with smooth transition.

## Key Insights

- Agent status streams via SSE (`streamAgentsApiV1AgentsStreamGet`) — frontend already receives status changes in real-time
- `StatusDot` already shows amber dot for `provisioning` status (`StatusDot.tsx:8`)
- `BoardChatComposer` has `disabled` prop + `placeholder` prop for custom messages
- Two `BoardChatComposer` instances on board page: task comments (line ~3945) and board chat (line ~4041)
- Board page tracks agents in state via SSE stream (`page.tsx:1858-1882`)

## Requirements

### Functional
- When **any** agent on the board has status == "provisioning": show "Setting up..." banner in chat area
- Block chat input (disabled) with descriptive placeholder
- Show pulsing animation on agent status badge
- When agent transitions to "online": smooth enable of chat, optional success flash
- Poll readiness endpoint (Phase 1) every 3s when agent is provisioning

### Non-functional
- No polling when agent is already online
- Polling stops immediately when status changes
- Minimal re-renders during polling

## Architecture

```
Board Page
├─ Agent sidebar: StatusDot already handles provisioning (amber)
│   └─ Add: "Setting up..." label next to name when provisioning
├─ Chat area (BoardChatComposer)
│   ├─ disabled={!canWrite || isLeadBootstrapping}
│   └─ placeholder="Agent is being set up..."
└─ New: BootstrapBanner component (optional, inline in chat area)
    └─ Shows when lead agent status == "provisioning"
```

## Related Code Files

### Modify
- `frontend/src/app/boards/[boardId]/page.tsx` — add bootstrapping detection, pass disabled to chat
- `frontend/src/components/BoardChatComposer.tsx` — no changes needed (already has disabled/placeholder)

### Possibly Create
- `frontend/src/components/molecules/AgentBootstrapBanner.tsx` — inline banner component (if complex enough to extract)

### Reference (read-only)
- `frontend/src/components/atoms/StatusDot.tsx` — existing status visualization
- `frontend/src/api/generated/agents/agents.ts` — agent API types

## Implementation Steps

1. **Detect any agent bootstrapping** in board page:
   - Board page already tracks `agents` array from SSE stream
   - Agent model has `is_board_lead: bool` field — but scope is **all agents**
   - Derive `isAnyAgentBootstrapping = agents.some(a => a.status === "provisioning")`
   - Get bootstrapping agent names for display: `agents.filter(a => a.status === "provisioning").map(a => a.name)`

2. **Add readiness polling** (only when bootstrapping):
   ```tsx
   useEffect(() => {
     if (!isAnyAgentBootstrapping) return;
     const interval = setInterval(async () => {
       // call readiness endpoint
       // if ready, agent SSE stream will update status
     }, 3000);
     return () => clearInterval(interval);
   }, [isAnyAgentBootstrapping, provisioningAgentIds]);
   ```

3. **Pass bootstrapping state to chat composer**:
   ```tsx
   <BoardChatComposer
     disabled={!canWrite || isAnyAgentBootstrapping}
     placeholder={
       isAnyAgentBootstrapping
         ? "Agent is being set up and will be ready shortly..."
         : canWrite
           ? "Message the board lead. Tag agents with @name."
           : "Read-only access. Chat is disabled."
     }
     isSending={isChatSending}
     onSend={handleSendChat}
     mentionSuggestions={boardChatMentionSuggestions}
   />
   ```

4. **Add inline bootstrap banner** above chat composer when bootstrapping:
   ```tsx
   {isAnyAgentBootstrapping && (
     <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
       <div className="flex items-center gap-2 text-amber-800">
         <RefreshCcw className="h-4 w-4 animate-spin" />
         <span className="font-medium">Setting up your board lead agent...</span>
       </div>
       <p className="mt-1 text-xs text-amber-600">
         This usually takes 1-3 minutes. Chat will be available once setup is complete.
       </p>
     </div>
   )}
   ```

5. **Add pulsing animation to StatusDot for provisioning** (optional enhancement):
   - Add `animate-pulse` class when status is provisioning in the agent sidebar

6. **Generate API client** for readiness endpoint:
   - After backend endpoint is added, run `pnpm api:gen` (orval) to regenerate typed client
   - Import and use generated readiness hook in board page

## Todo List

- [x] Derive `isAnyAgentBootstrapping` from agents array in board page
- [x] Add readiness polling hook (only when bootstrapping)
- [x] Pass disabled + placeholder to both BoardChatComposer instances
- [x] Add inline bootstrap banner above chat area
- [x] Add pulsing StatusDot for provisioning agents (optional)
- [x] Generate/update API client for readiness endpoint
- [x] Test transition animation: provisioning → online

## Success Criteria

- Chat input disabled when any agent is provisioning
- Clear "Setting up..." message visible to user
- Chat enables automatically when agent becomes ready
- No unnecessary polling when agent is already online
- Smooth transition — no jarring UI changes

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Board page is very large (4000+ lines) | Medium | Keep changes minimal, only add bootstrapping detection |
| Multiple chat composer instances | Low | Both get same disabled prop from shared state |
| SSE stream doesn't update quickly enough | Low | Readiness polling is the backup; SSE provides near-realtime |
