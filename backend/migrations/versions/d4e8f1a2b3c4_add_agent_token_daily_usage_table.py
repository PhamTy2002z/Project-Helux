"""add agent token daily usage table

Revision ID: d4e8f1a2b3c4
Revises: cc33dd44ee55
Create Date: 2026-03-09 22:10:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "d4e8f1a2b3c4"
down_revision = "cc33dd44ee55"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "agent_token_daily_usage",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("agent_id", sa.Uuid(), nullable=False),
        sa.Column("usage_date_vn", sa.Date(), nullable=False),
        sa.Column("openclaw_tokens_total", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("billed_tokens_used", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("blocked_at", sa.DateTime(), nullable=True),
        sa.Column("last_synced_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["agent_id"], ["agents.id"]),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "agent_id",
            "usage_date_vn",
            name="uq_agent_token_daily_usage_agent_id_usage_date_vn",
        ),
    )
    op.create_index(
        op.f("ix_agent_token_daily_usage_organization_id"),
        "agent_token_daily_usage",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_agent_token_daily_usage_agent_id"),
        "agent_token_daily_usage",
        ["agent_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_agent_token_daily_usage_usage_date_vn"),
        "agent_token_daily_usage",
        ["usage_date_vn"],
        unique=False,
    )
    op.create_index(
        "ix_agent_token_daily_usage_organization_id_usage_date_vn",
        "agent_token_daily_usage",
        ["organization_id", "usage_date_vn"],
        unique=False,
    )
    op.create_index(
        "ix_agent_token_daily_usage_org_agent_date_vn",
        "agent_token_daily_usage",
        ["organization_id", "agent_id", "usage_date_vn"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_agent_token_daily_usage_org_agent_date_vn",
        table_name="agent_token_daily_usage",
    )
    op.drop_index(
        "ix_agent_token_daily_usage_organization_id_usage_date_vn",
        table_name="agent_token_daily_usage",
    )
    op.drop_index(
        op.f("ix_agent_token_daily_usage_usage_date_vn"),
        table_name="agent_token_daily_usage",
    )
    op.drop_index(
        op.f("ix_agent_token_daily_usage_agent_id"),
        table_name="agent_token_daily_usage",
    )
    op.drop_index(
        op.f("ix_agent_token_daily_usage_organization_id"),
        table_name="agent_token_daily_usage",
    )
    op.drop_table("agent_token_daily_usage")

