# Phase 06: Observability and support operations

## Context links
- `backend/app/api/metrics.py`
- `backend/app/core/error_handling.py`
- `docs/operations/incident-triage.md`
- `docs/release/saas-beta-go-live-checklist.md`

## Overview
- Priority: P1
- Status: Completed (local validation)
- Description: instrument vừa đủ để support được các case trial expired,
  quota exceeded, simulated checkout failed.

## Key insights
- v1 cần telemetry tối giản nhưng actionable, không cần full billing analytics.
- Support phải truy được flow upgrade theo request-id và org id.

## Requirements
- Functional requirements:
  - Add metrics: upgrade modal open, checkout simulate success/fail, trial blocked rate.
  - Add support timeline theo `X-Request-Id` + org id.
  - Add basic alert cho error spike ở billing simulate endpoint.
- Non-functional requirements:
  - Cardinality controlled.
  - Không log dữ liệu nhạy cảm.

## Architecture
- Metric namespaces:
  - `saas.billing.simulated.*`
  - `saas.quota.block.*`
  - `saas.trial.expired.*`
- Alert sources:
  - Threshold alerts cho failure ratio.

## Related code files
- Files to modify:
  - `backend/app/api/metrics.py`
  - `backend/app/core/logging.py`
  - `backend/app/services/activity_log.py`
  - `frontend/src/app/(app)/dashboard/page.tsx`
- Files to create:
  - `docs/operations/billing-simulated-incident-playbook.md`
- Files to delete:
  - None.

## Implementation steps
1. Define metric fields whitelist.
2. Emit metrics từ billing simulate API + quota blocking paths.
3. Add dashboard card tối giản cho trial/block status.
4. Viết runbook support cho 3 scenario chính.

## Todo list
- [ ] Metrics validated trên staging.
- [ ] Alert test drill pass.
- [ ] Runbook reviewed bởi on-call owner.

## Success criteria
- Support xử lý nhanh case user bị block trial/quota.
- MTTR của billing simulated incidents giảm rõ.

## Risk assessment
- Risk: thiếu telemetry khiến khó debug lỗi upgrade.
- Mitigation: bắt buộc log request-id + org_id + endpoint + result code.

## Security considerations
- Mask sensitive values trong logs/events.
- Audit all manual support overrides.

## Next steps
- Phase 07 cho test matrix + staged rollout.
