"""add cost columns to agent token daily usage

Revision ID: e5f6a7b8c9d0
Revises: d4e8f1a2b3c4
Create Date: 2026-03-10 21:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "e5f6a7b8c9d0"
down_revision = "d4e8f1a2b3c4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "agent_token_daily_usage",
        sa.Column("openclaw_cost_total", sa.Numeric(12, 6), nullable=False, server_default="0"),
    )
    op.add_column(
        "agent_token_daily_usage",
        sa.Column("cost_used", sa.Numeric(12, 6), nullable=False, server_default="0"),
    )
    op.add_column(
        "agent_token_daily_usage",
        sa.Column("cost_blocked_at", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("agent_token_daily_usage", "cost_blocked_at")
    op.drop_column("agent_token_daily_usage", "cost_used")
    op.drop_column("agent_token_daily_usage", "openclaw_cost_total")
