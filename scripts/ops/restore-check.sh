#!/usr/bin/env bash
set -euo pipefail

BACKUP_FILE="${BACKUP_FILE:-${1:-}}"
POSTGRES_HOST="${POSTGRES_HOST:-127.0.0.1}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
VALIDATION_TABLES="${VALIDATION_TABLES:-organizations boards tasks}"

: "${BACKUP_FILE:?Provide BACKUP_FILE path or first argument}"
: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"

if [[ ! -f "${BACKUP_FILE}" ]]; then
  echo "Backup file not found: ${BACKUP_FILE}" >&2
  exit 1
fi

restore_file="${BACKUP_FILE}"
tmp_decrypted=""
if [[ "${BACKUP_FILE}" == *.enc ]]; then
  : "${BACKUP_ENCRYPTION_PASSWORD:?BACKUP_ENCRYPTION_PASSWORD is required for encrypted backups}"
  tmp_decrypted="$(mktemp -t mission-control-restore-XXXXXX.dump)"
  openssl enc -d -aes-256-cbc -pbkdf2 \
    -in "${BACKUP_FILE}" \
    -out "${tmp_decrypted}" \
    -pass env:BACKUP_ENCRYPTION_PASSWORD
  restore_file="${tmp_decrypted}"
fi

restore_db="mission_control_restore_check_$(date -u +%Y%m%d%H%M%S)"
cleanup() {
  PGPASSWORD="${POSTGRES_PASSWORD}" psql \
    -h "${POSTGRES_HOST}" \
    -p "${POSTGRES_PORT}" \
    -U "${POSTGRES_USER}" \
    -d postgres \
    -v ON_ERROR_STOP=1 \
    -c "DROP DATABASE IF EXISTS ${restore_db};" >/dev/null 2>&1 || true
  if [[ -n "${tmp_decrypted}" ]]; then
    rm -f "${tmp_decrypted}"
  fi
}
trap cleanup EXIT

echo "Creating temporary restore database: ${restore_db}"
PGPASSWORD="${POSTGRES_PASSWORD}" psql \
  -h "${POSTGRES_HOST}" \
  -p "${POSTGRES_PORT}" \
  -U "${POSTGRES_USER}" \
  -d postgres \
  -v ON_ERROR_STOP=1 \
  -c "CREATE DATABASE ${restore_db};"

echo "Restoring backup into ${restore_db}"
PGPASSWORD="${POSTGRES_PASSWORD}" pg_restore \
  -h "${POSTGRES_HOST}" \
  -p "${POSTGRES_PORT}" \
  -U "${POSTGRES_USER}" \
  -d "${restore_db}" \
  --no-owner \
  --no-privileges \
  "${restore_file}"

validation_query="SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY (ARRAY['$(echo "${VALIDATION_TABLES}" | tr ' ' "','")']);"
found_tables="$(PGPASSWORD="${POSTGRES_PASSWORD}" psql \
  -h "${POSTGRES_HOST}" \
  -p "${POSTGRES_PORT}" \
  -U "${POSTGRES_USER}" \
  -d "${restore_db}" \
  -At \
  -v ON_ERROR_STOP=1 \
  -c "${validation_query}")"

expected_tables="$(wc -w <<< "${VALIDATION_TABLES}" | tr -d ' ')"
if [[ "${found_tables}" -lt "${expected_tables}" ]]; then
  echo "Restore validation failed: expected at least ${expected_tables} core tables, found ${found_tables}" >&2
  exit 1
fi

echo "Restore drill validation passed for ${BACKUP_FILE}"
