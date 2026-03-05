#!/bin/sh
set -eu

echo "[init] Running migrations..."
python manage.py migrate --noinput

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
exec gunicorn pos_backend.wsgi:application --bind 0.0.0.0:8000 --workers 3 --timeout 120
