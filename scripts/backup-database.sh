#!/usr/bin/env bash
# Foundarly Database Backup Automation Script
# Usage: ./scripts/backup-database.sh

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./database/backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/foundarly_backup_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

echo "[Foundarly Backup] Starting database backup at $(date -u)..."

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[Foundarly Backup] Error: DATABASE_URL environment variable is not set." >&2
  echo "Please export DATABASE_URL='postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres'" >&2
  exit 1
fi

if ! command -v pg_dump &> /dev/null; then
  echo "[Foundarly Backup] Error: pg_dump utility is not installed in the current environment." >&2
  exit 1
fi

pg_dump "${DATABASE_URL}" \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  | gzip > "${BACKUP_FILE}"

echo "[Foundarly Backup] Backup completed successfully: ${BACKUP_FILE} ($(du -h "${BACKUP_FILE}" | cut -f1))"
