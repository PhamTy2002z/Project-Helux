"""enforce org keys and add organization plans

Revision ID: e6f7a8b9c0d1
Revises: d1a3f2b4c5d6
Create Date: 2026-03-08 12:30:00.000000

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision = "e6f7a8b9c0d1"
down_revision = "d1a3f2b4c5d6"
branch_labels = None
depends_on = None


def _fk_names(inspector: sa.Inspector, table_name: str) -> set[str]:
    return {
        fk["name"]
        for fk in inspector.get_foreign_keys(table_name)
        if isinstance(fk.get("name"), str)
    }


def _table_names(inspector: sa.Inspector) -> set[str]:
    return set(inspector.get_table_names())


def _null_count(table_name: str) -> int:
    bind = op.get_bind()
    result = bind.execute(sa.text(f"SELECT COUNT(*) FROM {table_name} WHERE organization_id IS NULL"))
    value = result.scalar()
    return int(value or 0)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "organization_plans" not in _table_names(inspector):
        op.create_table(
            "organization_plans",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("organization_id", sa.Uuid(), nullable=False),
            sa.Column("tier", sa.String(), nullable=False),
            sa.Column("effective_from", sa.DateTime(), nullable=False),
            sa.Column("effective_until", sa.DateTime(), nullable=True),
            sa.Column("metadata", sa.JSON(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("organization_id", name="uq_organization_plans_organization_id"),
        )
        op.create_index(
            "ix_organization_plans_organization_id",
            "organization_plans",
            ["organization_id"],
            unique=False,
        )
        op.create_index("ix_organization_plans_tier", "organization_plans", ["tier"], unique=False)

    table_to_fk = {
        "tasks": "fk_tasks_organization_id_organizations",
        "agents": "fk_agents_organization_id_organizations",
        "approvals": "fk_approvals_organization_id_organizations",
        "activity_events": "fk_activity_events_organization_id_organizations",
    }
    for table_name, fk_name in table_to_fk.items():
        if table_name not in _table_names(inspector):
            continue
        fks = _fk_names(inspector, table_name)
        if fk_name not in fks:
            op.create_foreign_key(
                fk_name,
                table_name,
                "organizations",
                ["organization_id"],
                ["id"],
                ondelete="CASCADE",
            )

    for table_name in ("tasks", "agents", "approvals"):
        if _null_count(table_name) > 0:
            msg = (
                f"Cannot enforce NOT NULL for {table_name}.organization_id: "
                "backfill left NULL rows."
            )
            raise RuntimeError(msg)
        op.alter_column(table_name, "organization_id", existing_type=sa.Uuid(), nullable=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    for table_name in ("tasks", "agents", "approvals"):
        if table_name in _table_names(inspector):
            op.alter_column(table_name, "organization_id", existing_type=sa.Uuid(), nullable=True)

    table_to_fk = {
        "activity_events": "fk_activity_events_organization_id_organizations",
        "approvals": "fk_approvals_organization_id_organizations",
        "agents": "fk_agents_organization_id_organizations",
        "tasks": "fk_tasks_organization_id_organizations",
    }
    for table_name, fk_name in table_to_fk.items():
        if table_name not in _table_names(inspector):
            continue
        fks = _fk_names(sa.inspect(bind), table_name)
        if fk_name in fks:
            op.drop_constraint(fk_name, table_name, type_="foreignkey")

    if "organization_plans" in _table_names(sa.inspect(bind)):
        op.drop_index("ix_organization_plans_tier", table_name="organization_plans")
        op.drop_index("ix_organization_plans_organization_id", table_name="organization_plans")
        op.drop_table("organization_plans")
