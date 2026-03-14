#!/bin/sh
set -e

# Fix ownership on mounted volumes (Docker named volumes default to root).
# Entrypoint runs as root, fixes perms, then drops to appuser via gosu.
if [ "$(id -u)" = "0" ]; then
  chown -R appuser:appuser /shared/device-identity
  exec gosu appuser "$@"
fi

# Already running as non-root (e.g. docker run --user)
exec "$@"
