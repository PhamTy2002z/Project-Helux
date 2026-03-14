"""Workspace template model for pre-built agent configuration bundles."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import JSON, Column, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field

from app.core.time import utcnow
from app.models.base import QueryModel


class WorkspaceTemplate(QueryModel, table=True):
    """Pre-built workspace file bundle applied during agent provisioning."""

    __tablename__ = "workspace_templates"  # pyright: ignore[reportAssignmentType]
    __table_args__ = (
        UniqueConstraint("organization_id", "slug", name="uq_workspace_templates_org_slug"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    organization_id: UUID | None = Field(
        default=None, foreign_key="organizations.id", index=True
    )
    name: str = Field(max_length=200)
    slug: str = Field(max_length=200, index=True)
    description: str | None = Field(default=None)
    category: str | None = Field(default=None, index=True)
    icon: str | None = Field(default=None, max_length=50)
    file_contents: dict[str, Any] = Field(
        sa_column=Column(JSON().with_variant(JSONB, "postgresql"), nullable=False)
    )
    is_system: bool = Field(default=False, index=True)
    created_by: UUID | None = Field(default=None, foreign_key="users.id")
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
