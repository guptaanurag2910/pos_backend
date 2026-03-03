#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
mkdir -p "$BACKUP_DIR"

if podman compose version >/dev/null 2>&1; then
  COMPOSE_CMD=(podman compose)
elif command -v podman-compose >/dev/null 2>&1; then
  COMPOSE_CMD=(podman-compose)
else
  echo "[backup] Compose provider missing. Install podman-compose (or docker-compose)." >&2
  exit 1
fi

if ! "${COMPOSE_CMD[@]}" ps --status running --services | grep -qx "db"; then
  echo "[backup] Database container is not running. Start the stack first." >&2
  exit 1
fi

TIMESTAMP="$(date +"%Y%m%d_%H%M%S")"
BACKUP_FILE="$BACKUP_DIR/pos_db_${TIMESTAMP}.sql.gz"

echo "[backup] Creating backup: $BACKUP_FILE"
"${COMPOSE_CMD[@]}" exec -T db sh -c 'PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}"' | gzip > "$BACKUP_FILE"

if [[ ! -s "$BACKUP_FILE" ]]; then
  echo "[backup] Backup failed: file is empty." >&2
  exit 1
fi

echo "[backup] Backup complete: $BACKUP_FILE"
