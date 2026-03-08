"""Add gateway activation lifecycle columns.

Revision ID: aa11bb22cc33
Revises: 99cd6df95f85, f9a1b2c3d4e5, b4338be78eec
Create Date: 2026-03-08 15:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "aa11bb22cc33"
down_revision = ("99cd6df95f85", "f9a1b2c3d4e5", "b4338be78eec")
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "gateways",
        sa.Column(
            "activation_status",
            sa.String(),
            nullable=False,
            server_default="ready",
        ),
    )
    op.add_column(
        "gateways",
        sa.Column(
            "activation_error",
            sa.String(),
            nullable=True,
        ),
    )
    op.add_column(
        "gateways",
        sa.Column(
            "activation_attempts",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "gateways",
        sa.Column(
            "last_activation_at",
            sa.DateTime(),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("gateways", "last_activation_at")
    op.drop_column("gateways", "activation_attempts")
    op.drop_column("gateways", "activation_error")
    op.drop_column("gateways", "activation_status")
