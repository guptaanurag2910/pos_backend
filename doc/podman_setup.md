# Podman Setup (Dockerized FE + BE + DB)

This stack builds Docker-compatible images for frontend/backend and runs everything with Podman.
All runtime/base images are from Docker Hub (official images).

- FE image: built from `pos_fe/Dockerfile`
- BE image: built from `pos_be/pos_backend/Dockerfile`
- DB image: `postgres:16-alpine`

Frontend is built with Vite and served via `vite preview`, and calls backend via `VITE_API_BASE_URL`.

## 1) Prerequisites

- Podman installed
- Compose provider installed (`podman-compose` or `docker-compose`)
- Podman machine initialized/running (macOS/Windows)

macOS quick start:

```bash
podman machine init
podman machine start
```

## 2) Prepare env

```bash
cp .env.podman.example .env
```

## 3) Build and start full stack

```bash
podman compose up --build -d
```

Services:
- Frontend: `http://localhost:3001`
- Backend API: `http://localhost:8000`
- Postgres DB: `localhost:5432`

## 4) Persistent DB storage

Postgres data is stored in the named volume `postgres_data`, so DB data survives container stop/start and restart.

To reset DB state completely:

```bash
podman compose down -v
```

## 5) Backup before stop/restart

Use the helper scripts so a DB backup is taken automatically before stopping or restarting the stack:

```bash
./scripts/podman-safe-stop.sh
./scripts/podman-safe-restart.sh
```

These scripts auto-detect `podman compose` or `podman-compose`.

Manual backup only:

```bash
./scripts/podman-db-backup.sh
```

Backups are saved in `./backups` as `pos_db_YYYYMMDD_HHMMSS.sql.gz`.

## 6) Monitor and debug

```bash
podman compose ps
podman compose logs -f
podman compose logs -f backend
podman compose logs -f frontend
podman compose logs -f db
podman stats
```

## 7) Superuser auto-create

Set in `.env`:

```env
CREATE_DJANGO_SUPERUSER=True
DJANGO_SUPERUSER_EMAIL=admin@pos.local
DJANGO_SUPERUSER_NAME=Admin
DJANGO_SUPERUSER_PASSWORD=Admin@12345
DJANGO_ADMIN_SITE_HEADER=Django administration
DJANGO_ADMIN_SITE_TITLE=Django site admin
DJANGO_ADMIN_INDEX_TITLE=Site administration
```

Behavior:
- Created on first startup.
- Updated on each startup to match `.env` (name/password/permissions), so admin creds stay in sync.
- Login URL: `http://localhost:8000/admin`
- Login field: `email` with `DJANGO_SUPERUSER_EMAIL` value.

## 8) Access DB

Open `psql` in db container:

```bash
podman compose exec db psql -U pos_user -d pos
```

Quick checks:

```sql
\dt
SELECT COUNT(*) FROM accounts_user;
SELECT COUNT(*) FROM inventory_product;
SELECT COUNT(*) FROM sales_bill;
```

## 9) External hosted DB (later)

Set one of:

1. `DATABASE_URL` (recommended):

```env
DATABASE_URL=postgresql://username:password@host:5432/dbname?sslmode=require
```

2. Or `DB_*` values directly:

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
./scripts/podman-safe-restart.sh
```

## 10) Production-safe env baseline

```env
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=your-domain.com,api.your-domain.com
CORS_ALLOW_ALL_ORIGINS=False
CORS_ALLOWED_ORIGINS=https://your-domain.com
CSRF_TRUSTED_ORIGINS=https://your-domain.com
SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True
```
