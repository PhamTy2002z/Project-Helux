"""Workspace template content rendering and file writing for gateway provisioning."""

from __future__ import annotations

from app.core.logging import get_logger
from app.core.time import utcnow

logger = get_logger(__name__)


def render_template_content(
    raw_content: str,
    *,
    agent_name: str,
    board_name: str,
    org_name: str,
) -> str:
    """Simple variable substitution on template content. No Jinja2 (prevents SSTI)."""
    replacements = {
        "{{agent_name}}": agent_name,
        "{{board_name}}": board_name,
        "{{org_name}}": org_name,
        "{{date}}": utcnow().date().isoformat(),
    }
    result = raw_content
    for key, value in replacements.items():
        result = result.replace(key, value)
    return result


def render_template_files(
    file_contents: dict[str, str],
    *,
    agent_name: str,
    board_name: str,
    org_name: str,
) -> dict[str, str]:
    """Render all template files with variable substitution."""
    return {
        filename: render_template_content(
            content,
            agent_name=agent_name,
            board_name=board_name,
            org_name=org_name,
        )
        for filename, content in file_contents.items()
    }
