from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CustomerViewSet, CustomerGroupViewSet

router = DefaultRouter()
router.register(r'groups', CustomerGroupViewSet)
router.register(r'', CustomerViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
