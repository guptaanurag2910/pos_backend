# Podman Setup (Postgres + Django + React in one stack)

This stack uses Quay-hosted open images (not Docker Hub, not AWS Public ECR).
Frontend is built with Vite and served via `vite preview`, and calls backend directly via `VITE_API_BASE_URL`.

## 1) Prerequisites

- Podman installed
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

## 3) Start full stack

```bash
podman compose up --build
```

Services:
- Frontend: `http://localhost:3001`
- Backend API: `http://localhost:8000`
- Postgres DB: `localhost:5432`

## 4) Run in background

```bash
podman compose up --build -d
```

## 5) Monitor and debug

```bash
podman compose ps
podman compose logs -f
podman compose logs -f backend
podman compose logs -f frontend
podman compose logs -f db
podman stats
```

## 6) Stop stack

```bash
podman compose down
```

Reset everything (including DB volume):

```bash
podman compose down -v
podman compose up --build
```

## 7) Superuser auto-create

Set in `.env`:

```env
CREATE_DJANGO_SUPERUSER=True
DJANGO_SUPERUSER_EMAIL=admin@example.com
DJANGO_SUPERUSER_NAME=Platform Admin
DJANGO_SUPERUSER_PASSWORD=Admin@12345
```

Behavior:
- Created once on first startup.
- Skipped if email already exists.

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
podman compose down
podman compose up --build
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
