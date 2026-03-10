# Tester Agent Memory - Project Helux Backend

## Phase 7: Cost-Based Quota Testing (Complete)

### Key Implementation Changes
- **Multiplier Removal:** 0.5x billing multiplier removed from session_usage_sync.py
- **Raw Tokens:** billed_delta = openclaw_delta (no conversion)
- **Cost Tracking:** Added _coerce_cost(), _extract_cost_fields() to parser
- **2-Layer Enforcement:** Cost primary (when available), token as safety net

### Token Limits (Raw, not billed)
- trial_7d: 100_000 raw tokens
- pro: 500_000 raw tokens

### Test Architecture
- In-memory SQLite for isolation
- Monkeypatch for safe mocking of async functions
- Each test function < 200 lines (except quota service with 3 long tests)
- No shared state between tests

### Cost Coercion Patterns
```python
_coerce_cost() returns Decimal or None (never raises)
- Rejects: bool, None, negative values, invalid types
- Accepts: Decimal, int, float, valid strings
- Defaults: 0 when missing
```

### 2-Layer Blocking
```
Layer 1: if cost_data_available and cost >= cost_limit → 429 (agent_daily_cost)
Layer 2: elif token >= token_limit → 429 (agent_daily_tokens)
Timestamps: cost_blocked_at vs blocked_at
```

### Test File Locations
- Parser: `tests/schemas/test_openclaw_usage.py` (17 tests, NEW)
- Quota: `tests/services/test_agent_token_quota_service.py` (+3 tests)
- Sync: `tests/services/test_session_usage_sync.py` (updated 2 tests)
- Entitlements: `tests/services/test_entitlements.py` (unchanged, 6 tests)

### Coverage Summary
- Total: 35 tests, all passing (1.13s)
- Parser: Full coverage of cost coercion
- Enforcement: Both layers, cost unavailable, observe mode
- Backward compat: Verified cost defaults to 0

### Common Pitfalls Learned
1. Empty dict {} becomes [{}] in _as_session_items (line 28 returns [payload])
2. Cost precision: Decimal(12,6) in DB, Decimal strings in code
3. Monkeypatch async: Need to patch at module level, not on instances
4. Test DB: SQLite in-memory requires explicit .dispose() cleanup
