# Scout Report - React/Next Performance Baseline

Date: 2026-03-08
Scope: frontend app-router codebase, build artifacts, runtime query policies

## Key Findings
- Client-heavy architecture: 78 files contain `"use client"`.
- Route dynamic forcing: 34 app routes set `export const dynamic = "force-dynamic"`.
- Query churn: 64 uses of `refetchOnMount: "always"`, 29 uses of `refetchInterval`.
- Baseline shared JS remains high via root chunks (~400KB in root main set).
- Major waterfalls found:
  - `activity/page.tsx`: paged board loading + activity seeding performed in sequential loops.
  - `boards/[boardId]/page.tsx`: board snapshot then group snapshot sequentially.
- UX reset issues:
  - org switching triggers full `window.location.reload()` from multiple paths.

## High-Impact Targets
1. Reduce client boundary and remove unnecessary dynamic forcing.
2. Normalize query policy and remove global aggressive mount refetching.
3. Parallelize initial data fetch paths and stream/seed progressively.
4. Split heavy markdown/chart payload paths into lazily loaded islands.
5. Eliminate full-page reload on org switch.

## Build Evidence
- `frontend/.next/build-manifest.json` root main chunks carry a large common payload.
- `pnpm build` passes and confirms many static routes still hydrated with shared client baseline.

## Unresolved Questions
- SLA target for dashboard freshness (5s, 15s, or 30s)?
- Mobile-first perf budget target for first route (JS KB + TTI threshold)?
