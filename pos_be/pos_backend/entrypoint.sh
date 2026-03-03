#!/bin/sh
set -eu

echo "[init] Running migrations..."
python manage.py migrate --noinput

# Optional bootstrap superuser creation from env.
if [ "${CREATE_DJANGO_SUPERUSER:-false}" = "true" ] || [ "${CREATE_DJANGO_SUPERUSER:-false}" = "True" ]; then
  if [ -z "${DJANGO_SUPERUSER_EMAIL:-}" ] || [ -z "${DJANGO_SUPERUSER_NAME:-}" ] || [ -z "${DJANGO_SUPERUSER_PASSWORD:-}" ]; then
    echo "[init] CREATE_DJANGO_SUPERUSER is true but DJANGO_SUPERUSER_* vars are missing. Skipping."
  else
    python manage.py shell -c "
import os
from django.contrib.auth import get_user_model
User = get_user_model()
email = os.environ.get('DJANGO_SUPERUSER_EMAIL')
name = os.environ.get('DJANGO_SUPERUSER_NAME')
password = os.environ.get('DJANGO_SUPERUSER_PASSWORD')
if User.objects.filter(email=email).exists():
    print(f'[init] Superuser already exists: {email}')
else:
    User.objects.create_superuser(email=email, name=name, password=password)
    print(f'[init] Superuser created: {email}')
"
  fi
fi

echo "[init] Starting gunicorn..."
exec gunicorn pos_backend.wsgi:application --bind 0.0.0.0:8000 --workers 3 --timeout 120
