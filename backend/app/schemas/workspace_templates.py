"""Pydantic/SQLModel schemas for workspace template API payloads."""

from __future__ import annotations

import re
from datetime import datetime
from uuid import UUID

from pydantic import Field, field_validator
from sqlmodel import SQLModel

from app.schemas.common import NonEmptyStr

ALLOWED_FILE_KEYS = frozenset({"AGENTS.md", "SOUL.md", "IDENTITY.md", "TOOLS.md"})
MAX_FILE_CHARS = 20_000
MAX_TOTAL_CHARS = 150_000
_ENV_VAR_PATTERN = re.compile(r"\$\{[^}]+\}")


def _validate_file_contents(value: dict[str, str]) -> dict[str, str]:
    """Validate workspace template file contents."""
    if not isinstance(value, dict):
        msg = "file_contents must be a dict"
        raise ValueError(msg)
    if "AGENTS.md" not in value:
        msg = "file_contents must include AGENTS.md"
        raise ValueError(msg)
    total_chars = 0
    for key, content in value.items():
        if key not in ALLOWED_FILE_KEYS:
            msg = f"Invalid file key '{key}'. Allowed: {', '.join(sorted(ALLOWED_FILE_KEYS))}"
            raise ValueError(msg)
        if not isinstance(content, str):
            msg = f"File content for '{key}' must be a string"
            raise ValueError(msg)
        if len(content) > MAX_FILE_CHARS:
            msg = f"File '{key}' exceeds {MAX_FILE_CHARS} character limit ({len(content)} chars)"
            raise ValueError(msg)
        if _ENV_VAR_PATTERN.search(content):
            msg = f"File '{key}' contains forbidden ${{...}} env var references"
            raise ValueError(msg)
        total_chars += len(content)
    if total_chars > MAX_TOTAL_CHARS:
        msg = f"Total content exceeds {MAX_TOTAL_CHARS} character limit ({total_chars} chars)"
        raise ValueError(msg)
    return value


class WorkspaceTemplateCreate(SQLModel):
    """Payload for creating a workspace template."""

    name: NonEmptyStr = Field(description="Template display name.")
    description: str | None = Field(default=None, description="Short description.")
    category: str | None = Field(default=None, description="Category for filtering.")
    icon: str | None = Field(default=None, description="Icon key (Lucide icon name).")
    file_contents: dict[str, str] = Field(description="Workspace file contents keyed by filename.")

    @field_validator("file_contents")
    @classmethod
    def validate_file_contents(cls, value: dict[str, str]) -> dict[str, str]:
        return _validate_file_contents(value)


class WorkspaceTemplateUpdate(SQLModel):
    """Payload for updating a workspace template."""

    name: NonEmptyStr | None = Field(default=None)
    description: str | None = Field(default=None)
    category: str | None = Field(default=None)
    icon: str | None = Field(default=None)
    file_contents: dict[str, str] | None = Field(default=None)

    @field_validator("file_contents")
    @classmethod
    def validate_file_contents(cls, value: dict[str, str] | None) -> dict[str, str] | None:
        if value is None:
            return None
        return _validate_file_contents(value)


class WorkspaceTemplateRead(SQLModel):
    """Public workspace template representation returned by the API."""

    id: UUID
    organization_id: UUID | None = None
    name: str
    slug: str
    description: str | None = None
    category: str | None = None
    icon: str | None = None
    file_contents: dict[str, str]
    is_system: bool
    created_by: UUID | None = None
    created_at: datetime
    updated_at: datetime
