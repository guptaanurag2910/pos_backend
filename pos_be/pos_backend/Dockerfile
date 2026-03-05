FROM python:3.11-slim

# Python runtime flags:
# - no .pyc files
# - immediate logs to stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Build deps for psycopg2 and cleanup apt cache.
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY . /app
RUN chmod +x /app/entrypoint.sh

EXPOSE 8000

# Run migrations + optional superuser creation + start Gunicorn.
CMD ["/app/entrypoint.sh"]
