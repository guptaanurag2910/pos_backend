#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

"$ROOT_DIR/scripts/podman-db-backup.sh"
cd "$ROOT_DIR"
if podman compose version >/dev/null 2>&1; then
  COMPOSE_CMD=(podman compose)
elif command -v podman-compose >/dev/null 2>&1; then
  COMPOSE_CMD=(podman-compose)
else
  echo "[stop] Compose provider missing. Install podman-compose (or docker-compose)." >&2
  exit 1
fi

"${COMPOSE_CMD[@]}" down

echo "[stop] Stack stopped after successful DB backup."
