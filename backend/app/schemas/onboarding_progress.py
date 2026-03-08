"""Schemas for step-based onboarding progress APIs."""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from sqlmodel import SQLModel

RUNTIME_ANNOTATION_TYPES = (datetime, UUID)
OnboardingStepKey = Literal[
    "use_case",
    "create_first_board",
    "run_onboarding_chat",
    "invite_teammate",
]
OnboardingStepStatus = Literal["pending", "completed", "skipped"]
OnboardingStepUpdateAction = Literal["complete", "skip", "reset"]


class OnboardingStepState(SQLModel):
    """Current state for one onboarding step."""

    key: OnboardingStepKey
    title: str
    status: OnboardingStepStatus
    completed_at: str | None = None
    skipped_at: str | None = None
    details: dict[str, object] | None = None


class OnboardingProgressRead(SQLModel):
    """Read payload for onboarding progress state."""

    organization_id: UUID
    user_id: UUID
    completed: bool
    completion_pct: int
    first_pending_step: OnboardingStepKey | None = None
    steps: list[OnboardingStepState]


class OnboardingStepUpdate(SQLModel):
    """Mutation payload for a single onboarding step."""

    step: OnboardingStepKey
    action: OnboardingStepUpdateAction
    details: dict[str, object] | None = None


class OnboardingStepViewed(SQLModel):
    """Event payload for tracking when a step is viewed."""

    step: OnboardingStepKey
