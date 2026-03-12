"""Add task-group planning overlay model and additive task columns.

Revision ID: b9d4e7f1a2c3
Revises: f1a2b3c4d5e6
Create Date: 2026-03-11 23:40:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "b9d4e7f1a2c3"
down_revision = "f1a2b3c4d5e6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create task_groups and add optional overlay fields to tasks."""
    op.create_table(
        "task_groups",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=True),
        sa.Column("board_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("rank", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("collapsed_default", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["board_id"], ["boards.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_task_groups_organization_id",
        "task_groups",
        ["organization_id"],
    )
    op.create_index(
        "ix_task_groups_board_id",
        "task_groups",
        ["board_id"],
    )
    op.create_index(
        "ix_task_groups_rank",
        "task_groups",
        ["rank"],
    )

    op.add_column("tasks", sa.Column("task_group_id", sa.Uuid(), nullable=True))
    op.add_column("tasks", sa.Column("sort_index", sa.Integer(), nullable=True))
    op.add_column("tasks", sa.Column("archived_at", sa.DateTime(), nullable=True))
    op.create_foreign_key(
        "fk_tasks_task_group_id",
        "tasks",
        "task_groups",
        ["task_group_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_tasks_task_group_id", "tasks", ["task_group_id"])
    op.create_index("ix_tasks_sort_index", "tasks", ["sort_index"])
    op.create_index("ix_tasks_archived_at", "tasks", ["archived_at"])
    op.create_index(
        "ix_tasks_board_id_archived_at_created_at_id",
        "tasks",
        ["board_id", "archived_at", "created_at", "id"],
    )
    op.create_index(
        "ix_tasks_board_id_task_group_id_created_at",
        "tasks",
        ["board_id", "task_group_id", "created_at"],
    )


def downgrade() -> None:
    """Remove task-group overlay table and additive task columns."""
    op.drop_index("ix_tasks_board_id_task_group_id_created_at", table_name="tasks")
    op.drop_index("ix_tasks_board_id_archived_at_created_at_id", table_name="tasks")
    op.drop_index("ix_tasks_archived_at", table_name="tasks")
    op.drop_index("ix_tasks_sort_index", table_name="tasks")
    op.drop_index("ix_tasks_task_group_id", table_name="tasks")
    op.drop_constraint("fk_tasks_task_group_id", "tasks", type_="foreignkey")
    op.drop_column("tasks", "archived_at")
    op.drop_column("tasks", "sort_index")
    op.drop_column("tasks", "task_group_id")

    op.drop_index("ix_task_groups_rank", table_name="task_groups")
    op.drop_index("ix_task_groups_board_id", table_name="task_groups")
    op.drop_index("ix_task_groups_organization_id", table_name="task_groups")
    op.drop_table("task_groups")
