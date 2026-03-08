"""add board chat sessions and session key on board memory

Revision ID: f9a1b2c3d4e5
Revises: e6f7a8b9c0d1
Create Date: 2026-03-08 13:32:00.000000

"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "f9a1b2c3d4e5"
down_revision = "e6f7a8b9c0d1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "board_chat_sessions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("board_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("created_by", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("archived_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["board_id"], ["boards.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_board_chat_sessions_board_id_archived_at_updated_at",
        "board_chat_sessions",
        ["board_id", "archived_at", "updated_at"],
    )
    op.create_index(
        "ix_board_chat_sessions_archived_at",
        "board_chat_sessions",
        ["archived_at"],
    )

    op.add_column("board_memory", sa.Column("chat_session_id", sa.Uuid(), nullable=True))
    op.create_index(
        "ix_board_memory_chat_session_id",
        "board_memory",
        ["chat_session_id"],
    )
    op.create_foreign_key(
        "fk_board_memory_chat_session_id",
        "board_memory",
        "board_chat_sessions",
        ["chat_session_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_board_memory_board_id_is_chat_chat_session_created_at",
        "board_memory",
        ["board_id", "is_chat", "chat_session_id", "created_at"],
    )

    bind = op.get_bind()
    board_ids = [
        row[0]
        for row in bind.execute(
            sa.text(
                """
                SELECT DISTINCT board_id
                FROM board_memory
                WHERE is_chat = true
                  AND chat_session_id IS NULL
                """,
            )
        ).fetchall()
    ]
    now = datetime.now(UTC).replace(tzinfo=None)

    for board_id in board_ids:
        chat_session_id = uuid.uuid4()
        bind.execute(
            sa.text(
                """
                INSERT INTO board_chat_sessions (
                    id,
                    board_id,
                    title,
                    created_by,
                    created_at,
                    updated_at,
                    archived_at
                ) VALUES (
                    :id,
                    :board_id,
                    :title,
                    :created_by,
                    :created_at,
                    :updated_at,
                    :archived_at
                )
                """,
            ),
            {
                "id": chat_session_id,
                "board_id": board_id,
                "title": "General",
                "created_by": "migration",
                "created_at": now,
                "updated_at": now,
                "archived_at": None,
            },
        )
        bind.execute(
            sa.text(
                """
                UPDATE board_memory
                SET chat_session_id = :chat_session_id
                WHERE board_id = :board_id
                  AND is_chat = true
                  AND chat_session_id IS NULL
                """,
            ),
            {
                "chat_session_id": chat_session_id,
                "board_id": board_id,
            },
        )


def downgrade() -> None:
    op.drop_index(
        "ix_board_memory_board_id_is_chat_chat_session_created_at",
        table_name="board_memory",
    )
    op.drop_constraint(
        "fk_board_memory_chat_session_id",
        "board_memory",
        type_="foreignkey",
    )
    op.drop_index("ix_board_memory_chat_session_id", table_name="board_memory")
    op.drop_column("board_memory", "chat_session_id")

    op.drop_index("ix_board_chat_sessions_archived_at", table_name="board_chat_sessions")
    op.drop_index(
        "ix_board_chat_sessions_board_id_archived_at_updated_at",
        table_name="board_chat_sessions",
    )
    op.drop_table("board_chat_sessions")
