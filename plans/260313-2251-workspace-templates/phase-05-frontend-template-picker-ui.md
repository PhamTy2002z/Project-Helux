# Phase 5: Frontend Template Picker UI

## Context Links
- [Phase 2: CRUD API](phase-02-backend-crud-api-and-seed-data.md)
- [Phase 4: Agent creation integration](phase-04-agent-creation-flow-integration.md)
- [AgentsTable component](../../frontend/src/components/agents/AgentsTable.tsx)
- [Board page](../../frontend/src/app/(app)/boards/[boardId]/page.tsx)
- [Design guidelines](../../docs/design-guidelines.md)

## Overview
- **Priority**: P1
- **Status**: complete
- **Effort**: 4h
- **Progress**: 100%

Build template picker dialog shown during agent creation. User selects template from categorized grid, optionally customizes name/instructions, then creates agent.

## Key Insights
- Agent creation currently goes through board page or agents table. Template picker inserts BEFORE the create call.
- Follow existing dialog patterns (shadcn/ui Dialog + form).
- Template data fetched via generated Orval hook from phase 2 API.
- Category tabs for filtering (General, Development, Support, Content, etc.).
- "Blank" templates for users who want to start from scratch.

## Requirements
- Functional:
  - Template picker dialog opens when user clicks "Create Agent" on board.
  - Grid of template cards grouped by category.
  - Search/filter by name.
  - Card shows: icon, name, description, category badge.
  - Selecting template -> step 2: customize name (pre-filled from template), optional instruction override.
  - "Skip template" option for existing flow (no template).
  - Submit creates agent with `template_id`.
- Non-functional:
  - Responsive: 2-col on mobile, 3-col on tablet, 4-col on desktop.
  - Loading skeleton while templates fetch.
  - Keyboard navigable (tab through cards, enter to select).

## Architecture

### Component Tree

```
AgentCreateDialog (new)
├── TemplatePickerStep
│   ├── TemplateCategoryTabs (General | Development | Support | ...)
│   ├── TemplateSearchInput
│   └── TemplateCardGrid
│       └── TemplateCard (icon, name, description, category badge)
│           └── onClick -> select template
├── AgentCustomizeStep (shown after template selected)
│   ├── NameInput (pre-filled from template.name)
│   ├── TemplatePreview (read-only, collapsed by default)
│   └── CreateButton
└── SkipTemplateLink -> existing create flow
```

### Data Flow

```
User clicks "Create Agent"
    |
    v
Open AgentCreateDialog
    |
    +-- Fetch GET /api/v1/workspace-templates (TanStack Query)
    |
    v
TemplatePickerStep
    |
    +-- User selects template card
    |
    v
AgentCustomizeStep
    |
    +-- User edits name (optional)
    +-- Clicks "Create Agent"
    |
    v
POST /api/v1/agents { name, board_id, template_id }
    |
    v
Close dialog, invalidate agents query, show success toast
```

### Hooks

```typescript
// useWorkspaceTemplates.ts
export function useWorkspaceTemplates(category?: string) {
  return useQuery({
    queryKey: ['workspace-templates', { category }],
    queryFn: () => getWorkspaceTemplates({ category }),
  });
}
```

## Related Code Files

### Files to create:
- `frontend/src/components/agents/agent-create-dialog.tsx` — main dialog with 2-step flow.
- `frontend/src/components/agents/template-picker-step.tsx` — template grid + category tabs.
- `frontend/src/components/agents/template-card.tsx` — individual template card.
- `frontend/src/components/agents/agent-customize-step.tsx` — name input + preview.
- `frontend/src/lib/hooks/use-workspace-templates.ts` — TanStack Query hook.

### Files to modify:
- `frontend/src/components/agents/AgentsTable.tsx` — replace create button to open new dialog.
- Board page component — wire up new dialog trigger.

### Files to delete:
- None.

## Implementation Steps

1. Run `pnpm orval` to generate API client for workspace-templates endpoints.

2. Create `use-workspace-templates.ts` hook:
   - `useWorkspaceTemplates(category?)` for list query.
   - Stale time: 5 minutes (templates rarely change).

3. Create `template-card.tsx`:
   - Props: `template: WorkspaceTemplateRead`, `selected: boolean`, `onSelect: () => void`.
   - Display: icon (Lucide icon mapped from `template.icon`), name, description (truncated 80 chars), category badge.
   - Visual: border highlight when selected, hover shadow.
   - Keep under 80 lines.

4. Create `template-picker-step.tsx`:
   - Category tabs using shadcn Tabs component.
   - Categories derived from templates data: `[...new Set(templates.map(t => t.category))]`.
   - "All" tab as default.
   - Search input filters by name (client-side, debounced 300ms).
   - Grid layout: `grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3`.
   - Loading: skeleton cards.
   - Empty state: "No templates found".

5. Create `agent-customize-step.tsx`:
   - Shows selected template summary (icon + name + description).
   - Name input (pre-filled, editable).
   - Collapsible "Preview template files" section (accordion with file content).
   - "Back" button to return to picker.
   - "Create Agent" submit button.

6. Create `agent-create-dialog.tsx`:
   - Dialog wrapper with state machine: `step: "pick" | "customize"`.
   - "Skip template" link in footer -> create agent without template (existing flow).
   - On submit: call `createAgent` mutation with `{ name, board_id, template_id }`.
   - On success: close dialog, invalidate `['agents']` query, toast.

7. Modify `AgentsTable.tsx`:
   - Replace existing create button/action to open `AgentCreateDialog`.

8. Icon mapping utility:
   ```typescript
   // Map template.icon string to Lucide icon component
   const ICON_MAP: Record<string, LucideIcon> = {
     sparkles: Sparkles,
     headset: Headset,
     code: Code,
     // ...
   };
   ```

## Todo List
- [x] Orval client regenerated with workspace-templates types.
- [x] `useWorkspaceTemplates` hook created.
- [x] `TemplateCard` component created.
- [x] `TemplatePickerStep` with category tabs + search.
- [x] `AgentCustomizeStep` with name input + preview.
- [x] `AgentCreateDialog` with 2-step flow.
- [x] `AgentsTable` wired to new dialog.
- [x] Responsive layout verified (mobile/tablet/desktop).
- [x] Keyboard navigation tested.
- [x] Loading + empty states implemented (skeleton loading).

## Success Criteria
- Template picker shows all 12 seed templates.
- Category tabs filter correctly.
- Search filters by name.
- Selected template pre-fills agent name.
- Agent created with `template_id` on submit.
- "Skip template" creates agent without template (backward compat).
- Dialog is responsive and keyboard accessible.

## Risk Assessment
- Component count (5 new files): each kept under 150 lines per code standards.
- Icon mapping: fallback to generic icon if `template.icon` not in map.
- Template list could grow; pagination not needed for MVP (12-50 templates).

## Security Considerations
- Template content displayed as read-only preview; no user-editable template content in this phase.
- `template_id` validated server-side (phase 4); frontend just passes UUID.
