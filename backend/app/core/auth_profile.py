"""Shared auth-profile enum values."""

from __future__ import annotations

from enum import Enum


class AuthProfile(str, Enum):
    """Deployment auth profiles controlling fallback strictness."""

    DEV = "dev"
    SELF_HOSTED = "self_hosted"
    SAAS = "saas"
