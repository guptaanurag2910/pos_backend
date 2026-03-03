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
user, created = User.objects.get_or_create(
    email=email,
    defaults={
        'name': name,
        'is_staff': True,
        'is_superuser': True,
        'is_active': True,
        'role': 'admin',
    },
)
changed = False

if created:
    user.set_password(password)
    changed = True
    print(f'[init] Superuser created: {email}')
else:
    if user.name != name:
        user.name = name
        changed = True
    if getattr(user, 'role', None) != 'admin':
        user.role = 'admin'
        changed = True
    if not user.is_staff:
        user.is_staff = True
        changed = True
    if not user.is_superuser:
        user.is_superuser = True
        changed = True
    if not user.is_active:
        user.is_active = True
        changed = True
    if not user.check_password(password):
        user.set_password(password)
        changed = True

if changed:
    user.save()
    if not created:
        print(f'[init] Superuser updated from env: {email}')
else:
    print(f'[init] Superuser already up-to-date: {email}')
"
  fi
fi

echo "[init] Starting gunicorn..."
if python -c "import gunicorn" >/dev/null 2>&1; then
  exec python -m gunicorn pos_backend.wsgi:application --bind 0.0.0.0:8000 --workers 3 --timeout 120
fi

echo "[init] gunicorn is not available. Falling back to Django runserver."
exec python manage.py runserver 0.0.0.0:8000
