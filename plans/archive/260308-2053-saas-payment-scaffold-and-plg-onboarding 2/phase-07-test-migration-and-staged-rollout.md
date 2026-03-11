# Phase 07: Test, migration, and staged rollout

## Context links
- `Makefile`
- `scripts/ci/run_saas_gates.sh`
- `docs/release/README.md`
- `docs/release/saas-beta-go-live-checklist.md`

## Overview
- Priority: P0
- Status: Completed (code + CI gates)
- Description: bảo đảm simulated payment unlock + quota hard limits rollout an toàn,
  có rollback path rõ.

## Key insights
- Scope v1 nhẹ hơn nên test tập trung vào business rule critical.
- Regression risk cao nhất là trial expiry block sai hoặc bypass quota.

## Requirements
- Functional requirements:
  - Migration/backfill an toàn cho org hiện hữu.
  - Test suites cho billing simulated API + quota enforcement.
  - Rollout stage 0 -> stage 2 với exit criteria.
- Non-functional requirements:
  - Rollback rõ, không mất dữ liệu tenant.
  - Không downtime vượt SLA nội bộ.

## Architecture
- Rollout controls:
  - feature flag by tenant cohort.
  - kill-switch cho simulated checkout endpoint.

## Related code files
- Files to modify:
  - `scripts/ci/run_saas_gates.sh`
  - `backend/tests/api/test_quota_enforcement.py`
  - `backend/tests/integration/test_saas_gates.py`
  - `frontend/src/app/(app)/onboarding/page.test.tsx` (or new tests)
- Files to create:
  - `backend/tests/api/test_billing_simulated_checkout.py`
  - `backend/tests/api/test_trial_expiry_blocking.py`
  - `frontend/src/components/billing/upgrade-modal.test.tsx`
- Files to delete:
  - None.

## Implementation steps
1. Viết migration/backfill cho trial/pro default mapping.
2. Add test cases cho success/failure/idempotency/expired-trial.
3. Extend SaaS gate script include billing simulated gates.
4. Rollout theo cohort, đo KPI mỗi stage.

## Todo list
- [ ] Migration rehearsal pass trên staging snapshot.
- [x] Billing/quota gates pass trong CI.
- [ ] Rollback drill có evidence.

## Success criteria
- Không có bypass quota hoặc unauthorized plan unlock.
- Trial expiry blocking đúng policy ở mọi endpoint quan trọng.

## Risk assessment
- Risk: thiếu test path edge case khiến bug production.
- Mitigation: thêm table-driven tests cho policy matrix trial/pro.

## Security considerations
- Validate permissions trong mọi test mutation path.
- Verify audit events `organization.plan.assign` / billing checkout actions.

## Next steps
- Phase 08 khi chuyển sang payment provider thật.
