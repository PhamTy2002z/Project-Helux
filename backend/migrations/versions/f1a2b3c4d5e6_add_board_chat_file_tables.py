"""add board chat file tables

Revision ID: f1a2b3c4d5e6
Revises: e5f6a7b8c9d0
Create Date: 2026-03-10 22:55:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "f1a2b3c4d5e6"
down_revision = "e5f6a7b8c9d0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # -- board_chat_file_assets --
    op.create_table(
        "board_chat_file_assets",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("board_id", sa.Uuid(), nullable=False),
        sa.Column("chat_session_id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("file_name", sa.String(255), nullable=False),
        sa.Column("mime_type", sa.String(127), nullable=False),
        sa.Column("file_size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column("object_storage_key", sa.String(512), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="uploaded"),
        sa.Column("preview_text", sa.Text(), nullable=True),
        sa.Column("extraction_error", sa.Text(), nullable=True),
        sa.Column("uploaded_by", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["board_id"], ["boards.id"]),
        sa.ForeignKeyConstraint(["chat_session_id"], ["board_chat_sessions.id"]),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_bcfa_board_session_created",
        "board_chat_file_assets",
        ["board_id", "chat_session_id", "created_at"],
    )
    op.create_index("ix_bcfa_organization_id", "board_chat_file_assets", ["organization_id"])
    op.create_index("ix_bcfa_status", "board_chat_file_assets", ["status"])

    # -- board_chat_message_files --
    op.create_table(
        "board_chat_message_files",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("board_memory_id", sa.Uuid(), nullable=False),
        sa.Column("file_asset_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["board_memory_id"], ["board_memory.id"]),
        sa.ForeignKeyConstraint(["file_asset_id"], ["board_chat_file_assets.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("board_memory_id", "file_asset_id", name="uq_message_file"),
    )
    op.create_index("ix_bcmf_board_memory_id", "board_chat_message_files", ["board_memory_id"])
    op.create_index("ix_bcmf_file_asset_id", "board_chat_message_files", ["file_asset_id"])

    # -- board_chat_file_tasks --
    op.create_table(
        "board_chat_file_tasks",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("file_asset_id", sa.Uuid(), nullable=False),
        sa.Column("agent_id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("dispatched_at", sa.DateTime(), nullable=True),
        sa.Column("ack_at", sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["file_asset_id"], ["board_chat_file_assets.id"]),
        sa.ForeignKeyConstraint(["agent_id"], ["agents.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("file_asset_id", "agent_id", name="uq_file_task_agent"),
    )
    op.create_index("ix_bcft_file_asset_id", "board_chat_file_tasks", ["file_asset_id"])
    op.create_index("ix_bcft_agent_id", "board_chat_file_tasks", ["agent_id"])
    op.create_index("ix_bcft_status", "board_chat_file_tasks", ["status"])

    # -- board_chat_file_reports --
    op.create_table(
        "board_chat_file_reports",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("file_task_id", sa.Uuid(), nullable=False),
        sa.Column("file_asset_id", sa.Uuid(), nullable=False),
        sa.Column("agent_id", sa.Uuid(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["file_task_id"], ["board_chat_file_tasks.id"]),
        sa.ForeignKeyConstraint(["file_asset_id"], ["board_chat_file_assets.id"]),
        sa.ForeignKeyConstraint(["agent_id"], ["agents.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_bcfr_file_task_id", "board_chat_file_reports", ["file_task_id"])
    op.create_index("ix_bcfr_file_asset_id", "board_chat_file_reports", ["file_asset_id"])
    op.create_index("ix_bcfr_agent_id", "board_chat_file_reports", ["agent_id"])


def downgrade() -> None:
    op.drop_index("ix_bcfr_agent_id", table_name="board_chat_file_reports")
    op.drop_index("ix_bcfr_file_asset_id", table_name="board_chat_file_reports")
    op.drop_index("ix_bcfr_file_task_id", table_name="board_chat_file_reports")
    op.drop_table("board_chat_file_reports")

    op.drop_index("ix_bcft_status", table_name="board_chat_file_tasks")
    op.drop_index("ix_bcft_agent_id", table_name="board_chat_file_tasks")
    op.drop_index("ix_bcft_file_asset_id", table_name="board_chat_file_tasks")
    op.drop_table("board_chat_file_tasks")

    op.drop_index("ix_bcmf_file_asset_id", table_name="board_chat_message_files")
    op.drop_index("ix_bcmf_board_memory_id", table_name="board_chat_message_files")
    op.drop_table("board_chat_message_files")

    op.drop_index("ix_bcfa_status", table_name="board_chat_file_assets")
    op.drop_index("ix_bcfa_organization_id", table_name="board_chat_file_assets")
    op.drop_index("ix_bcfa_board_session_created", table_name="board_chat_file_assets")
    op.drop_table("board_chat_file_assets")
