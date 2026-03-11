# Phase 05: PLG onboarding and first-value flow

## Context links
- `frontend/src/app/(app)/onboarding/page.tsx`
- `frontend/src/lib/onboarding.ts`
- `frontend/src/components/templates/DashboardShell.tsx`
- `frontend/src/app/(app)/boards/new/page.tsx`

## Overview
- Priority: P0
- Status: Completed (local validation)
- Description: thay onboarding gate kiểu profile-only bằng flow tạo giá trị thật
  trong phiên đầu.

## Key insights
- Redirect `/onboarding` đang đúng hướng, nhưng completion criteria quá mỏng.
- New user cần “what next” rõ, không nên thấy full navigation complexity ngay.

## Requirements
- Functional requirements:
  - Onboarding wizard 4 bước: use-case, create first board, run onboarding chat,
    invite teammate.
  - Checklist cố định trên dashboard đến khi hoàn tất first value.
  - Dynamic nav: unlock modules theo completion progress + role.
- Non-functional requirements:
  - Flow hoàn tất <10 phút trong median.
  - Không chặn user power nếu họ muốn skip có chủ đích.

## Architecture
- State model:
  - `onboarding_steps` lưu theo user + organization.
- FE modules:
  - `OnboardingWizard`, `GettingStartedChecklist`, `FirstValueNudges`.
- Event tracking:
  - `onboarding_step_viewed/completed/skipped`.

## Related code files
- Files to modify:
  - `frontend/src/app/(app)/onboarding/page.tsx`
  - `frontend/src/lib/onboarding.ts`
  - `frontend/src/components/templates/DashboardShell.tsx`
  - `frontend/src/components/organisms/DashboardSidebar.tsx`
- Files to create:
  - `frontend/src/components/onboarding/onboarding-wizard.tsx`
  - `frontend/src/components/onboarding/getting-started-checklist.tsx`
  - `backend/app/models/user_onboarding_progress.py`
  - `backend/app/api/onboarding_progress.py`
- Files to delete:
  - None.

## Implementation steps
1. Define onboarding progress schema + API.
2. Replace completion logic từ profile-only sang step-based.
3. Add checklist widget vào dashboard.
4. Add role-aware nav unlock logic.

## Todo list
- [x] Wizard có skip path + resume path.
- [x] Checklist reflect status đúng real-time.
- [x] Existing users migrate state safe.

## Success criteria
- Time-to-first-board giảm đáng kể.
- Tỷ lệ user rơi ở onboarding step 1 giảm theo target.

## Risk assessment
- Risk: ép flow quá chặt gây khó chịu user advanced.
- Mitigation: allow skip with explicit confirmation + deep-link quick actions.

## Security considerations
- Onboarding progress API phải auth theo active organization.
- Không để user chỉnh progress của org khác.

## Next steps
- Phase 06 để instrument và support production triage.
