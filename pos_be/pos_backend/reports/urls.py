from django.urls import path
from .views import (
    DashboardView, SalesReportView, InventoryReportView,
    CustomerReportView, TaxReportView, StoreBootstrapExportView
)

urlpatterns = [
    path('dashboard/', DashboardView.as_view(), name='dashboard'),
    path('dashboard/analytics/', DashboardView.as_view(), name='dashboard-analytics'),
    path('dashboard/export-bootstrap/', StoreBootstrapExportView.as_view(), name='dashboard-export-bootstrap'),
    path('sales/', SalesReportView.as_view(), name='sales-report'),
    path('inventory/', InventoryReportView.as_view(), name='inventory-report'),
    path('customers/', CustomerReportView.as_view(), name='customer-report'),
    path('tax/', TaxReportView.as_view(), name='tax-report'),
]
