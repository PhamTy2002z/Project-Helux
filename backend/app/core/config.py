"""Application settings and environment configuration loading."""

from __future__ import annotations

from pathlib import Path
from typing import Self
from urllib.parse import urlparse
from uuid import UUID

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
BILLING_MODES = frozenset({"simulated", "provider"})
PAYMENT_PROVIDERS = frozenset({"none", "stripe", "paddle", "polar"})
EMAIL_PROVIDERS = frozenset({"none", "resend"})
OPENCLAW_USAGE_ENFORCEMENT_MODES = frozenset({"observe", "enforce"})


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
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/mission_control"

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
    clerk_webhook_secret: str = ""

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
    gateway_rpc_connect_timeout_seconds: float = Field(default=10.0, gt=0)
    gateway_rpc_response_timeout_seconds: float = Field(default=20.0, gt=0)
    openclaw_usage_enforcement_mode: str = "observe"
    openclaw_usage_capability_ttl_seconds: int = Field(default=300, ge=0)
    openclaw_usage_utc_offset: str = "UTC+7"
    openclaw_usage_day_timezone: str = "Asia/Ho_Chi_Minh"
    gateway_lifecycle_timeout_seconds: float = Field(default=90.0, gt=0)
    managed_gateway_auto_provision: bool = True
    managed_gateway_name: str = "Managed Gateway"
    managed_gateway_url: str = "ws://127.0.0.1:18789/ws"
    managed_gateway_token: str = ""
    managed_gateway_workspace_root: str = "~/.openclaw/managed"
    managed_gateway_disable_device_pairing: bool = False
    managed_gateway_allow_insecure_tls: bool = False

    # Board planning overlay rollout controls
    board_planning_overlay_v1: bool = False
    board_planning_overlay_v1_canary_board_ids: str = ""
    board_planning_overlay_v1_canary_org_ids: str = ""
    board_query_v2: bool = False
    board_query_v2_canary_board_ids: str = ""
    board_query_v2_canary_org_ids: str = ""

    # Object storage (MinIO / S3-compatible)
    object_storage_endpoint: str = "http://localhost:9000"
    object_storage_access_key: str = "minioadmin"
    object_storage_secret_key: str = "minioadmin"
    object_storage_bucket: str = "board-chat-files"
    object_storage_use_ssl: bool = False

    # Board chat file upload limits
    board_chat_file_max_bytes: int = Field(default=10_485_760, ge=1)  # 10 MB
    board_chat_file_max_per_message: int = Field(default=3, ge=1)
    board_chat_file_preview_max_chars: int = Field(default=500, ge=0)
    board_chat_file_allowed_types: str = "txt,md,csv,json,pdf"
    board_chat_file_pdf_ocr_enabled: bool = True
    board_chat_file_pdf_ocr_lang: str = "eng+vie"
    board_chat_file_pdf_ocr_max_pages: int = Field(default=12, ge=1)
    board_chat_file_pdf_ocr_render_scale: float = Field(default=2.0, gt=0)

    # Board chat file report SLA / retry policy
    board_chat_file_report_timeout_seconds: int = Field(default=300, ge=10)
    board_chat_file_report_max_retries: int = Field(default=2, ge=0)
    board_chat_file_report_retry_backoff_seconds: str = "30,120"

    # Shared knowledge publication
    board_chat_file_publish_group_memory: bool = False

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
    billing_mode: str = "simulated"
    payment_provider: str = "none"

    # Polar payment provider (only required when PAYMENT_PROVIDER=polar)
    polar_access_token: str = ""
    polar_webhook_secret: str = ""
    polar_product_id_pro: str = ""
    polar_environment: str = "sandbox"
    polar_success_url: str = ""

    # Email provider (organization invite delivery)
    email_provider: str = "none"
    resend_api_key: str = ""
    resend_webhook_secret: str = ""
    email_from_invites: str = ""
    email_reply_to: str = ""
    invite_accept_base_url: str = ""

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
        self.managed_gateway_name = self.managed_gateway_name.strip() or "Managed Gateway"
        self.managed_gateway_url = self.managed_gateway_url.strip()
        self.managed_gateway_token = self.managed_gateway_token.strip()
        self.managed_gateway_workspace_root = self.managed_gateway_workspace_root.strip()
        self.board_planning_overlay_v1_canary_board_ids = (
            self.board_planning_overlay_v1_canary_board_ids.strip()
        )
        self.board_planning_overlay_v1_canary_org_ids = (
            self.board_planning_overlay_v1_canary_org_ids.strip()
        )
        self.board_query_v2_canary_board_ids = self.board_query_v2_canary_board_ids.strip()
        self.board_query_v2_canary_org_ids = self.board_query_v2_canary_org_ids.strip()
        self.billing_mode = self.billing_mode.strip().lower()
        if self.billing_mode not in BILLING_MODES:
            raise ValueError("BILLING_MODE must be one of: simulated, provider.")
        self.payment_provider = self.payment_provider.strip().lower()
        if self.payment_provider not in PAYMENT_PROVIDERS:
            raise ValueError("PAYMENT_PROVIDER must be one of: none, stripe, paddle, polar.")
        if self.payment_provider == "polar":
            if not self.polar_access_token.strip():
                raise ValueError("POLAR_ACCESS_TOKEN required when PAYMENT_PROVIDER=polar.")
            if not self.polar_webhook_secret.strip():
                raise ValueError("POLAR_WEBHOOK_SECRET required when PAYMENT_PROVIDER=polar.")
            if not self.polar_product_id_pro.strip():
                raise ValueError("POLAR_PRODUCT_ID_PRO required when PAYMENT_PROVIDER=polar.")
            if self.polar_environment not in ("sandbox", "production"):
                raise ValueError("POLAR_ENVIRONMENT must be 'sandbox' or 'production'.")
        self.email_provider = self.email_provider.strip().lower()
        if self.email_provider not in EMAIL_PROVIDERS:
            raise ValueError("EMAIL_PROVIDER must be one of: none, resend.")
        self.email_from_invites = self.email_from_invites.strip()
        self.email_reply_to = self.email_reply_to.strip()
        self.invite_accept_base_url = self.invite_accept_base_url.strip()
        if self.email_provider == "resend":
            if not self.resend_api_key.strip():
                raise ValueError("RESEND_API_KEY required when EMAIL_PROVIDER=resend.")
            if not self.email_from_invites:
                raise ValueError("EMAIL_FROM_INVITES required when EMAIL_PROVIDER=resend.")
            if not self.invite_accept_base_url:
                raise ValueError("INVITE_ACCEPT_BASE_URL required when EMAIL_PROVIDER=resend.")
        if self.invite_accept_base_url:
            parsed_invite_url = urlparse(self.invite_accept_base_url)
            if parsed_invite_url.scheme not in {"http", "https"} or not parsed_invite_url.netloc:
                raise ValueError(
                    "INVITE_ACCEPT_BASE_URL must be an absolute http(s) URL.",
                )
            self.invite_accept_base_url = self.invite_accept_base_url.rstrip("/")
        self.openclaw_usage_enforcement_mode = self.openclaw_usage_enforcement_mode.strip().lower()
        if self.openclaw_usage_enforcement_mode not in OPENCLAW_USAGE_ENFORCEMENT_MODES:
            raise ValueError("OPENCLAW_USAGE_ENFORCEMENT_MODE must be one of: observe, enforce.")
        self.openclaw_usage_utc_offset = self.openclaw_usage_utc_offset.strip() or "UTC+7"
        self.openclaw_usage_day_timezone = (
            self.openclaw_usage_day_timezone.strip() or "Asia/Ho_Chi_Minh"
        )
        return self

    @staticmethod
    def _uuid_csv_set(raw: str) -> set[UUID]:
        values: set[UUID] = set()
        for item in raw.split(","):
            normalized = item.strip()
            if not normalized:
                continue
            try:
                values.add(UUID(normalized))
            except ValueError:
                continue
        return values

    def board_planning_overlay_enabled_for(
        self,
        *,
        board_id: UUID | None,
        organization_id: UUID | None,
    ) -> bool:
        if self.board_planning_overlay_v1:
            return True
        canary_board_ids = self._uuid_csv_set(self.board_planning_overlay_v1_canary_board_ids)
        canary_org_ids = self._uuid_csv_set(self.board_planning_overlay_v1_canary_org_ids)
        return bool(
            (board_id is not None and board_id in canary_board_ids)
            or (organization_id is not None and organization_id in canary_org_ids)
        )

    def board_query_v2_enabled_for(
        self,
        *,
        board_id: UUID | None,
        organization_id: UUID | None,
    ) -> bool:
        if self.board_query_v2:
            return True
        canary_board_ids = self._uuid_csv_set(self.board_query_v2_canary_board_ids)
        canary_org_ids = self._uuid_csv_set(self.board_query_v2_canary_org_ids)
        return bool(
            (board_id is not None and board_id in canary_board_ids)
            or (organization_id is not None and organization_id in canary_org_ids)
        )


settings = Settings()
