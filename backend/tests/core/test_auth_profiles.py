# ruff: noqa: INP001
"""Settings validation tests for auth profile + mode combinations."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.core.auth_mode import AuthMode
from app.core.auth_profile import AuthProfile
from app.core.config import Settings

BASE_URL = "http://localhost:8000"


def test_saas_profile_requires_clerk_mode() -> None:
    with pytest.raises(ValidationError, match="AUTH_PROFILE=saas requires AUTH_MODE=clerk"):
        Settings(
            _env_file=None,
            auth_profile=AuthProfile.SAAS,
            auth_mode=AuthMode.LOCAL,
            local_auth_token="x" * 50,
            base_url=BASE_URL,
        )


def test_saas_profile_accepts_clerk_mode() -> None:
    settings = Settings(
        _env_file=None,
        auth_profile=AuthProfile.SAAS,
        auth_mode=AuthMode.CLERK,
        clerk_secret_key="sk_test_123",
        base_url=BASE_URL,
    )

    assert settings.auth_profile == AuthProfile.SAAS
    assert settings.auth_mode == AuthMode.CLERK


def test_self_hosted_profile_accepts_local_mode() -> None:
    settings = Settings(
        _env_file=None,
        auth_profile=AuthProfile.SELF_HOSTED,
        auth_mode=AuthMode.LOCAL,
        local_auth_token="x" * 50,
        base_url=BASE_URL,
    )

    assert settings.auth_profile == AuthProfile.SELF_HOSTED
    assert settings.auth_mode == AuthMode.LOCAL
