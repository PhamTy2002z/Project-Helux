"""FlowGrid backend application package."""

from __future__ import annotations

from starlette import status

# Starlette renamed 422 to HTTP_422_UNPROCESSABLE_ENTITY in some releases.
# Keep a compatibility alias so existing code can use one constant consistently.
if not hasattr(status, "HTTP_422_UNPROCESSABLE_CONTENT"):
    status.HTTP_422_UNPROCESSABLE_CONTENT = status.HTTP_422_UNPROCESSABLE_ENTITY
