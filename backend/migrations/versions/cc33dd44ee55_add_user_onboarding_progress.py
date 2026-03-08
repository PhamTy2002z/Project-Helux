"""Add user onboarding progress table.

Revision ID: cc33dd44ee55
Revises: bb22cc33dd44
Create Date: 2026-03-08 22:10:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "cc33dd44ee55"
down_revision = "bb22cc33dd44"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_onboarding_progress",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("steps", sa.JSON(), nullable=False),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "organization_id",
            "user_id",
            name="uq_user_onboarding_progress_org_user",
        ),
    )
    op.create_index(
        op.f("ix_user_onboarding_progress_organization_id"),
        "user_onboarding_progress",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_user_onboarding_progress_user_id"),
        "user_onboarding_progress",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_user_onboarding_progress_user_id"),
        table_name="user_onboarding_progress",
    )
    op.drop_index(
        op.f("ix_user_onboarding_progress_organization_id"),
        table_name="user_onboarding_progress",
    )
    op.drop_table("user_onboarding_progress")
