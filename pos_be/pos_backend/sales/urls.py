from django.urls import path, include
from rest_framework_nested import routers
from .views import BillViewSet, BillItemViewSet, PaymentViewSet

router = routers.DefaultRouter()
router.register(r'bills', BillViewSet, basename='bill')
router.register(r'payments', PaymentViewSet, basename='payment')

bills_router = routers.NestedSimpleRouter(router, r'bills', lookup='bill')
bills_router.register(r'items', BillItemViewSet, basename='bill-items')

urlpatterns = [
    path('', include(router.urls)),
    path('', include(bills_router.urls)),
]