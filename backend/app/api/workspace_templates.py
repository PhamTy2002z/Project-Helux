"""CRUD API for workspace templates."""

from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.api.deps import require_org_admin
from app.db.session import get_session
from app.schemas.common import OkResponse
from app.schemas.workspace_templates import (
    WorkspaceTemplateCreate,
    WorkspaceTemplateRead,
    WorkspaceTemplateUpdate,
)
from app.services import workspace_templates as svc
from app.services.organizations import OrganizationContext

if TYPE_CHECKING:
    from sqlmodel.ext.asyncio.session import AsyncSession

router = APIRouter(prefix="/workspace-templates", tags=["workspace-templates"])
SESSION_DEP = Depends(get_session)
ORG_ADMIN_DEP = Depends(require_org_admin)


@router.get("", response_model=list[WorkspaceTemplateRead])
async def list_workspace_templates(
    category: str | None = Query(default=None),
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_ADMIN_DEP,
) -> list[WorkspaceTemplateRead]:
    """List system + org workspace templates."""
    templates = await svc.list_templates(
        session,
        organization_id=ctx.organization.id,
        category=category,
    )
    return [WorkspaceTemplateRead.model_validate(t, from_attributes=True) for t in templates]


@router.get("/{template_id}", response_model=WorkspaceTemplateRead)
async def get_workspace_template(
    template_id: UUID,
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_ADMIN_DEP,
) -> WorkspaceTemplateRead:
    """Get a single workspace template by ID."""
    template = await svc.get_template(session, template_id=template_id)
    # Verify org access: system templates are visible to all; org templates only to their org
    if template.organization_id and template.organization_id != ctx.organization.id:
        from fastapi import HTTPException, status

        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Template not accessible")
    return WorkspaceTemplateRead.model_validate(template, from_attributes=True)


@router.post("", response_model=WorkspaceTemplateRead, status_code=201)
async def create_workspace_template(
    payload: WorkspaceTemplateCreate,
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_ADMIN_DEP,
) -> WorkspaceTemplateRead:
    """Create a custom org workspace template."""
    template = await svc.create_template(
        session,
        organization_id=ctx.organization.id,
        user_id=ctx.member.user_id if ctx.member else None,
        name=payload.name,
        description=payload.description,
        category=payload.category,
        icon=payload.icon,
        file_contents=payload.file_contents,
    )
    return WorkspaceTemplateRead.model_validate(template, from_attributes=True)


@router.patch("/{template_id}", response_model=WorkspaceTemplateRead)
async def update_workspace_template(
    template_id: UUID,
    payload: WorkspaceTemplateUpdate,
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_ADMIN_DEP,
) -> WorkspaceTemplateRead:
    """Update a custom org workspace template."""
    updates = payload.model_dump(exclude_unset=True)
    template = await svc.update_template(
        session,
        template_id=template_id,
        organization_id=ctx.organization.id,
        **updates,
    )
    return WorkspaceTemplateRead.model_validate(template, from_attributes=True)


@router.delete("/{template_id}", response_model=OkResponse)
async def delete_workspace_template(
    template_id: UUID,
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_ADMIN_DEP,
) -> OkResponse:
    """Delete a custom org workspace template."""
    await svc.delete_template(
        session,
        template_id=template_id,
        organization_id=ctx.organization.id,
    )
    return OkResponse()
