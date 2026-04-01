#!/bin/sh
set -eu

DB_WAIT_TIMEOUT="${DB_WAIT_TIMEOUT:-60}"
DB_WAIT_INTERVAL="${DB_WAIT_INTERVAL:-2}"
DB_WAIT_ENABLED="${DB_WAIT_ENABLED:-true}"
MIGRATE_ON_START="${MIGRATE_ON_START:-true}"
COLLECTSTATIC_ON_START="${COLLECTSTATIC_ON_START:-true}"

if [ "$DB_WAIT_ENABLED" = "true" ] || [ "$DB_WAIT_ENABLED" = "True" ]; then
  echo "[init] Waiting for database connectivity..."
  export DB_WAIT_TIMEOUT DB_WAIT_INTERVAL
  python - <<'PY'
import os
import sys
import time
import django
from django.db import connections
from django.db.utils import OperationalError

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'pos_backend.settings')
django.setup()

timeout = int(os.getenv('DB_WAIT_TIMEOUT', '60'))
interval = int(os.getenv('DB_WAIT_INTERVAL', '2'))
start = time.time()

while True:
    try:
        conn = connections['default']
        conn.cursor()
        conn.close()
        print('[init] Database connection is ready.')
        sys.exit(0)
    except OperationalError as exc:
        elapsed = time.time() - start
        if elapsed >= timeout:
            print(f'[init] Database not ready after {timeout}s: {exc}')
            sys.exit(1)
        print(f'[init] Database not ready yet ({int(elapsed)}s): {exc}')
        time.sleep(interval)
PY
fi

if [ "$MIGRATE_ON_START" = "true" ] || [ "$MIGRATE_ON_START" = "True" ]; then
  echo "[init] Running migrations..."
  python manage.py migrate --noinput
fi

if [ "$COLLECTSTATIC_ON_START" = "true" ] || [ "$COLLECTSTATIC_ON_START" = "True" ]; then
  echo "[init] Collecting static files..."
  python manage.py collectstatic --noinput
fi

# Optional bootstrap superuser creation from env.
# This runs on container startup, not image build.
if [ "${CREATE_DJANGO_SUPERUSER:-false}" = "true" ] || [ "${CREATE_DJANGO_SUPERUSER:-false}" = "True" ]; then
  if [ -z "${DJANGO_SUPERUSER_EMAIL:-}" ] || [ -z "${DJANGO_SUPERUSER_NAME:-}" ] || [ -z "${DJANGO_SUPERUSER_PASSWORD:-}" ]; then
    echo "[init] CREATE_DJANGO_SUPERUSER is true but one or more DJANGO_SUPERUSER_* vars are missing. Skipping superuser creation."
  else
    python manage.py shell -c "
import os
from django.contrib.auth import get_user_model

User = get_user_model()
email = os.environ.get('DJANGO_SUPERUSER_EMAIL')
name = os.environ.get('DJANGO_SUPERUSER_NAME')
password = os.environ.get('DJANGO_SUPERUSER_PASSWORD')

user = User.objects.filter(email=email).first()
if user is None:
    User.objects.create_superuser(email=email, name=name, password=password)
    print(f'[init] Superuser created: {email}')
else:
    print(f'[init] Superuser already exists: {email}')
"
  fi
fi

echo "[init] Starting gunicorn..."
exec gunicorn pos_backend.wsgi:application \
  --bind 0.0.0.0:${PORT:-8000} \
  --workers "${GUNICORN_WORKERS:-3}" \
  --threads "${GUNICORN_THREADS:-2}" \
  --timeout "${GUNICORN_TIMEOUT:-120}" \
  --access-logfile - \
  --error-logfile -
