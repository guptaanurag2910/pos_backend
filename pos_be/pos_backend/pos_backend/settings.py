import os
from pathlib import Path
from datetime import timedelta
from urllib.parse import urlparse, parse_qs

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Always inject this from env in staging/production.
SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'django-insecure-p0s-backend-secret-key-change-in-production')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = os.getenv('DJANGO_DEBUG', 'True').lower() in ('1', 'true', 'yes', 'on')

# Comma-separated hosts, e.g. "api.example.com,localhost".
ALLOWED_HOSTS = [host.strip() for host in os.getenv('DJANGO_ALLOWED_HOSTS', '*').split(',') if host.strip()]

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third party apps
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'django_filters',
    'drf_spectacular',
    'django_extensions',
    # Local apps
    'accounts',
    'inventory',
    'sales',
    'customers',
    'reports',
    'return',
    'stores',
    'suppliers',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'pos_backend.middleware.RequestTraceMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'pos_backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'pos_backend.wsgi.application'

# Database:
# 1) Prefer DATABASE_URL for hosted DBs.
# 2) Fall back to DB_* values for local/docker.
# 3) Optional sqlite mode for quick development.
def _build_database_config():
    database_url = os.getenv('DATABASE_URL', '').strip()
    if database_url:
        parsed = urlparse(database_url)
        query = parse_qs(parsed.query)
        sslmode_from_url = query.get('sslmode', [None])[0]
        sslmode = sslmode_from_url or os.getenv('DB_SSLMODE', 'prefer')

        return {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': (parsed.path or '').lstrip('/') or os.getenv('DB_NAME', 'pos'),
            'USER': parsed.username or os.getenv('DB_USER', 'anurag'),
            'PASSWORD': parsed.password or os.getenv('DB_PASSWORD', ''),
            'HOST': parsed.hostname or os.getenv('DB_HOST', 'localhost'),
            'PORT': str(parsed.port or os.getenv('DB_PORT', '5432')),
            'OPTIONS': {
                'sslmode': sslmode,
            },
        }

    engine = os.getenv('DB_ENGINE', 'django.db.backends.postgresql')
    if engine == 'django.db.backends.sqlite3':
        sqlite_name = os.getenv('SQLITE_NAME', str(BASE_DIR / 'db.sqlite3'))
        return {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': sqlite_name,
        }

    return {
        'ENGINE': engine,
        'NAME': os.getenv('DB_NAME', 'pos'),
        'USER': os.getenv('DB_USER', 'anurag'),
        'PASSWORD': os.getenv('DB_PASSWORD', ''),
        'HOST': os.getenv('DB_HOST', 'localhost'),
        'PORT': os.getenv('DB_PORT', '5432'),
        'OPTIONS': {
            'sslmode': os.getenv('DB_SSLMODE', 'prefer'),
        },
    }


DATABASES = {
    'default': _build_database_config()
}

# DATABASES = {
#     'default': {
#         'ENGINE': 'django.db.backends.sqlite3',
#         'NAME': BASE_DIR / 'db.sqlite3',
#     }
# }

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Custom User Model
AUTH_USER_MODEL = 'accounts.User'

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Kolkata'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = 'static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'static')

# Media files
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

def _csv_env(name, default=''):
    return [item.strip() for item in os.getenv(name, default).split(',') if item.strip()]


# CORS / CSRF:
# - Keep wide-open for local dev by default.
# - Restrict in production using env vars.
CORS_ALLOW_ALL_ORIGINS = os.getenv(
    'CORS_ALLOW_ALL_ORIGINS',
    'True' if DEBUG else 'False'
).lower() in ('1', 'true', 'yes', 'on')
CORS_ALLOWED_ORIGINS = _csv_env('CORS_ALLOWED_ORIGINS', '')
CSRF_TRUSTED_ORIGINS = _csv_env('CSRF_TRUSTED_ORIGINS', '')

# Security headers/cookies (effective when running behind reverse proxy HTTPS).
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SESSION_COOKIE_SECURE = os.getenv(
    'SESSION_COOKIE_SECURE',
    'False' if DEBUG else 'True'
).lower() in ('1', 'true', 'yes', 'on')
CSRF_COOKIE_SECURE = os.getenv(
    'CSRF_COOKIE_SECURE',
    'False' if DEBUG else 'True'
).lower() in ('1', 'true', 'yes', 'on')

# REST Framework settings
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 10,
}

# JWT settings
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(days=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'VERIFYING_KEY': None,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
    'AUTH_TOKEN_CLASSES': ('rest_framework_simplejwt.tokens.AccessToken',),
    'TOKEN_TYPE_CLAIM': 'token_type',
}

# API Documentation settings
SPECTACULAR_SETTINGS = {
    'TITLE': 'GoFrugal POS API',
    'DESCRIPTION': 'API documentation for GoFrugal POS System',
    'VERSION': '1.0.0',
}

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'standard': {
            'format': '[%(asctime)s] %(levelname)s %(name)s %(message)s',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'standard',
        },
        'file': {
            'class': 'logging.FileHandler',
            'filename': BASE_DIR / 'pos_backend.log',
            'formatter': 'standard',
        },
    },
    'loggers': {
        'pos.trace': {
            'handlers': ['console', 'file'],
            'level': 'INFO',
            'propagate': False,
        },
        'stores': {
            'handlers': ['console', 'file'],
            'level': 'INFO',
            'propagate': False,
        },
        'sales': {
            'handlers': ['console', 'file'],
            'level': 'INFO',
            'propagate': False,
        },
        'reports': {
            'handlers': ['console', 'file'],
            'level': 'INFO',
            'propagate': False,
        },
        'accounts': {
            'handlers': ['console', 'file'],
            'level': 'INFO',
            'propagate': False,
        },
        'inventory': {
            'handlers': ['console', 'file'],
            'level': 'INFO',
            'propagate': False,
        },
        'customers': {
            'handlers': ['console', 'file'],
            'level': 'INFO',
            'propagate': False,
        },
        'suppliers': {
            'handlers': ['console', 'file'],
            'level': 'INFO',
            'propagate': False,
        },
        'return': {
            'handlers': ['console', 'file'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}
