# Docker Setup (Postgres + Django + React in one stack)

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
- Database (Postgres): `localhost:5432`

## 3. Build images only (optional)

```bash
docker compose build
```

## 4. Run in background (optional)

```bash
docker compose up --build -d
```

## 5. Monitor containers and logs

```bash
# all services status
docker compose ps

# all logs (follow)
docker compose logs -f

# service-specific logs
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f db
```

## 6. Basic health/debug commands

```bash
# container resource usage
docker stats

# inspect backend container details
docker inspect pos_backend

# open shell in backend container
docker compose exec backend sh

# open shell in db container
docker compose exec db sh
```

## 7. Stop services

```bash
docker compose down
```

To remove volumes also:

```bash
docker compose down -v
```

## 8. Reset whole stack (clean DB data)

```bash
docker compose down -v
docker compose up --build
```

## 9. Optional: auto-create Django superuser on startup

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

## 10. Database access

### A) Access Postgres CLI inside container

```bash
docker compose exec db psql -U pos_user -d pos
```

### B) Common SQL checks

```sql
\dt
SELECT COUNT(*) FROM accounts_user;
SELECT COUNT(*) FROM inventory_product;
SELECT COUNT(*) FROM sales_bill;
```

### C) DB dump and restore

```bash
# backup
docker compose exec -T db pg_dump -U pos_user -d pos > backup_pos.sql

# restore (inside running stack)
cat backup_pos.sql | docker compose exec -T db psql -U pos_user -d pos
```

### D) Connect from host tools (DBeaver/psql)

Use:
- Host: `localhost`
- Port: `5432`
- Database: `pos`
- User: `pos_user`
- Password: `pos_password`

## 11. Use external hosted PostgreSQL (later switch)

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
- Backend uses dockerized Postgres by default (`db` service).
- Backend connects to external DB when `DATABASE_URL` or external `DB_*` is provided.

## 12. Production-safe env baseline

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

## 13. Full restart sequence (recommended after config changes)

```bash
docker compose down
docker compose up --build -d
docker compose ps
docker compose logs -f backend
```
