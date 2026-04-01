from django.db import connections
from django.http import JsonResponse


def health_check(_request):
    try:
        with connections['default'].cursor() as cursor:
            cursor.execute('SELECT 1')
            cursor.fetchone()
        database_status = 'ok'
        overall_status = 'ok'
        status_code = 200
    except Exception as exc:  # noqa: BLE001
        database_status = f'error: {exc}'
        overall_status = 'degraded'
        status_code = 503

    return JsonResponse(
        {
            'status': overall_status,
            'database': database_status,
            'service': 'pos_backend',
        },
        status=status_code,
    )
