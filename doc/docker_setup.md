# Docker Setup (FE + BE, DB on host/external)

## 1. Prepare env

```bash
cp .env.docker.example .env
```

## 2. Start all services

```bash
docker compose up --build
```

Services:
- Frontend: `http://localhost:3001`
- Backend API: `http://localhost:8000`
- Database: local host Postgres (`host.docker.internal:5432` from backend container)

## 3. Stop services

```bash
docker compose down
```

To remove volumes also:

```bash
docker compose down -v
```

## 4. Use external hosted PostgreSQL

Edit `.env` and set one of these:

1. `DATABASE_URL` (recommended):

```env
DATABASE_URL=postgresql://username:password@host:5432/dbname?sslmode=require
```

2. OR set `DB_*` directly:

```env
DB_HOST=your-db-host
DB_PORT=5432
DB_NAME=your-db-name
DB_USER=your-db-user
DB_PASSWORD=your-db-password
DB_SSLMODE=require
```

Then restart:

```bash
docker compose down
docker compose up --build
```

Notes:
- Backend uses your local Postgres by default (matching current test credentials).
- Backend connects to external DB when `DATABASE_URL` or external `DB_*` is provided.

## 5. Production-safe env baseline

Before public deployment, set at least:

```env
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=your-domain.com,api.your-domain.com
CORS_ALLOW_ALL_ORIGINS=False
CORS_ALLOWED_ORIGINS=https://your-domain.com
CSRF_TRUSTED_ORIGINS=https://your-domain.com
SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True
```

## 6. Optional: auto-create Django superuser on startup

Set these in `.env`:

```env
CREATE_DJANGO_SUPERUSER=True
DJANGO_SUPERUSER_EMAIL=admin@example.com
DJANGO_SUPERUSER_NAME=Platform Admin
DJANGO_SUPERUSER_PASSWORD=ChangeMeStrong123!
```

Behavior:
- If user does not exist, backend creates it at container startup.
- If user already exists, backend skips creation.
