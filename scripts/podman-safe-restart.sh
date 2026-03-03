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
  echo "[restart] Compose provider missing. Install podman-compose (or docker-compose)." >&2
  exit 1
fi

"${COMPOSE_CMD[@]}" down
"${COMPOSE_CMD[@]}" up --build -d

echo "[restart] Stack restarted after successful DB backup."
