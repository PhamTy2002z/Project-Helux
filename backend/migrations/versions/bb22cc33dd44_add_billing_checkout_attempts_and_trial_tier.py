"""Add billing checkout attempts and migrate plans to trial_7d/pro tiers.

Revision ID: bb22cc33dd44
Revises: aa11bb22cc33
Create Date: 2026-03-08 21:45:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "bb22cc33dd44"
down_revision = "aa11bb22cc33"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "billing_checkout_attempts",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("idempotency_key", sa.String(length=128), nullable=False),
        sa.Column("requested_plan_tier", sa.String(), nullable=False),
        sa.Column("resolved_plan_tier", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="succeeded"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "organization_id",
            "idempotency_key",
            name="uq_billing_checkout_attempts_org_idempotency",
        ),
    )
    op.create_index(
        op.f("ix_billing_checkout_attempts_organization_id"),
        "billing_checkout_attempts",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_billing_checkout_attempts_idempotency_key"),
        "billing_checkout_attempts",
        ["idempotency_key"],
        unique=False,
    )
    op.create_index(
        op.f("ix_billing_checkout_attempts_requested_plan_tier"),
        "billing_checkout_attempts",
        ["requested_plan_tier"],
        unique=False,
    )
    op.create_index(
        op.f("ix_billing_checkout_attempts_resolved_plan_tier"),
        "billing_checkout_attempts",
        ["resolved_plan_tier"],
        unique=False,
    )

    op.execute("UPDATE organization_plans SET tier='trial_7d' WHERE tier IN ('free', 'beta')")
    op.execute(
        "UPDATE organization_plans "
        "SET effective_until = COALESCE(effective_until, effective_from + INTERVAL '7 days') "
        "WHERE tier='trial_7d'"
    )


def downgrade() -> None:
    op.execute("UPDATE organization_plans SET tier='free' WHERE tier='trial_7d'")
    op.drop_index(
        op.f("ix_billing_checkout_attempts_resolved_plan_tier"),
        table_name="billing_checkout_attempts",
    )
    op.drop_index(
        op.f("ix_billing_checkout_attempts_requested_plan_tier"),
        table_name="billing_checkout_attempts",
    )
    op.drop_index(
        op.f("ix_billing_checkout_attempts_idempotency_key"),
        table_name="billing_checkout_attempts",
    )
    op.drop_index(
        op.f("ix_billing_checkout_attempts_organization_id"),
        table_name="billing_checkout_attempts",
    )
    op.drop_table("billing_checkout_attempts")
