"""Lazy-initialized Polar SDK client singleton."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from app.core.config import settings

if TYPE_CHECKING:
    from polar_sdk import Polar

logger = logging.getLogger(__name__)

_client: Polar | None = None


def get_polar_client() -> Polar:
    """Return shared Polar instance. Raises if provider != polar.

    The Polar SDK class supports both sync and async methods.
    Async methods use the ``_async`` suffix (e.g. ``checkouts.create_async``).
    """
    global _client
    if _client is not None:
        return _client

    if settings.payment_provider != "polar":
        raise RuntimeError("Polar client requested but PAYMENT_PROVIDER != 'polar'.")

    from polar_sdk import Polar

    _client = Polar(access_token=settings.polar_access_token)
    logger.info("Polar client initialized (env=%s)", settings.polar_environment)
    return _client
