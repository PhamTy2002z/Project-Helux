"""Add task review SLA tracking fields on boards/tasks.

Revision ID: d9e8f7a6b5c4
Revises: c3d4e5f6a7b8
Create Date: 2026-03-21 22:30:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "d9e8f7a6b5c4"
down_revision = "c3d4e5f6a7b8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add board-level review SLA and task-level review tracking columns."""
    op.add_column(
        "boards",
        sa.Column(
            "review_sla_minutes",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("20"),
        ),
    )
    op.alter_column("boards", "review_sla_minutes", server_default=None)

    op.add_column("tasks", sa.Column("owner_agent_id", sa.Uuid(), nullable=True))
    op.add_column("tasks", sa.Column("reviewer_agent_id", sa.Uuid(), nullable=True))
    op.add_column("tasks", sa.Column("review_entered_at", sa.DateTime(), nullable=True))
    op.add_column("tasks", sa.Column("review_due_at", sa.DateTime(), nullable=True))
    op.add_column(
        "tasks",
        sa.Column(
            "review_overdue_count",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
    )
    op.alter_column("tasks", "review_overdue_count", server_default=None)
    op.add_column("tasks", sa.Column("last_nudged_at", sa.DateTime(), nullable=True))

    op.create_foreign_key(
        "fk_tasks_owner_agent_id_agents",
        "tasks",
        "agents",
        ["owner_agent_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_tasks_reviewer_agent_id_agents",
        "tasks",
        "agents",
        ["reviewer_agent_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_tasks_owner_agent_id", "tasks", ["owner_agent_id"], unique=False)
    op.create_index("ix_tasks_reviewer_agent_id", "tasks", ["reviewer_agent_id"], unique=False)
    op.create_index("ix_tasks_review_entered_at", "tasks", ["review_entered_at"], unique=False)
    op.create_index("ix_tasks_review_due_at", "tasks", ["review_due_at"], unique=False)
    op.create_index("ix_tasks_status_review_due_at", "tasks", ["status", "review_due_at"], unique=False)


def downgrade() -> None:
    """Remove board/task review SLA tracking columns and indexes."""
    op.drop_index("ix_tasks_status_review_due_at", table_name="tasks")
    op.drop_index("ix_tasks_review_due_at", table_name="tasks")
    op.drop_index("ix_tasks_review_entered_at", table_name="tasks")
    op.drop_index("ix_tasks_reviewer_agent_id", table_name="tasks")
    op.drop_index("ix_tasks_owner_agent_id", table_name="tasks")
    op.drop_constraint("fk_tasks_reviewer_agent_id_agents", "tasks", type_="foreignkey")
    op.drop_constraint("fk_tasks_owner_agent_id_agents", "tasks", type_="foreignkey")
    op.drop_column("tasks", "last_nudged_at")
    op.drop_column("tasks", "review_overdue_count")
    op.drop_column("tasks", "review_due_at")
    op.drop_column("tasks", "review_entered_at")
    op.drop_column("tasks", "reviewer_agent_id")
    op.drop_column("tasks", "owner_agent_id")

    op.drop_column("boards", "review_sla_minutes")
