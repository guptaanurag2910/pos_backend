# Podman Deployment Guide (POS FE + BE + Postgres)

This setup is production-oriented and AWS-ready while still keeping Postgres in-container for MVP.

## Stack
- `frontend`: React app built with Vite, served by nginx (unprivileged image)
- `backend`: Django + Gunicorn
- `db`: PostgreSQL 16

## 1. Prerequisites

Install:
- Podman (`podman --version`)
- Podman Compose (`podman compose version` or `podman-compose --version`)
- AWS CLI (for ECR workflows)

If `podman compose` shows provider errors, install one compose provider:
```bash
pip3 install podman-compose
```

## 2. Local run with Podman

```bash
cp .env.podman.example .env
podman compose -f docker-compose.yml up --build -d
podman compose -f docker-compose.yml ps
```

URLs:
- Frontend: `http://localhost:3001`
- Backend health: `http://localhost:8000/api/health/`
- PostgreSQL: `localhost:5432`

Logs:
```bash
podman compose -f docker-compose.yml logs -f backend
podman compose -f docker-compose.yml logs -f frontend
podman compose -f docker-compose.yml logs -f db
```

Stop:
```bash
podman compose -f docker-compose.yml down
```

Stop + remove DB volume:
```bash
podman compose -f docker-compose.yml down -v
```

## 3. MVP now vs external DB later

### MVP now (containerized Postgres)
- Keep `db` service running.
- Use defaults:
  - `DB_HOST=db`
  - `DB_PORT=5432`
  - `DB_NAME`, `DB_USER`, `DB_PASSWORD` from `.env`

### Later (managed DB like AWS RDS)
1. Set:
   - `DATABASE_URL=postgresql://...` (recommended)
   - or `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_SSLMODE=require`
2. Start only app services:
   ```bash
   podman compose -f docker-compose.yml up -d backend frontend
   ```

## 4. Build and push images to AWS ECR

Use script:
```bash
AWS_ACCOUNT_ID=123456789012 AWS_REGION=ap-south-1 TAG=v1 \
./scripts/podman/build_and_push_ecr.sh
```

This outputs:
- `BACKEND_IMAGE=...`
- `FRONTEND_IMAGE=...`

## 5. Deploy on AWS EC2 with Podman

1. Copy project to EC2.
2. Create `.env` on EC2 (do not commit secrets).
3. Set these required values:
   - `BACKEND_IMAGE`
   - `FRONTEND_IMAGE`
   - `DJANGO_SECRET_KEY`
   - `POSTGRES_PASSWORD` (if local DB service is still used)
4. Start:
```bash
podman compose -f docker-compose.aws.yml up -d
podman compose -f docker-compose.aws.yml ps
```

## 6. Recommended production env values

```env
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=your-domain.com,api.your-domain.com
CORS_ALLOW_ALL_ORIGINS=False
CORS_ALLOWED_ORIGINS=https://your-domain.com
CSRF_TRUSTED_ORIGINS=https://your-domain.com
SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True
ENABLE_FILE_LOGGING=False
```

## 7. Healthchecks

- Backend: `GET /api/health/`
- Frontend: `GET /healthz`
- DB: `pg_isready`

## 8. Notes for AWS hardening

- Put EC2 behind an ALB/NLB and terminate TLS at load balancer.
- Restrict Security Groups:
  - only ALB -> frontend/backend ports
  - DB port only from app SG
- Move DB to RDS after MVP, keep same backend env contract.
- Use AWS Secrets Manager or SSM Parameter Store for secret injection.
