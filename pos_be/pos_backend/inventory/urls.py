from django.urls import path, include
from rest_framework_nested import routers
from .views import (
    CategoryViewSet, ProductViewSet, StockRecordViewSet,
    StockLevelViewSet, StockTransferViewSet, StockTransferItemViewSet
)

router = routers.DefaultRouter()
router.register(r'categories', CategoryViewSet)
router.register(r'products', ProductViewSet)
router.register(r'stock-records', StockRecordViewSet, basename='stock-record')
router.register(r'stock-levels', StockLevelViewSet, basename='stock-level')
router.register(r'stock-transfers', StockTransferViewSet)

transfer_router = routers.NestedSimpleRouter(router, r'stock-transfers', lookup='transfer')
transfer_router.register(r'items', StockTransferItemViewSet, basename='transfer-item')

urlpatterns = [
    path('', include(router.urls)),
    path('', include(transfer_router.urls)),
]