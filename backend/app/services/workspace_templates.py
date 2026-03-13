"""Service layer for workspace template CRUD operations."""

from __future__ import annotations

import re
from typing import TYPE_CHECKING
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlmodel import col, select

from app.core.logging import get_logger
from app.core.time import utcnow
from app.models.workspace_templates import WorkspaceTemplate

if TYPE_CHECKING:
    from sqlmodel.ext.asyncio.session import AsyncSession

logger = get_logger(__name__)


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "template"


async def list_templates(
    session: AsyncSession,
    *,
    organization_id: UUID,
    category: str | None = None,
) -> list[WorkspaceTemplate]:
    """List system templates + org-scoped templates."""
    statement = select(WorkspaceTemplate).where(
        or_(
            col(WorkspaceTemplate.organization_id) == organization_id,
            col(WorkspaceTemplate.is_system).is_(True),
        )
    )
    if category:
        statement = statement.where(col(WorkspaceTemplate.category) == category)
    statement = statement.order_by(
        col(WorkspaceTemplate.is_system).desc(),
        col(WorkspaceTemplate.name).asc(),
    )
    return list(await session.exec(statement))


async def get_template(
    session: AsyncSession,
    *,
    template_id: UUID,
) -> WorkspaceTemplate:
    template = await session.get(WorkspaceTemplate, template_id)
    if template is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    return template


async def create_template(
    session: AsyncSession,
    *,
    organization_id: UUID,
    user_id: UUID | None,
    name: str,
    description: str | None = None,
    category: str | None = None,
    icon: str | None = None,
    file_contents: dict[str, str],
) -> WorkspaceTemplate:
    slug = _slugify(name)
    # Check for slug collision within org
    existing = (
        await session.exec(
            select(WorkspaceTemplate)
            .where(col(WorkspaceTemplate.organization_id) == organization_id)
            .where(col(WorkspaceTemplate.slug) == slug)
        )
    ).first()
    if existing:
        slug = f"{slug}-{utcnow().strftime('%H%M%S')}"

    template = WorkspaceTemplate(
        organization_id=organization_id,
        name=name,
        slug=slug,
        description=description,
        category=category,
        icon=icon,
        file_contents=file_contents,
        is_system=False,
        created_by=user_id,
    )
    session.add(template)
    await session.commit()
    await session.refresh(template)
    return template


async def update_template(
    session: AsyncSession,
    *,
    template_id: UUID,
    organization_id: UUID,
    **updates: object,
) -> WorkspaceTemplate:
    template = await get_template(session, template_id=template_id)
    if template.is_system:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="System templates cannot be modified",
        )
    if template.organization_id != organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Template not accessible",
        )
    for key, value in updates.items():
        if value is not None:
            setattr(template, key, value)
    if "name" in updates and updates["name"] is not None:
        template.slug = _slugify(str(updates["name"]))
    template.updated_at = utcnow()
    session.add(template)
    await session.commit()
    await session.refresh(template)
    return template


async def delete_template(
    session: AsyncSession,
    *,
    template_id: UUID,
    organization_id: UUID,
) -> None:
    template = await get_template(session, template_id=template_id)
    if template.is_system:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="System templates cannot be deleted",
        )
    if template.organization_id != organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Template not accessible",
        )
    await session.delete(template)
    await session.commit()
