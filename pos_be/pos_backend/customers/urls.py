from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CustomerViewSet, CustomerGroupViewSet

router = DefaultRouter()
router.register(r'', CustomerViewSet)
router.register(r'groups', CustomerGroupViewSet)

urlpatterns = [
    path('', include(router.urls)),
]