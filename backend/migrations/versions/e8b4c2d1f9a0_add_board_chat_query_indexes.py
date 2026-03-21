"""Add board chat query indexes for faster session and message loading.

Revision ID: e8b4c2d1f9a0
Revises: d9e8f7a6b5c4
Create Date: 2026-03-22 02:00:00.000000
"""

from __future__ import annotations

from alembic import op


# revision identifiers, used by Alembic.
revision = "e8b4c2d1f9a0"
down_revision = "d9e8f7a6b5c4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create composite indexes used by board chat list/stream endpoints."""
    op.create_index(
        "ix_board_memory_board_id_is_chat_chat_session_id_created_at",
        "board_memory",
        ["board_id", "is_chat", "chat_session_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_board_chat_sessions_board_archived_updated_created",
        "board_chat_sessions",
        ["board_id", "archived_at", "updated_at", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    """Drop composite indexes added for board chat query performance."""
    op.drop_index(
        "ix_board_chat_sessions_board_archived_updated_created",
        table_name="board_chat_sessions",
    )
    op.drop_index(
        "ix_board_memory_board_id_is_chat_chat_session_id_created_at",
        table_name="board_memory",
    )
