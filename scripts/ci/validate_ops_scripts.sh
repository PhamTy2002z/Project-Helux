#!/usr/bin/env bash
set -euo pipefail

required_scripts=(
  "scripts/ops/backup.sh"
  "scripts/ops/restore-check.sh"
)

for script in "${required_scripts[@]}"; do
  if [[ ! -f "${script}" ]]; then
    echo "Missing required ops script: ${script}" >&2
    exit 1
  fi
  if [[ ! -x "${script}" ]]; then
    echo "Ops script is not executable: ${script}" >&2
    exit 1
  fi
  bash -n "${script}"
  echo "Validated ${script}"
done
