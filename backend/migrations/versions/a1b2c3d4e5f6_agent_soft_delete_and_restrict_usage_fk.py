"""agent soft delete and restrict usage fk

Revision ID: a1b2c3d4e5f6
Revises: 95fef896018c
Create Date: 2026-03-15 13:56:00.000000

"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "a1b2c3d4e5f6"
down_revision = "95fef896018c"
branch_labels = None
depends_on = None

USAGE_FK = "agent_token_daily_usage_agent_id_fkey"
USAGE_TABLE = "agent_token_daily_usage"


def upgrade() -> None:
    # 1. Add deleted_at column to agents for soft-delete support.
    op.add_column("agents", sa.Column("deleted_at", sa.DateTime(), nullable=True))
    op.create_index("ix_agents_deleted_at", "agents", ["deleted_at"])

    # 2. Change usage FK from CASCADE to RESTRICT to prevent billing data loss.
    op.drop_constraint(USAGE_FK, USAGE_TABLE, type_="foreignkey")
    op.create_foreign_key(USAGE_FK, USAGE_TABLE, "agents", ["agent_id"], ["id"], ondelete="RESTRICT")


def downgrade() -> None:
    # Revert FK to CASCADE.
    op.drop_constraint(USAGE_FK, USAGE_TABLE, type_="foreignkey")
    op.create_foreign_key(USAGE_FK, USAGE_TABLE, "agents", ["agent_id"], ["id"], ondelete="CASCADE")

    # Drop soft-delete column.
    op.drop_index("ix_agents_deleted_at", "agents")
    op.drop_column("agents", "deleted_at")
