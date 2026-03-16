"""User onboarding progress APIs (step-based, org-scoped)."""

from __future__ import annotations

import json
from typing import TYPE_CHECKING, Any, cast
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlmodel import col, select

from app.api.deps import require_org_member
from app.core.logging import get_request_endpoint, get_request_id
from app.core.time import utcnow
from app.db.session import get_session
from app.models.board_onboarding import BoardOnboardingSession
from app.models.boards import Board
from app.models.organization_members import OrganizationMember
from app.models.user_onboarding_progress import UserOnboardingProgress
from app.schemas.onboarding_progress import (
    OnboardingProgressRead,
    OnboardingStepKey,
    OnboardingStepState,
    OnboardingStepStatus,
    OnboardingStepUpdate,
    OnboardingStepViewed,
)
from app.services.activity_log import record_activity
from app.services.organizations import OrganizationContext

if TYPE_CHECKING:
    from sqlmodel.ext.asyncio.session import AsyncSession

router = APIRouter(prefix="/onboarding/progress", tags=["onboarding-progress"])
SESSION_DEP = Depends(get_session)
ORG_MEMBER_DEP = Depends(require_org_member)

STEP_ORDER: tuple[OnboardingStepKey, ...] = (
    "use_case",
    "create_first_board",
    "run_onboarding_chat",
    "invite_teammate",
)
STEP_TITLES: dict[OnboardingStepKey, str] = {
    "use_case": "Define your use case",
    "create_first_board": "Choose your workspace mode",
    "run_onboarding_chat": "Set your first success outcome",
    "invite_teammate": "Plan your collaboration timing",
}
FINISHED_STATES: set[OnboardingStepStatus] = {"completed", "skipped"}


def _build_default_steps() -> dict[str, dict[str, object]]:
    return {step: {"status": "pending"} for step in STEP_ORDER}


def _coerce_step_status(value: object) -> OnboardingStepStatus:
    if value in {"pending", "completed", "skipped"}:
        return cast(OnboardingStepStatus, value)
    return "pending"


def _step_state_from_payload(
    step: OnboardingStepKey,
    payload: dict[str, object],
) -> OnboardingStepState:
    status = _coerce_step_status(payload.get("status"))
    completed_at = payload.get("completed_at")
    skipped_at = payload.get("skipped_at")
    details = payload.get("details")
    return OnboardingStepState(
        key=step,
        title=STEP_TITLES[step],
        status=status,
        completed_at=completed_at if isinstance(completed_at, str) else None,
        skipped_at=skipped_at if isinstance(skipped_at, str) else None,
        details=details if isinstance(details, dict) else None,
    )


def _normalize_steps(raw_steps: object) -> dict[str, dict[str, object]]:
    normalized = _build_default_steps()
    if not isinstance(raw_steps, dict):
        return normalized
    for step in STEP_ORDER:
        existing = raw_steps.get(step)
        if not isinstance(existing, dict):
            continue
        current = normalized[step]
        status = _coerce_step_status(existing.get("status"))
        current["status"] = status
        completed_at = existing.get("completed_at")
        if isinstance(completed_at, str):
            current["completed_at"] = completed_at
        skipped_at = existing.get("skipped_at")
        if isinstance(skipped_at, str):
            current["skipped_at"] = skipped_at
        details = existing.get("details")
        if isinstance(details, dict):
            current["details"] = details
    return normalized


def _is_complete(status: object) -> bool:
    return _coerce_step_status(status) in FINISHED_STATES


def _to_read(progress: UserOnboardingProgress) -> OnboardingProgressRead:
    steps_payload = _normalize_steps(progress.steps)
    states = [_step_state_from_payload(step, steps_payload[step]) for step in STEP_ORDER]
    completed_count = sum(1 for state in states if state.status in FINISHED_STATES)
    total = len(states) if states else 1
    first_pending_step = next(
        (state.key for state in states if state.status == "pending"),
        None,
    )
    completed = completed_count == len(states)
    return OnboardingProgressRead(
        organization_id=progress.organization_id,
        user_id=progress.user_id,
        completed=completed,
        completion_pct=round((completed_count / total) * 100),
        first_pending_step=first_pending_step,
        steps=states,
    )


async def _get_or_create_progress(
    session: AsyncSession,
    *,
    organization_id: UUID,
    user_id: UUID,
) -> UserOnboardingProgress:
    progress = await UserOnboardingProgress.objects.filter_by(
        organization_id=organization_id,
        user_id=user_id,
    ).first(session)
    if progress is not None:
        return progress
    now = utcnow()
    progress = UserOnboardingProgress(
        organization_id=organization_id,
        user_id=user_id,
        steps=_build_default_steps(),
        created_at=now,
        updated_at=now,
    )
    session.add(progress)
    await session.commit()
    await session.refresh(progress)
    return progress


async def _apply_inferred_step_completion(
    session: AsyncSession,
    *,
    progress: UserOnboardingProgress,
) -> bool:
    now = utcnow()
    steps = _normalize_steps(progress.steps)
    changed = False
    org_id = progress.organization_id

    board_count = int(
        (
            await session.exec(
                select(func.count(col(Board.id))).where(col(Board.organization_id) == org_id)
            )
        ).one()
        or 0
    )
    member_count = int(
        (
            await session.exec(
                select(func.count(col(OrganizationMember.id))).where(
                    col(OrganizationMember.organization_id) == org_id
                )
            )
        ).one()
        or 0
    )
    onboarding_session_count = int(
        (
            await session.exec(
                select(func.count(col(BoardOnboardingSession.id)))
                .join(Board, col(Board.id) == col(BoardOnboardingSession.board_id))
                .where(col(Board.organization_id) == org_id)
            )
        ).one()
        or 0
    )

    inferred: dict[OnboardingStepKey, bool] = {
        "use_case": False,
        "create_first_board": board_count > 0,
        "run_onboarding_chat": onboarding_session_count > 0,
        "invite_teammate": member_count > 1,
    }
    for step, should_complete in inferred.items():
        if not should_complete:
            continue
        state = steps[step]
        if _is_complete(state.get("status")):
            continue
        state["status"] = "completed"
        state["completed_at"] = now.isoformat()
        changed = True

    if all(_is_complete(steps[step].get("status")) for step in STEP_ORDER):
        if progress.completed_at is None:
            progress.completed_at = now
            changed = True
    elif progress.completed_at is not None:
        progress.completed_at = None
        changed = True

    if changed:
        progress.steps = steps
        progress.updated_at = now
        session.add(progress)
        await session.commit()
        await session.refresh(progress)
    return changed


def _record_onboarding_event(
    session: AsyncSession,
    *,
    organization_id: UUID,
    event_type: str,
    step: OnboardingStepKey,
    status: str | None = None,
) -> None:
    payload: dict[str, Any] = {
        "step": step,
        "request_id": get_request_id(),
        "endpoint": get_request_endpoint(),
    }
    if status is not None:
        payload["status"] = status
    record_activity(
        session,
        event_type=event_type,
        message=json.dumps(payload, separators=(",", ":"), sort_keys=True),
        organization_id=organization_id,
    )


@router.get("/me", response_model=OnboardingProgressRead)
async def get_my_onboarding_progress(
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> OnboardingProgressRead:
    """Return onboarding step progress for the active org membership."""
    progress = await _get_or_create_progress(
        session,
        organization_id=ctx.organization.id,
        user_id=ctx.member.user_id,
    )
    await _apply_inferred_step_completion(session, progress=progress)
    return _to_read(progress)


@router.patch("/me/steps", response_model=OnboardingProgressRead)
async def update_my_onboarding_step(
    payload: OnboardingStepUpdate,
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> OnboardingProgressRead:
    """Update one onboarding step (complete, skip, or reset)."""
    progress = await _get_or_create_progress(
        session,
        organization_id=ctx.organization.id,
        user_id=ctx.member.user_id,
    )
    steps = _normalize_steps(progress.steps)
    step_state = steps[payload.step]
    now = utcnow()

    if payload.action == "complete":
        step_state["status"] = "completed"
        step_state["completed_at"] = now.isoformat()
        step_state.pop("skipped_at", None)
        _record_onboarding_event(
            session,
            organization_id=ctx.organization.id,
            event_type="onboarding_step_completed",
            step=payload.step,
            status="completed",
        )
    elif payload.action == "skip":
        step_state["status"] = "skipped"
        step_state["skipped_at"] = now.isoformat()
        _record_onboarding_event(
            session,
            organization_id=ctx.organization.id,
            event_type="onboarding_step_skipped",
            step=payload.step,
            status="skipped",
        )
    else:
        step_state["status"] = "pending"
        step_state.pop("completed_at", None)
        step_state.pop("skipped_at", None)

    if isinstance(payload.details, dict):
        step_state["details"] = payload.details

    completed = all(_is_complete(steps[step].get("status")) for step in STEP_ORDER)
    progress.completed_at = now if completed else None
    progress.steps = steps
    progress.updated_at = now
    session.add(progress)
    await session.commit()
    await session.refresh(progress)

    await _apply_inferred_step_completion(session, progress=progress)
    return _to_read(progress)


@router.post("/me/events/viewed")
async def mark_onboarding_step_viewed(
    payload: OnboardingStepViewed,
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> dict[str, bool]:
    """Track onboarding step viewed events for product analytics."""
    _record_onboarding_event(
        session,
        organization_id=ctx.organization.id,
        event_type="onboarding_step_viewed",
        step=payload.step,
    )
    await session.commit()
    return {"ok": True}
