# Phase 02: Backend simulated billing unlock

## Context links
- `backend/app/models/organization_plans.py`
- `backend/app/services/entitlements.py`
- `backend/app/api/organizations.py`
- `backend/app/services/activity_log.py`

## Overview
- Priority: P0
- Status: Completed
- Description: triển khai payment v1 tối giản: API simulated checkout để unlock
  plan cho org, không tạo full billing domain.

## Key insights
- Có thể tái dùng `organization_plans` hiện có, tránh thêm nhiều bảng.
- Cần idempotency để tránh double unlock khi user bấm lại modal.
- Cần audit log đầy đủ cho mọi chuyển plan.

## Requirements
- Functional requirements:
  - `POST /api/v1/billing/simulate/checkout` cho org admin.
  - Payload: `plan_tier`, `idempotency_key`.
  - `GET /api/v1/billing/me/subscription` trả trạng thái hiện tại.
  - Trial logic: set `effective_until = now + 7 days`.
- Non-functional requirements:
  - Idempotent command handling.
  - Transaction-safe cập nhật plan.
  - Audit event + request-id observable.

## Architecture
- Data strategy v1:
  - Reuse `organization_plans` + `plan_metadata`.
  - Không tạo `billing_customers/subscriptions/events` ở v1.
- API surface (internal v1):
  - `POST /api/v1/billing/simulate/checkout`
  - `GET /api/v1/billing/me/subscription`

## Related code files
- Files to modify:
  - `backend/app/main.py`
  - `backend/app/api/organizations.py`
  - `backend/app/services/entitlements.py`
  - `backend/app/services/activity_log.py`
- Files to create:
  - `backend/app/api/billing.py`
  - `backend/app/schemas/billing.py`
  - Optional migration: thêm cột idempotency tracking (nếu cần).
- Files to delete:
  - None.

## Implementation steps
1. Add billing simulated API routes.
2. Implement checkout handler có idempotency_key.
3. Map plan_tier -> organization_plans update (`trial_7d`/`pro`).
4. Emit audit events cho checkout/unlock action.

## Todo list
- [x] API authz pass (org admin only).
- [x] Idempotency tests pass.
- [x] Double-submit không gây state sai.

## Success criteria
- User bấm chọn plan trên modal là unlock thành công đúng tier.
- Không cần payment provider để chạy end-to-end flow.

## Risk assessment
- Risk: dùng lại bảng plan làm state khó mở rộng về sau.
- Mitigation: giữ contract API stable, migrate sang provider ở Phase 08.

## Security considerations
- Validate payload chặt (`trial_7d|pro` only).
- Ghi audit detail đầy đủ actor/org/action.

## Next steps
- Phase 03: enforce quota cứng + trial expiry blocking.
