# Phase 03: Entitlements and hard quota enforcement

## Context links
- `backend/app/services/entitlements.py`
- `backend/app/api/boards.py`
- `backend/app/api/metrics.py`
- `backend/app/services/rate_limit.py`

## Overview
- Priority: P0
- Status: Completed
- Description: chuyển từ plan manual sang enforcement tự động theo `trial_7d/pro`,
  có hard limit token + resource và block khi trial hết hạn.

## Key insights
- Quota logic đã có cho board/agent/task, cần mở rộng board_group + token.
- Trial expiry là rule business cứng, phải enforce ở mọi write path quan trọng.
- Không cần soft-limit phức tạp ở v1, ưu tiên deterministic hard limit.

## Requirements
- Functional requirements:
  - Enforce quota theo plan:
    - Trial: `1 board_group`, `1 board`, `3 agents total`, `3 agents/board`, token cap.
    - Pro: `1 board_group`, `3 boards`, `15 agents total`, `5 agents/board`, token cap.
  - Exclude gateway-main agents khỏi quota agent.
  - Trial hết hạn -> block runtime actions, chỉ cho upgrade flow.
- Non-functional requirements:
  - Deterministic và latency thấp ở path create board/group/agent/task.
  - Không race condition ở entitlement resolution.

## Architecture
- Entitlement resolution order:
  1) subscription tier + effective window,
  2) emergency override (nếu có),
  3) fallback safe deny khi trial expired.
- Token enforcement v1:
  - `org_daily_tokens`
  - `agent_daily_tokens`
  - `org_monthly_tokens` (pro)
  - `max_tokens_per_run`

## Related code files
- Files to modify:
  - `backend/app/services/entitlements.py`
  - `backend/app/api/organizations.py`
  - `backend/app/api/metrics.py`
  - `backend/app/schemas/entitlements.py`
  - `backend/app/api/board_groups.py`
- Files to create:
  - `backend/app/services/billing/entitlement_sync.py`
  - `backend/app/models/organization_plan_overrides.py` (optional if giữ override).
- Files to delete:
  - None.

## Implementation steps
1. Add plan tiers/schemas cho `trial_7d`.
2. Implement checks cho board_group limit và agents_per_board limit.
3. Implement trial-expired guard middleware/service.
4. Add token counter checks theo org/agent/day.
5. Expose quota payload cho FE billing modal/page.

## Todo list
- [x] Existing quota tests giữ pass.
- [x] Thêm tests trial expiry blocking.
- [x] Thêm tests board_group + agents_per_board limits.
- [ ] Thêm tests token hard limit reset theo ngày.

## Success criteria
- Không thể vượt quota resource/token khi chạy runtime.
- Trial hết hạn bị chặn đúng hành vi business.

## Risk assessment
- Risk: quota check phân tán nhiều endpoint gây lệch behavior.
- Mitigation: tập trung enforcement vào service layer dùng chung.

## Security considerations
- Error payload không leak thông tin nội bộ.
- Override endpoint (nếu có) bắt buộc owner/admin + audit reason.

## Next steps
- Phase 04 để surfacing rõ billing modal + quota warnings.
