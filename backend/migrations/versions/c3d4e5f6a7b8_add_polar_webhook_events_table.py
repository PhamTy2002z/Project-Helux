"""Add polar_webhook_events table for store-then-process webhook reliability.

Revision ID: c3d4e5f6a7b8
Revises: a1b2c3d4e5f6
Create Date: 2026-03-17 16:10:00.000000

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "c3d4e5f6a7b8"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "polar_webhook_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("event_type", sa.String(), nullable=False),
        sa.Column("polar_event_id", sa.String(), nullable=True),
        sa.Column("raw_payload", sa.JSON(), nullable=True),
        sa.Column("organization_id", sa.Uuid(), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default="pending"),
        sa.Column("error_message", sa.String(), nullable=True),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("received_at", sa.DateTime(), nullable=False),
        sa.Column("processed_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("polar_event_id", name="uq_polar_webhook_events_polar_event_id"),
    )
    op.create_index("ix_polar_webhook_events_event_type", "polar_webhook_events", ["event_type"])
    op.create_index("ix_polar_webhook_events_polar_event_id", "polar_webhook_events", ["polar_event_id"])
    op.create_index("ix_polar_webhook_events_organization_id", "polar_webhook_events", ["organization_id"])
    op.create_index("ix_polar_webhook_events_status", "polar_webhook_events", ["status"])


def downgrade() -> None:
    op.drop_index("ix_polar_webhook_events_status", table_name="polar_webhook_events")
    op.drop_index("ix_polar_webhook_events_organization_id", table_name="polar_webhook_events")
    op.drop_index("ix_polar_webhook_events_polar_event_id", table_name="polar_webhook_events")
    op.drop_index("ix_polar_webhook_events_event_type", table_name="polar_webhook_events")
    op.drop_table("polar_webhook_events")
