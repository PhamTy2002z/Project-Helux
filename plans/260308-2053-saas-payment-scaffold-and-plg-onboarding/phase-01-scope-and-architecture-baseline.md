# Phase 01: Scope and architecture baseline

## Context links
- `docs/system-architecture.md`
- `docs/project-roadmap.md`
- `backend/app/services/entitlements.py`
- `frontend/src/lib/onboarding.ts`

## Overview
- Priority: P0
- Status: Completed
- Description: lock scope payment v1 thật gọn: modal chọn gói + simulated unlock,
  không checkout thật, không invoice, không tax.

## Key insights
- Hệ thống đã có plan/quota baseline, có thể tái sử dụng nhanh.
- Scope creep payment (portal, invoice, webhook phức tạp) sẽ làm trễ rollout.
- Cần lock business rules trial/pro trước khi code.

## Requirements
- Functional requirements:
  - Chỉ hỗ trợ 2 gói ở v1: `trial_7d`, `pro`.
  - Trial hết hạn thì block runtime, chỉ cho upgrade path.
  - Payment UX v1 là modal chọn gói và xác nhận unlock.
- Non-functional requirements:
  - Backward compatible với manual plan API tạm thời.
  - Không leak dữ liệu billing giữa tenant.
  - Feature flag rõ để bật payment thật sau.

## Architecture
- Billing v1 architecture:
  - `billing_app`: API simulated checkout + read current subscription.
  - `entitlements`: enforce quota cứng theo plan.
  - `frontend`: one modal + usage surface tối thiểu.
- Feature flag runtime:
  - `BILLING_MODE=simulated|provider`
  - `PAYMENT_PROVIDER=none|stripe|paddle`

## Related code files
- Files to modify:
  - `backend/app/core/config.py`
  - `backend/app/main.py`
  - `backend/app/api/organizations.py`
- Files to create:
  - `backend/app/schemas/billing.py`
  - `docs/reference/billing-v1-scope.md`
- Files to delete:
  - None.

## Implementation steps
1. Lock pricing rules v1 vào docs reference.
2. Lock env flags cho billing mode.
3. Chốt API contract simulated checkout/read subscription.
4. Chốt trạng thái org khi trial expired (`blocked_for_payment`).

## Todo list
- [x] Scope v1 được BE/FE sign-off.
- [x] Feature flag semantics documented.
- [x] Trial expiry behavior documented.

## Success criteria
- Team có spec rõ để implement nhanh, không tranh cãi scope.
- Không có hạng mục payment ngoài scope v1 lọt vào sprint.

## Risk assessment
- Risk: đội ngũ thêm tính năng payment thật trong sprint v1.
- Mitigation: explicit out-of-scope list + PR gate review.

## Security considerations
- Không log payload nhạy cảm ở endpoint billing.
- Yêu cầu org admin cho mọi mutation billing.

## Next steps
- Handoff sang Phase 02 để dựng simulated unlock backend.
