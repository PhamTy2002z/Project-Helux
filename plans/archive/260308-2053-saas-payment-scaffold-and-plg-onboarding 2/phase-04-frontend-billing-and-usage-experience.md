# Phase 04: Frontend billing modal and usage experience

## Context links
- `frontend/src/app/(app)/settings/page.tsx`
- `frontend/src/app/(app)/organization/page.tsx`
- `frontend/src/components/organisms/DashboardSidebar.tsx`
- `frontend/src/api/generated/metrics/metrics.ts`

## Overview
- Priority: P0
- Status: Completed
- Description: thêm billing UX tối giản: 1 modal chọn plan + view usage/quota,
  không build checkout flow phức tạp.

## Key insights
- Người dùng cần đường nâng cấp rõ khi trial bị block.
- Billing page đầy đủ chưa cần ở v1; modal-first là đủ để unlock nhanh.
- Quota state cần hiện ở điểm hành động để giảm confusion.

## Requirements
- Functional requirements:
  - Modal `Choose plan` hiển thị 2 gói: Trial 7d, Pro.
  - CTA chọn gói gọi `simulate checkout` API.
  - Khi trial expired, tự mở luồng upgrade modal.
  - Show quota tóm tắt: boards, board_groups, agents, token usage.
- Non-functional requirements:
  - UX rõ, thao tác < 3 click để upgrade.
  - Responsive mobile + desktop.

## Architecture
- UI modules:
  - `UpgradeModal`, `PlanCard`, `QuotaSummary`.
- API hooks:
  - `billing/me/subscription`
  - `billing/simulate/checkout`
  - `metrics/quota-usage`
- Entry points:
  - Dashboard banner + create action intercept khi bị block.

## Related code files
- Files to modify:
  - `frontend/src/components/organisms/DashboardSidebar.tsx`
  - `frontend/src/app/(app)/settings/page.tsx`
  - `frontend/src/app/(app)/boards/new/page.tsx`
  - `frontend/src/app/(app)/agents/new/page.tsx`
- Files to create:
  - `frontend/src/components/billing/upgrade-modal.tsx`
  - `frontend/src/components/billing/plan-card.tsx`
  - `frontend/src/components/billing/quota-summary.tsx`
- Files to delete:
  - None.

## Implementation steps
1. Build modal UI + plan selection action.
2. Connect checkout simulate API + success/error states.
3. Add trial-expired blocking banner + forced upgrade CTA.
4. Surface quota summary ở dashboard/settings.

## Todo list
- [x] Modal accessible (keyboard + screen reader labels).
- [x] Error states có CTA retry rõ.
- [x] Trial expired luồng UX không dead-end.

## Success criteria
- User có thể unlock plan trong một modal flow.
- Quota/billing state dễ hiểu trước khi user đụng hard limit.

## Risk assessment
- Risk: modal trigger rải rác gây UX không nhất quán.
- Mitigation: dùng chung `UpgradeModal` entry từ một service/hook.

## Security considerations
- Không log payload billing mutation ở client console.
- Sanitize server error text trước khi render.

## Next steps
- Phase 05 để tối ưu activation sau khi unlock plan.
