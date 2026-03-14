"""add workspace_templates table and agents template_id

Revision ID: 8423d43d8fa2
Revises: b9d4e7f1a2c3
Create Date: 2026-03-13 23:19:17.742834

"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '8423d43d8fa2'
down_revision = 'b9d4e7f1a2c3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "workspace_templates",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("slug", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category", sa.String(length=100), nullable=True),
        sa.Column("icon", sa.String(length=50), nullable=True),
        sa.Column("file_contents", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.UniqueConstraint("organization_id", "slug", name="uq_workspace_templates_org_slug"),
    )
    op.create_index("ix_workspace_templates_org_id", "workspace_templates", ["organization_id"])
    op.create_index("ix_workspace_templates_category", "workspace_templates", ["category"])
    op.create_index("ix_workspace_templates_is_system", "workspace_templates", ["is_system"])
    op.create_index("ix_workspace_templates_slug", "workspace_templates", ["slug"])

    op.add_column("agents", sa.Column("template_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "fk_agents_template_id",
        "agents",
        "workspace_templates",
        ["template_id"],
        ["id"],
    )
    op.create_index("ix_agents_template_id", "agents", ["template_id"])


def downgrade() -> None:
    op.drop_index("ix_agents_template_id", table_name="agents")
    op.drop_constraint("fk_agents_template_id", "agents", type_="foreignkey")
    op.drop_column("agents", "template_id")

    op.drop_index("ix_workspace_templates_slug", table_name="workspace_templates")
    op.drop_index("ix_workspace_templates_is_system", table_name="workspace_templates")
    op.drop_index("ix_workspace_templates_category", table_name="workspace_templates")
    op.drop_index("ix_workspace_templates_org_id", table_name="workspace_templates")
    op.drop_table("workspace_templates")
