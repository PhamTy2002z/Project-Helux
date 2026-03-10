# Research Note - React Best Practices Mapping

Date: 2026-03-08
Source: ck:react-best-practices ruleset

## Rule to Phase Mapping
- `async-parallel`, `async-defer-await`: Phase 5, Phase 6
- `bundle-dynamic-imports`, `bundle-conditional`: Phase 7
- `server-serialization`, `server-parallel-fetching`: Phase 2, Phase 5
- `client-swr-dedup`: Phase 3, Phase 4
- `rerender-memo`, `rerender-derived-state`: Phase 5, Phase 8
- `rendering-content-visibility`, `rendering-hoist-jsx`: Phase 8

## Scope Boundaries
- Preserve existing behavior; optimize architecture and data flow only.
- Avoid premature micro-optimizations before removing major waterfalls.

## Unresolved Questions
- None.
