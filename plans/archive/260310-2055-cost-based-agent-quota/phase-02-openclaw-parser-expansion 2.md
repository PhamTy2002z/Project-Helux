# Phase 2: OpenClaw Parser Expansion

## Context

- [Current parser](../../backend/app/schemas/openclaw_usage.py) - only extracts `totalTokens`
- [Usage client](../../backend/app/services/openclaw/usage_client.py) - calls parser

## Overview

- **Priority**: P1
- **Status**: pending
- **Effort**: 1.5h

Expand `OpenClawSessionUsage` dataclass and parser to extract cost fields from the OpenClaw response.

## Key Insights

OpenClaw `sessions.usage` returns:
```json
{
  "sessions": [{
    "key": "agent:main:session-id",
    "usage": {
      "totalTokens": 12345,
      "totalCost": 0.0234,
      "missingCostEntries": 0
    }
  }]
}
```

We need `totalCost` and `missingCostEntries`. Other granular cost fields (inputCost, outputCost, etc.) are not needed for enforcement (YAGNI).

## Related Code Files

### Files to modify:
- `backend/app/schemas/openclaw_usage.py` - expand dataclass + parser
- `backend/app/services/openclaw/usage_client.py` - update function name/return (minor)

## Implementation Steps

1. **Expand `OpenClawSessionUsage` dataclass**:
   ```python
   @dataclass(frozen=True, slots=True)
   class OpenClawSessionUsage:
       session_key: str
       total_tokens: int
       total_cost: Decimal        # NEW
       missing_cost_entries: int   # NEW
   ```

2. **Add `_coerce_cost` helper** (similar to `_coerce_token_count` but for float/Decimal):
   ```python
   def _coerce_cost(value: object) -> Decimal | None:
       # Accept int, float, str; reject negative; return Decimal
   ```

3. **Add `_extract_cost_fields` helper**:
   ```python
   def _extract_cost_fields(session_item: dict) -> tuple[Decimal, int]:
       # Extract totalCost (default 0), missingCostEntries (default 0)
   ```

4. **Rename `parse_session_usage_total_tokens` to `parse_session_usage`** (or keep old name as alias for backward compat):
   - Add cost extraction to the existing parse flow
   - Return expanded dataclass

5. **Update `usage_client.py`**: update import if function renamed

## Todo

- [ ] Add `Decimal` import, expand dataclass with `total_cost`, `missing_cost_entries`
- [ ] Add `_coerce_cost` helper
- [ ] Add `_extract_cost_fields` helper
- [ ] Update main parse function to populate cost fields
- [ ] Update usage_client.py import if needed
- [ ] Keep file under 200 lines

## Success Criteria

- Parser extracts cost fields when present
- Parser defaults to `Decimal(0)` / `0` when cost fields missing (backward compat with older OpenClaw)
- Existing token parsing unaffected
- All existing tests pass

## Risk Assessment

- Older OpenClaw versions may not return cost fields - handled by defaults
- Float precision - use `Decimal` from the parse layer
