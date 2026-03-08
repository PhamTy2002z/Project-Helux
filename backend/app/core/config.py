"""Application settings and environment configuration loading."""

from __future__ import annotations

from pathlib import Path
from typing import Self
from urllib.parse import urlparse

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.core.auth_mode import AuthMode
from app.core.auth_profile import AuthProfile

BACKEND_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_ENV_FILE = BACKEND_ROOT / ".env"
LOCAL_AUTH_TOKEN_MIN_LENGTH = 50
LOCAL_AUTH_TOKEN_PLACEHOLDERS = frozenset(
    {
        "change-me",
        "changeme",
        "replace-me",
        "replace-with-strong-random-token",
    },
)


class Settings(BaseSettings):
    """Typed runtime configuration sourced from environment variables."""

    model_config = SettingsConfigDict(
        # Load `backend/.env` regardless of current working directory.
        # (Important when running uvicorn from repo root or via a process manager.)
        env_file=[DEFAULT_ENV_FILE, ".env"],
        env_file_encoding="utf-8",
        extra="ignore",
    )

    environment: str = "dev"
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/openclaw_agency"

    # Auth profile controls auth strictness by deployment type.
    auth_profile: AuthProfile = AuthProfile.DEV

    # Auth mode: "clerk" for Clerk JWT auth, "local" for shared bearer token auth.
    auth_mode: AuthMode
    local_auth_token: str = ""

    # Clerk auth (auth only; roles stored in DB)
    clerk_secret_key: str = ""
    clerk_api_url: str = "https://api.clerk.com"
    clerk_verify_iat: bool = True
    clerk_leeway: float = 10.0

    cors_origins: str = ""
    base_url: str
    # Security response headers (blank disables header injection)
    security_header_x_content_type_options: str = ""
    security_header_x_frame_options: str = ""
    security_header_referrer_policy: str = ""
    security_header_permissions_policy: str = ""

    # Database lifecycle
    db_auto_migrate: bool = False

    # RQ queueing / dispatch
    rq_redis_url: str = "redis://localhost:6379/0"
    rq_queue_name: str = "default"
    rq_dispatch_throttle_seconds: float = 15.0
    rq_dispatch_max_retries: int = 3
    rq_dispatch_retry_base_seconds: float = 10.0
    rq_dispatch_retry_max_seconds: float = 120.0
    worker_heartbeat_key: str = ""
    worker_heartbeat_ttl_seconds: int = Field(default=300, ge=5)

    # Readiness checks
    readiness_check_timeout_seconds: float = Field(default=1.5, gt=0)
    readiness_worker_heartbeat_key: str = ""
    readiness_worker_heartbeat_max_age_seconds: int = Field(default=120, ge=1)

    # OpenClaw gateway runtime compatibility
    gateway_min_version: str = "2026.02.9"

    # Logging
    log_level: str = "INFO"
    log_format: str = "text"
    log_use_utc: bool = False
    request_log_slow_ms: int = Field(default=1000, ge=0)
    request_log_include_health: bool = False

    # API rate limiting
    rate_limit_enabled: bool = True
    rate_limit_prefix: str = "api-rl"
    rate_limit_ip_limit_per_minute: int = Field(default=240, ge=1)
    rate_limit_actor_limit_per_minute: int = Field(default=480, ge=1)

    @model_validator(mode="after")
    def _defaults(self) -> Self:
        if self.auth_profile == AuthProfile.SAAS and self.auth_mode != AuthMode.CLERK:
            raise ValueError("AUTH_PROFILE=saas requires AUTH_MODE=clerk.")
        if self.auth_mode == AuthMode.CLERK:
            if not self.clerk_secret_key.strip():
                raise ValueError(
                    "CLERK_SECRET_KEY must be set and non-empty when AUTH_MODE=clerk.",
                )
        elif self.auth_mode == AuthMode.LOCAL:
            token = self.local_auth_token.strip()
            if (
                not token
                or len(token) < LOCAL_AUTH_TOKEN_MIN_LENGTH
                or token.lower() in LOCAL_AUTH_TOKEN_PLACEHOLDERS
            ):
                raise ValueError(
                    "LOCAL_AUTH_TOKEN must be at least 50 characters and non-placeholder when AUTH_MODE=local.",
                )
        base_url = self.base_url.strip()
        if not base_url:
            raise ValueError("BASE_URL must be set and non-empty.")
        parsed_base_url = urlparse(base_url)
        if parsed_base_url.scheme not in {"http", "https"} or not parsed_base_url.netloc:
            raise ValueError(
                "BASE_URL must be an absolute http(s) URL (e.g. http://localhost:8000).",
            )
        self.base_url = base_url.rstrip("/")
        # In dev, default to applying Alembic migrations at startup to avoid
        # schema drift (e.g. missing newly-added columns).
        if "db_auto_migrate" not in self.model_fields_set and self.environment == "dev":
            self.db_auto_migrate = True
        self.worker_heartbeat_key = self.worker_heartbeat_key.strip()
        self.readiness_worker_heartbeat_key = self.readiness_worker_heartbeat_key.strip()
        return self


settings = Settings()
