import os
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

admin.site.site_header = os.getenv('DJANGO_ADMIN_SITE_HEADER', 'Django administration')
admin.site.site_title = os.getenv('DJANGO_ADMIN_SITE_TITLE', 'Django site admin')
admin.site.index_title = os.getenv('DJANGO_ADMIN_INDEX_TITLE', 'Site administration')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
    path('api/auth/', include('accounts.urls')),
    path('api/inventory/', include('inventory.urls')),
    path('api/sales/', include('sales.urls')),
    path('api/return/', include('return.urls')),
    path('api/customers/', include('customers.urls')),
    path('api/reports/', include('reports.urls')),
    path('api/stores/', include('stores.urls')),
    path('api/suppliers/', include('suppliers.urls')),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
