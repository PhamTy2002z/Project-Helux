---
phase: 7
title: "Bundle Splitting and Heavy Dependency Isolation"
risk: MEDIUM
effort: 4h
status: completed
---

# Phase 07: Bundle Splitting and Heavy Dependency Isolation

## Context Links
- [plan.md](./plan.md)
- [Markdown renderer](../../frontend/src/components/atoms/Markdown.tsx)
- [Approvals panel](../../frontend/src/components/BoardApprovalsPanel.tsx)

## Overview
- Priority: P1
- Status: completed
- Reduce route payload by isolating heavy libraries behind lazy boundaries.

## Key Insights
- Markdown parsing/rendering and charting libs are heavy and not needed on all routes.
- Existing dynamic imports cover some panels but not all expensive paths.

## Requirements
- Functional: keep markdown/chart UX identical.
- Non-functional: reduce initial route JS and hydration time.

## Architecture
- Introduce lazy wrappers for heavy renderers.
- Provide lightweight fallback for short text blocks.
- Keep chart code loaded only on routes that require chart interaction.

## Related Code Files
- Modify: `frontend/src/components/atoms/Markdown.tsx`, consumers in `frontend/src/app/**`
- Create: `frontend/src/components/atoms/MarkdownLite.tsx`, `frontend/src/components/atoms/LazyMarkdown.tsx`
- Delete: none

## Implementation Steps
1. Split markdown renderer into lite/heavy entry points.
2. Apply dynamic imports for heavy markdown consumers.
3. Confirm chart dependencies are route-scoped only.
4. Re-run bundle metrics and compare against baseline.

## Todo List
- [x] Create markdown lite/heavy split
- [x] Apply lazy markdown where safe
- [x] Verify chart imports remain isolated
- [x] Update perf baseline report

## Success Criteria
- Lower JS payload on non-chart, non-rich-markdown routes.
- No regression in markdown feature rendering.

## Risk Assessment
- Risk: hydration mismatch in markdown outputs.
- Mitigation: keep parser config identical across lazy boundaries.

## Security Considerations
- Preserve markdown sanitization and safe rendering guarantees.

## Next Steps
- Move to render-path micro-optimizations in Phase 8.
