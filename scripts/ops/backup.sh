#!/usr/bin/env bash
set -euo pipefail

BACKUP_PREFIX="${BACKUP_PREFIX:-mission-control}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
POSTGRES_HOST="${POSTGRES_HOST:-127.0.0.1}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"

: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"

mkdir -p "${BACKUP_DIR}"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
raw_file="${BACKUP_DIR}/${BACKUP_PREFIX}-${timestamp}.dump"
final_file="${raw_file}"

echo "Creating logical backup: ${raw_file}"
PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
  -h "${POSTGRES_HOST}" \
  -p "${POSTGRES_PORT}" \
  -U "${POSTGRES_USER}" \
  -d "${POSTGRES_DB}" \
  --format=custom \
  --file "${raw_file}"

if [[ -n "${BACKUP_ENCRYPTION_PASSWORD:-}" ]]; then
  encrypted_file="${raw_file}.enc"
  echo "Encrypting backup artifact: ${encrypted_file}"
  openssl enc -aes-256-cbc -pbkdf2 -salt \
    -in "${raw_file}" \
    -out "${encrypted_file}" \
    -pass env:BACKUP_ENCRYPTION_PASSWORD
  rm -f "${raw_file}"
  final_file="${encrypted_file}"
fi

if [[ "${BACKUP_RETENTION_DAYS}" =~ ^[0-9]+$ ]] && [[ "${BACKUP_RETENTION_DAYS}" -gt 0 ]]; then
  echo "Pruning backups older than ${BACKUP_RETENTION_DAYS} days"
  find "${BACKUP_DIR}" \
    -type f \
    \( -name "${BACKUP_PREFIX}-*.dump" -o -name "${BACKUP_PREFIX}-*.dump.enc" \) \
    -mtime "+${BACKUP_RETENTION_DAYS}" \
    -delete
fi

echo "Backup complete: ${final_file}"
