"""Database engine, session factory, and startup migration helpers."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from time import perf_counter
from typing import TYPE_CHECKING

from alembic import command
from alembic.config import Config
from redis.asyncio import Redis
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from app import models as _models
from app.core.config import settings
from app.core.logging import get_logger

if TYPE_CHECKING:
    from collections.abc import AsyncGenerator

# Import model modules so SQLModel metadata is fully registered at startup.
_MODEL_REGISTRY = _models


def _normalize_database_url(database_url: str) -> str:
    if "://" not in database_url:
        return database_url
    scheme, rest = database_url.split("://", 1)
    if scheme == "postgresql":
        return f"postgresql+psycopg://{rest}"
    return database_url


async_engine: AsyncEngine = create_async_engine(
    _normalize_database_url(settings.database_url),
    pool_pre_ping=True,
)
async_session_maker = async_sessionmaker(
    async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)
logger = get_logger(__name__)


def _alembic_config() -> Config:
    alembic_ini = Path(__file__).resolve().parents[2] / "alembic.ini"

    alembic_cfg = Config(str(alembic_ini))
    alembic_cfg.attributes["configure_logger"] = False
    return alembic_cfg


def run_migrations() -> None:
    """Apply Alembic migrations to the latest revision."""
    logger.info("Running database migrations.")
    command.upgrade(_alembic_config(), "head")
    logger.info("Database migrations complete.")


async def init_db() -> None:
    """Initialize database schema, running migrations when configured."""
    if settings.db_auto_migrate:
        versions_dir = Path(__file__).resolve().parents[2] / "migrations" / "versions"
        if any(versions_dir.glob("*.py")):
            logger.info("Running migrations on startup")
            await asyncio.to_thread(run_migrations)
            return
        logger.warning("No migration revisions found; falling back to create_all")

    async with async_engine.connect() as conn, conn.begin():
        await conn.run_sync(SQLModel.metadata.create_all)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Yield a request-scoped async DB session with safe rollback on errors."""
    async with async_session_maker() as session:
        try:
            yield session
        finally:
            in_txn = False
            try:
                in_txn = bool(session.in_transaction())
            except SQLAlchemyError:
                logger.exception("Failed to inspect session transaction state.")
            if in_txn:
                try:
                    await session.rollback()
                except SQLAlchemyError:
                    logger.exception("Failed to rollback session after request error.")


@dataclass(frozen=True)
class ReadinessComponentCheck:
    """Internal readiness check result for one dependency."""

    component: str
    ok: bool
    required: bool
    latency_ms: int | None = None
    detail: str | None = None


def _elapsed_ms(started_at: float) -> int:
    return int((perf_counter() - started_at) * 1000)


async def _close_redis_client(client: Redis) -> None:
    maybe_aclose = getattr(client, "aclose", None)
    if callable(maybe_aclose):
        await maybe_aclose()
        return
    await client.close()


def _parse_heartbeat_unix_timestamp(raw: str) -> float:
    value = raw.strip()
    if not value:
        raise ValueError("worker heartbeat value is empty")
    try:
        return float(value)
    except ValueError:
        return datetime.fromisoformat(value).timestamp()


async def check_database_readiness() -> ReadinessComponentCheck:
    """Verify the DB can execute a low-overhead query within timeout."""
    timeout = float(settings.readiness_check_timeout_seconds)
    started_at = perf_counter()
    try:
        async with asyncio.timeout(timeout):
            async with async_engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
    except TimeoutError:
        return ReadinessComponentCheck(
            component="database",
            ok=False,
            required=True,
            latency_ms=_elapsed_ms(started_at),
            detail=f"timeout>{timeout}s",
        )
    except Exception as exc:
        return ReadinessComponentCheck(
            component="database",
            ok=False,
            required=True,
            latency_ms=_elapsed_ms(started_at),
            detail=str(exc),
        )
    return ReadinessComponentCheck(
        component="database",
        ok=True,
        required=True,
        latency_ms=_elapsed_ms(started_at),
        detail="query_ok",
    )


async def check_redis_readiness() -> ReadinessComponentCheck:
    """Verify Redis responds to ping within timeout."""
    timeout = float(settings.readiness_check_timeout_seconds)
    started_at = perf_counter()
    client = Redis.from_url(settings.rq_redis_url)
    try:
        async with asyncio.timeout(timeout):
            pong = await client.ping()
    except TimeoutError:
        return ReadinessComponentCheck(
            component="redis",
            ok=False,
            required=True,
            latency_ms=_elapsed_ms(started_at),
            detail=f"timeout>{timeout}s",
        )
    except Exception as exc:
        return ReadinessComponentCheck(
            component="redis",
            ok=False,
            required=True,
            latency_ms=_elapsed_ms(started_at),
            detail=str(exc),
        )
    finally:
        try:
            await _close_redis_client(client)
        except Exception:
            logger.debug("Failed to close Redis client after readiness check.", exc_info=True)
    if not bool(pong):
        return ReadinessComponentCheck(
            component="redis",
            ok=False,
            required=True,
            latency_ms=_elapsed_ms(started_at),
            detail="ping returned falsey result",
        )
    return ReadinessComponentCheck(
        component="redis",
        ok=True,
        required=True,
        latency_ms=_elapsed_ms(started_at),
        detail="pong",
    )


async def check_worker_liveness_signal() -> ReadinessComponentCheck:
    """Optionally validate worker heartbeat freshness from Redis."""
    heartbeat_key = settings.readiness_worker_heartbeat_key or settings.worker_heartbeat_key
    if not heartbeat_key:
        return ReadinessComponentCheck(
            component="worker",
            ok=True,
            required=False,
            detail="heartbeat key not configured",
        )

    timeout = float(settings.readiness_check_timeout_seconds)
    started_at = perf_counter()
    client = Redis.from_url(settings.rq_redis_url, decode_responses=True)
    try:
        async with asyncio.timeout(timeout):
            raw = await client.get(heartbeat_key)
    except TimeoutError:
        return ReadinessComponentCheck(
            component="worker",
            ok=False,
            required=False,
            latency_ms=_elapsed_ms(started_at),
            detail=f"timeout>{timeout}s",
        )
    except Exception as exc:
        return ReadinessComponentCheck(
            component="worker",
            ok=False,
            required=False,
            latency_ms=_elapsed_ms(started_at),
            detail=str(exc),
        )
    finally:
        try:
            await _close_redis_client(client)
        except Exception:
            logger.debug("Failed to close Redis client after worker liveness check.", exc_info=True)

    if raw is None:
        return ReadinessComponentCheck(
            component="worker",
            ok=False,
            required=False,
            latency_ms=_elapsed_ms(started_at),
            detail="heartbeat key missing",
        )
    try:
        heartbeat_ts = _parse_heartbeat_unix_timestamp(raw)
    except ValueError as exc:
        return ReadinessComponentCheck(
            component="worker",
            ok=False,
            required=False,
            latency_ms=_elapsed_ms(started_at),
            detail=f"invalid heartbeat value: {exc}",
        )

    age_seconds = max(0.0, datetime.now(UTC).timestamp() - heartbeat_ts)
    threshold = float(settings.readiness_worker_heartbeat_max_age_seconds)
    if age_seconds > threshold:
        return ReadinessComponentCheck(
            component="worker",
            ok=False,
            required=False,
            latency_ms=_elapsed_ms(started_at),
            detail=f"stale heartbeat age={age_seconds:.1f}s threshold={threshold:.1f}s",
        )
    return ReadinessComponentCheck(
        component="worker",
        ok=True,
        required=False,
        latency_ms=_elapsed_ms(started_at),
        detail=f"age={age_seconds:.1f}s",
    )


async def evaluate_readiness() -> tuple[bool, list[ReadinessComponentCheck], datetime]:
    """Run dependency checks and return overall readiness and component details."""
    db_status, redis_status, worker_status = await asyncio.gather(
        check_database_readiness(),
        check_redis_readiness(),
        check_worker_liveness_signal(),
    )
    checks = [db_status, redis_status, worker_status]
    ready = all(check.ok for check in checks if check.required)
    return ready, checks, datetime.now(UTC)
