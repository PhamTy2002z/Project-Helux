"""cascade delete agent_token_daily_usage agent_id fk

Revision ID: 95fef896018c
Revises: 8423d43d8fa2
Create Date: 2026-03-15 05:27:38.274237

"""
from __future__ import annotations

from alembic import op


revision = "95fef896018c"
down_revision = "8423d43d8fa2"
branch_labels = None
depends_on = None

FK_NAME = "agent_token_daily_usage_agent_id_fkey"
TABLE = "agent_token_daily_usage"


def upgrade() -> None:
    op.drop_constraint(FK_NAME, TABLE, type_="foreignkey")
    op.create_foreign_key(FK_NAME, TABLE, "agents", ["agent_id"], ["id"], ondelete="CASCADE")


def downgrade() -> None:
    op.drop_constraint(FK_NAME, TABLE, type_="foreignkey")
    op.create_foreign_key(FK_NAME, TABLE, "agents", ["agent_id"], ["id"])
