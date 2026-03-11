# syntax=docker/dockerfile:1

FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# System deps (keep minimal)
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    git \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-vie \
  && rm -rf /var/lib/apt/lists/*

# Install uv with pinned version for reproducible builds
RUN curl -LsSf https://astral.sh/uv/0.7.12/install.sh | sh
ENV PATH="/root/.local/bin:${PATH}"

# --- deps layer ---
FROM base AS deps

# Copy only dependency metadata first for better build caching
# NOTE: compose builds backend with repo-root context, so files live under /backend.
COPY backend/pyproject.toml backend/uv.lock ./

# Create venv and sync deps (including runtime)
RUN uv sync --frozen --no-dev

# --- runtime ---
FROM base AS runtime

# Create non-root user for security
RUN groupadd --gid 1000 appuser \
  && useradd --uid 1000 --gid appuser --shell /bin/bash --create-home appuser

# Copy virtual environment from deps stage
COPY --from=deps /app/.venv /app/.venv
ENV PATH="/app/.venv/bin:${PATH}"

# Copy app source
COPY backend/migrations ./migrations
COPY backend/alembic.ini ./alembic.ini
COPY backend/app ./app

# Copy provisioning templates.
# In-repo these live at `backend/templates/`; runtime path is `/app/templates`.
COPY backend/templates ./templates

# Copy worker scripts.
# In-repo these live at `scripts/`; runtime path is `/app/scripts`.
COPY scripts ./scripts

# Pre-create shared volume mount point so appuser can write to it
RUN mkdir -p /shared/device-identity \
  && chown -R appuser:appuser /app /shared/device-identity

USER appuser

# Default API port
EXPOSE 8000

# Run the API
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
