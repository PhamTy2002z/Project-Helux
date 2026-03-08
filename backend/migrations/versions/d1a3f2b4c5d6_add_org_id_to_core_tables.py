"""add organization_id to core derived tables

Revision ID: d1a3f2b4c5d6
Revises: a9b1c2d3e4f7
Create Date: 2026-03-08 12:20:00.000000

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision = "d1a3f2b4c5d6"
down_revision = "a9b1c2d3e4f7"
branch_labels = None
depends_on = None


def _index_names(inspector: sa.Inspector, table_name: str) -> set[str]:
    return {item["name"] for item in inspector.get_indexes(table_name)}


def _column_names(inspector: sa.Inspector, table_name: str) -> set[str]:
    return {item["name"] for item in inspector.get_columns(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    table_specs: tuple[tuple[str, str], ...] = (
        ("tasks", "ix_tasks_organization_id"),
        ("agents", "ix_agents_organization_id"),
        ("approvals", "ix_approvals_organization_id"),
        ("activity_events", "ix_activity_events_organization_id"),
    )
    for table_name, index_name in table_specs:
        if table_name not in inspector.get_table_names():
            continue
        columns = _column_names(inspector, table_name)
        if "organization_id" not in columns:
            op.add_column(table_name, sa.Column("organization_id", sa.Uuid(), nullable=True))

        inspector = sa.inspect(bind)
        indexes = _index_names(inspector, table_name)
        if index_name not in indexes:
            op.create_index(index_name, table_name, ["organization_id"], unique=False)

    op.execute(
        """
        UPDATE tasks AS t
        SET organization_id = b.organization_id
        FROM boards AS b
        WHERE t.board_id = b.id
          AND t.organization_id IS NULL
        """
    )
    op.execute(
        """
        UPDATE agents AS a
        SET organization_id = g.organization_id
        FROM gateways AS g
        WHERE a.gateway_id = g.id
          AND a.organization_id IS NULL
        """
    )
    op.execute(
        """
        UPDATE approvals AS ap
        SET organization_id = b.organization_id
        FROM boards AS b
        WHERE ap.board_id = b.id
          AND ap.organization_id IS NULL
        """
    )
    op.execute(
        """
        UPDATE activity_events AS ae
        SET organization_id = b.organization_id
        FROM boards AS b
        WHERE ae.board_id = b.id
          AND ae.organization_id IS NULL
        """
    )
    op.execute(
        """
        UPDATE activity_events AS ae
        SET organization_id = t.organization_id
        FROM tasks AS t
        WHERE ae.task_id = t.id
          AND ae.organization_id IS NULL
          AND t.organization_id IS NOT NULL
        """
    )
    op.execute(
        """
        UPDATE activity_events AS ae
        SET organization_id = a.organization_id
        FROM agents AS a
        WHERE ae.agent_id = a.id
          AND ae.organization_id IS NULL
          AND a.organization_id IS NOT NULL
        """
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    table_specs: tuple[tuple[str, str], ...] = (
        ("activity_events", "ix_activity_events_organization_id"),
        ("approvals", "ix_approvals_organization_id"),
        ("agents", "ix_agents_organization_id"),
        ("tasks", "ix_tasks_organization_id"),
    )
    for table_name, index_name in table_specs:
        if table_name not in inspector.get_table_names():
            continue
        indexes = _index_names(inspector, table_name)
        if index_name in indexes:
            op.drop_index(index_name, table_name=table_name)

        columns = _column_names(sa.inspect(bind), table_name)
        if "organization_id" in columns:
            op.drop_column(table_name, "organization_id")
