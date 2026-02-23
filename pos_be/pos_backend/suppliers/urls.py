from django.urls import path, include
from rest_framework_nested import routers
from .views import (
    SupplierViewSet, PurchaseOrderViewSet, PurchaseOrderItemViewSet,
    GoodsReceiptNoteViewSet, GoodsReceiptNoteItemViewSet, SupplierInvoiceViewSet,
    SupplierPaymentViewSet, SupplierInvoiceItemViewSet
)

router = routers.DefaultRouter()
router.register(r'suppliers', SupplierViewSet)
router.register(r'purchase-orders', PurchaseOrderViewSet)
router.register(r'grn', GoodsReceiptNoteViewSet, basename='goods-receipt-note')
router.register(r'supplier-invoices', SupplierInvoiceViewSet)
router.register(r'payments', SupplierPaymentViewSet)

po_router = routers.NestedSimpleRouter(router, r'purchase-orders', lookup='po')
po_router.register(r'items', PurchaseOrderItemViewSet, basename='purchase-order-item')

grn_router = routers.NestedSimpleRouter(router, r'grn', lookup='grn')
grn_router.register(r'items', GoodsReceiptNoteItemViewSet, basename='grn-item')

invoice_router = routers.NestedSimpleRouter(router, r'supplier-invoices', lookup='invoice')
invoice_router.register(r'items', SupplierInvoiceItemViewSet, basename='supplier-invoice-item')

urlpatterns = [
    path('', include(router.urls)),
    path('', include(po_router.urls)),
    path('', include(grn_router.urls)),
    path('', include(invoice_router.urls)),
]
