from datetime import datetime, timedelta
import csv
from io import BytesIO
from decimal import Decimal

import pandas as pd
from django.db import connection
from django.db.models import Avg, Count, F, Q, Sum, DecimalField, ExpressionWrapper, Min, Max
from django.db.models.functions import TruncDate, TruncMonth, TruncWeek, TruncHour
from django.http import HttpResponse
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import status, views
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from customers.models import Customer
from inventory.models import StockLevel
from sales.models import Bill, BillItem, Payment
from stores.models import Store
from suppliers.models import (
    GoodsReceiptNote,
    GoodsReceiptNoteItem,
    PurchaseOrder,
    PurchaseOrderItem,
    Supplier,
    SupplierInvoice,
    SupplierInvoiceItem,
    SupplierPayment,
)


class ReportBaseMixin:
    def _table_has_column(self, table_name, column_name):
        with connection.cursor() as cursor:
            description = connection.introspection.get_table_description(cursor, table_name)
        return any(col.name == column_name for col in description)

    def _customer_queryset(self, request):
        queryset = Customer.objects.all()

        # Backward compatibility: some DBs may not yet have this column migrated.
        if self._table_has_column(Customer._meta.db_table, 'is_active'):
            queryset = queryset.filter(is_active=True)

        store_id = self._resolve_scope_store_id(request)
        if request.user.role == 'admin' and request.query_params.get('store') and store_id:
            queryset = queryset.filter(bills__store_id=store_id).distinct()
        elif store_id:
            queryset = queryset.filter(bills__store_id=store_id).distinct()

        return queryset

    def _resolve_scope_store_id(self, request):
        explicit_store = request.query_params.get('store')
        if request.user.role == 'admin' and explicit_store:
            return explicit_store

        if request.user.store_id:
            return request.user.store_id

        fallback = Store.objects.filter(is_main=True, is_active=True).values_list('id', flat=True).first()
        if fallback:
            return fallback
        return Store.objects.filter(is_active=True).order_by('id').values_list('id', flat=True).first()

    def _parse_date_range(self, request, default_days=30):
        start_date_raw = request.query_params.get('start_date')
        end_date_raw = request.query_params.get('end_date')
        time_range = request.query_params.get('time_range', '').lower()

        today = timezone.localdate()

        if time_range == 'last7days':
            return today - timedelta(days=6), today
        if time_range == 'last30days':
            return today - timedelta(days=29), today
        if time_range == 'last90days':
            return today - timedelta(days=89), today
        if time_range == 'thisyear':
            return today.replace(month=1, day=1), today

        try:
            if start_date_raw:
                start_date = datetime.strptime(start_date_raw, '%Y-%m-%d').date()
            else:
                start_date = today - timedelta(days=default_days)

            if end_date_raw:
                end_date = datetime.strptime(end_date_raw, '%Y-%m-%d').date()
            else:
                end_date = today
        except ValueError:
            raise ValueError('Invalid date format. Use YYYY-MM-DD')

        if start_date > end_date:
            raise ValueError('start_date cannot be after end_date')

        return start_date, end_date

    def _scope_bill_queryset(self, request, queryset):
        store_id = self._resolve_scope_store_id(request)
        user = request.user

        if user.role == 'admin' and request.query_params.get('store') and store_id:
            return queryset.filter(store_id=store_id)

        if user.role == 'admin':
            return queryset

        if store_id:
            return queryset.filter(store_id=store_id)

        return queryset.none()

    def _serialize_recent_sales(self, queryset):
        rows = []
        for bill in queryset:
            rows.append({
                'id': bill.id,
                'billNumber': bill.bill_number,
                'invoiceNumber': bill.invoice_number,
                'customerName': bill.customer.name if bill.customer else None,
                'customerId': bill.customer_id,
                'total': float(bill.total),
                'status': bill.status,
                'paymentMethod': bill.payment_method,
                'createdAt': bill.created_at.isoformat(),
            })
        return rows


class DashboardView(ReportBaseMixin, views.APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def get(self, request):
        all_time = request.query_params.get('all_time', 'false').lower() == 'true'

        scoped_completed = self._scope_bill_queryset(
            request,
            Bill.objects.filter(status='completed'),
        )

        today = timezone.localdate()

        if all_time:
            bounds = scoped_completed.aggregate(
                start_date=Min('created_at__date'),
                end_date=Max('created_at__date'),
            )
            start_date = bounds.get('start_date') or today
            end_date = bounds.get('end_date') or today
            bills = scoped_completed.select_related('customer', 'store')
        else:
            try:
                start_date, end_date = self._parse_date_range(request, default_days=30)
            except ValueError as exc:
                return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

            bills = scoped_completed.filter(
                created_at__date__gte=start_date,
                created_at__date__lte=end_date,
            ).select_related('customer', 'store')

        month_start = today.replace(day=1)
        week_start = today - timedelta(days=today.weekday())
        yesterday = today - timedelta(days=1)

        today_sales = self._scope_bill_queryset(
            request,
            Bill.objects.filter(status='completed', created_at__date=today),
        ).aggregate(total=Sum('total')).get('total') or 0

        yesterday_sales = self._scope_bill_queryset(
            request,
            Bill.objects.filter(status='completed', created_at__date=yesterday),
        ).aggregate(total=Sum('total')).get('total') or 0

        week_sales = self._scope_bill_queryset(
            request,
            Bill.objects.filter(status='completed', created_at__date__gte=week_start),
        ).aggregate(total=Sum('total')).get('total') or 0

        month_sales = self._scope_bill_queryset(
            request,
            Bill.objects.filter(status='completed', created_at__date__gte=month_start),
        ).aggregate(total=Sum('total')).get('total') or 0

        stock_levels = StockLevel.objects.select_related('product', 'store')
        scope_store_id = self._resolve_scope_store_id(request)
        if request.user.role == 'admin' and request.query_params.get('store') and scope_store_id:
            stock_levels = stock_levels.filter(store_id=scope_store_id)
        elif request.user.role != 'admin' and scope_store_id:
            stock_levels = stock_levels.filter(store_id=scope_store_id)

        inventory_totals = stock_levels.aggregate(
            total_items=Count('id'),
            low_stock=Count('id', filter=Q(quantity__lte=F('min_stock'))),
            out_of_stock=Count('id', filter=Q(quantity=0)),
            inventory_value=Sum(ExpressionWrapper(F('quantity') * F('product__cost_price'), output_field=DecimalField())),
            overstocked=Count('id', filter=Q(max_stock__isnull=False, quantity__gt=F('max_stock'))),
        )

        recent_sales = bills.order_by('-created_at')[:10]

        top_products = BillItem.objects.filter(
            bill__in=bills,
        ).values('product__name').annotate(
            quantity=Sum('quantity'),
            amount=Sum('total'),
        ).order_by('-amount')[:10]

        sales_over_months = self._scope_bill_queryset(
            request,
            Bill.objects.filter(
                status='completed',
                created_at__date__gte=(today - timedelta(days=180)),
            ),
        ).annotate(month=TruncMonth('created_at')).values('month').annotate(
            value=Sum('total')
        ).order_by('month')

        sales_trend = [
            {
                'period': row['month'].strftime('%b'),
                'value': float(row['value'] or 0),
            }
            for row in sales_over_months
        ]

        category_perf = BillItem.objects.filter(
            bill__in=bills,
            product__category__isnull=False,
        ).values('product__category__name').annotate(
            sales=Sum('total')
        ).order_by('-sales')[:8]

        total_category_sales = sum((row['sales'] or 0) for row in category_perf) or 1
        category_performance = [
            {
                'category': row['product__category__name'],
                'sales': round((float(row['sales']) / float(total_category_sales)) * 100, 2),
            }
            for row in category_perf
        ]

        hour_buckets = self._scope_bill_queryset(
            request,
            Bill.objects.filter(status='completed', created_at__date=today),
        ).annotate(hour=TruncHour('created_at')).values('hour').annotate(
            customers=Count('id')
        ).order_by('hour')

        hourly_traffic = [
            {
                'label': row['hour'].strftime('%I%p').lstrip('0'),
                'customers': row['customers'],
            }
            for row in hour_buckets if row['hour']
        ]

        customer_qs = self._customer_queryset(request)

        total_customers = customer_qs.count()
        new_customers = customer_qs.filter(created_at__date__gte=start_date, created_at__date__lte=end_date).count()

        active_customer_ids = bills.exclude(customer_id__isnull=True).values_list('customer_id', flat=True).distinct()
        active_customers = len(active_customer_ids)

        customer_ltv_avg = customer_qs.aggregate(avg=Avg('total_purchases')).get('avg') or 0

        recent_30_start = end_date - timedelta(days=29)
        prev_30_start = recent_30_start - timedelta(days=30)
        prev_30_end = recent_30_start - timedelta(days=1)

        recent_30_sales = self._scope_bill_queryset(
            request,
            Bill.objects.filter(status='completed', created_at__date__gte=recent_30_start, created_at__date__lte=end_date),
        ).aggregate(total=Sum('total')).get('total') or 0

        prev_30_sales = self._scope_bill_queryset(
            request,
            Bill.objects.filter(status='completed', created_at__date__gte=prev_30_start, created_at__date__lte=prev_30_end),
        ).aggregate(total=Sum('total')).get('total') or 0

        growth_rate = 0.0
        if prev_30_sales:
            growth_rate = ((float(recent_30_sales) - float(prev_30_sales)) / float(prev_30_sales)) * 100

        scoped_items = BillItem.objects.filter(bill__in=bills).select_related('product')
        revenue = scoped_items.aggregate(total=Sum('total')).get('total') or Decimal('0')
        cost = scoped_items.aggregate(total=Sum(ExpressionWrapper(F('quantity') * F('product__cost_price'), output_field=DecimalField()))).get('total') or Decimal('0')
        profit_margin = 0.0
        if revenue:
            profit_margin = ((float(revenue) - float(cost)) / float(revenue)) * 100

        avg_order_value = bills.aggregate(avg=Avg('total')).get('avg') or 0
        total_orders = bills.count()

        inventory_efficiency = 100 - min(100, ((inventory_totals.get('low_stock') or 0) + (inventory_totals.get('out_of_stock') or 0)) * 2)

        forecast_accuracy = max(0.0, 100.0 - abs(growth_rate))

        top_customers = Bill.objects.filter(
            id__in=bills.values('id'),
            customer__isnull=False,
        ).values('customer__id', 'customer__name').annotate(
            purchases=Count('id'),
            amount=Sum('total'),
        ).order_by('-amount')[:10]

        inventory_status = {
            'inStock': max(0, (inventory_totals.get('total_items') or 0) - (inventory_totals.get('low_stock') or 0) - (inventory_totals.get('out_of_stock') or 0)),
            'lowStock': inventory_totals.get('low_stock') or 0,
            'outOfStock': inventory_totals.get('out_of_stock') or 0,
            'overstocked': inventory_totals.get('overstocked') or 0,
        }

        stock_alerts = stock_levels.filter(
            Q(quantity=0) | Q(quantity__lte=F('min_stock'))
        ).order_by('quantity')[:10]

        return Response({
            'meta': {
                'startDate': start_date.strftime('%Y-%m-%d'),
                'endDate': end_date.strftime('%Y-%m-%d'),
                'allTime': all_time,
            },
            'salesSummary': {
                'today': float(today_sales),
                'yesterday': float(yesterday_sales),
                'thisWeek': float(week_sales),
                'thisMonth': float(month_sales),
            },
            'inventorySummary': {
                'totalItems': inventory_totals.get('total_items') or 0,
                'lowStock': inventory_totals.get('low_stock') or 0,
                'outOfStock': inventory_totals.get('out_of_stock') or 0,
                'inventoryValue': float(inventory_totals.get('inventory_value') or 0),
            },
            'recentSales': self._serialize_recent_sales(recent_sales),
            'topProducts': [
                {
                    'productName': row['product__name'],
                    'quantity': float(row['quantity'] or 0),
                    'amount': float(row['amount'] or 0),
                }
                for row in top_products
            ],
            'salesTrend': sales_trend,
            'categoryPerformance': category_performance,
            'hourlyTraffic': hourly_traffic,
            'inventoryStatus': inventory_status,
            'stockAlerts': [
                {
                    'productName': row.product.name,
                    'storeName': row.store.name,
                    'quantity': float(row.quantity),
                    'minStock': float(row.min_stock),
                    'status': 'out_of_stock' if row.quantity == 0 else 'low_stock',
                }
                for row in stock_alerts
            ],
            'customerSummary': {
                'totalCustomers': total_customers,
                'newCustomers': new_customers,
                'activeCustomers': active_customers,
                'customerLifetimeValue': float(customer_ltv_avg),
            },
            'topCustomers': [
                {
                    'customerId': row['customer__id'],
                    'name': row['customer__name'],
                    'purchases': row['purchases'],
                    'amount': float(row['amount'] or 0),
                }
                for row in top_customers
            ],
            'performance': {
                'dailyTarget': 0,
                'monthlyTarget': 0,
                'profitMargin': round(profit_margin, 2),
                'efficiencyScore': round(float(inventory_efficiency), 2),
                'averageOrderValue': float(avg_order_value or 0),
                'totalOrders': total_orders,
            },
            'trendMetrics': {
                'growthRate': round(growth_rate, 2),
                'marketShare': None,
                'seasonalIndex': None,
                'forecastAccuracy': round(float(forecast_accuracy), 2),
            },
        })


class SalesReportView(ReportBaseMixin, views.APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def get(self, request):
        group_by = request.query_params.get('group_by', 'day')
        export = request.query_params.get('export', 'false').lower() == 'true'
        all_time = request.query_params.get('all_time', 'false').lower() == 'true'

        if all_time:
            start_date = None
            end_date = None
        else:
            try:
                start_date, end_date = self._parse_date_range(request, default_days=30)
            except ValueError as exc:
                return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        filters = Q(status='completed')
        if start_date and end_date:
            filters &= Q(
                created_at__date__gte=start_date,
                created_at__date__lte=end_date,
            )

        base_qs = self._scope_bill_queryset(request, Bill.objects.filter(filters))

        if group_by == 'day':
            trunc_func = TruncDate('created_at')
            date_format = '%Y-%m-%d'
        elif group_by == 'week':
            trunc_func = TruncWeek('created_at')
            date_format = 'Week %W, %Y'
        elif group_by == 'month':
            trunc_func = TruncMonth('created_at')
            date_format = '%b %Y'
        else:
            return Response({'detail': 'Invalid group_by parameter. Use day, week, or month'}, status=status.HTTP_400_BAD_REQUEST)

        sales_data = base_qs.annotate(date=trunc_func).values('date').annotate(
            count=Count('id'),
            total_sales=Sum('total'),
            avg_bill_value=Avg('total'),
        ).order_by('date')

        payment_data = Payment.objects.filter(
            bill__in=base_qs,
            status='completed',
        ).values('payment_method').annotate(
            count=Count('id'),
            total=Sum('amount'),
        ).order_by('-total')

        top_products = BillItem.objects.filter(
            bill__in=base_qs,
        ).values('product__name').annotate(
            qty=Sum('quantity'),
            revenue=Sum('total'),
        ).order_by('-revenue')[:10]

        total_sales_value = base_qs.aggregate(total=Sum('total')).get('total') or 0
        bill_count = base_qs.count()

        result = {
            'summary': {
                'start_date': start_date.strftime('%Y-%m-%d') if start_date else None,
                'end_date': end_date.strftime('%Y-%m-%d') if end_date else None,
                'all_time': all_time,
                'total_sales': float(total_sales_value),
                'bill_count': bill_count,
                'average_bill_value': float((total_sales_value / bill_count) if bill_count else 0),
            },
            'sales_over_time': [
                {
                    'date': item['date'].strftime(date_format) if item['date'] else 'Unknown',
                    'count': item['count'],
                    'total': float(item['total_sales'] or 0),
                    'average': float(item['avg_bill_value'] or 0),
                }
                for item in sales_data
            ],
            'payment_methods': [
                {
                    'method': item['payment_method'] or 'Unknown',
                    'count': item['count'],
                    'total': float(item['total'] or 0),
                }
                for item in payment_data
            ],
            'top_products': [
                {
                    'product_name': item['product__name'],
                    'quantity': float(item['qty'] or 0),
                    'revenue': float(item['revenue'] or 0),
                }
                for item in top_products
            ],
        }

        if export:
            response = HttpResponse(content_type='text/csv')
            range_tag = f"{start_date}_{end_date}" if start_date and end_date else "all_time"
            response['Content-Disposition'] = f'attachment; filename="sales_report_{range_tag}.csv"'
            writer = csv.writer(response)
            writer.writerow(['Date', 'Number of Bills', 'Total Sales', 'Average Bill Value'])
            for item in result['sales_over_time']:
                writer.writerow([item['date'], item['count'], item['total'], item['average']])
            writer.writerow([])
            writer.writerow(['Payment Method', 'Number of Payments', 'Total Amount'])
            for item in result['payment_methods']:
                writer.writerow([item['method'], item['count'], item['total']])
            return response

        return Response(result)


class InventoryReportView(ReportBaseMixin, views.APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def get(self, request):
        category_id = request.query_params.get('category')
        low_stock_only = request.query_params.get('low_stock', 'false').lower() == 'true'
        export = request.query_params.get('export', 'false').lower() == 'true'
        try:
            start_date, end_date = self._parse_date_range(request, default_days=30)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        filters = Q()
        scope_store_id = self._resolve_scope_store_id(request)
        if request.user.role == 'admin' and request.query_params.get('store') and scope_store_id:
            filters &= Q(store_id=scope_store_id)
        elif request.user.role != 'admin' and scope_store_id:
            filters &= Q(store_id=scope_store_id)

        if category_id:
            filters &= Q(product__category_id=category_id)

        if low_stock_only:
            filters &= Q(quantity__lte=F('min_stock'))

        inventory_data = StockLevel.objects.filter(filters).select_related('product', 'store', 'product__category')

        range_days = max(1, (end_date - start_date).days + 1)
        result_data = []
        for item in inventory_data:
            sales_in_range = BillItem.objects.filter(
                product=item.product,
                bill__store=item.store,
                bill__status='completed',
                bill__created_at__date__gte=start_date,
                bill__created_at__date__lte=end_date,
            ).aggregate(total=Sum('quantity')).get('total') or 0

            days_remaining = None
            if sales_in_range and float(sales_in_range) > 0:
                daily_sales = float(sales_in_range) / range_days
                if daily_sales > 0:
                    days_remaining = int(float(item.quantity) / daily_sales)

            value = float(item.quantity * item.product.cost_price)
            status_label = 'out_of_stock' if item.quantity == 0 else ('low_stock' if item.quantity <= item.min_stock else 'healthy')

            result_data.append({
                'id': str(item.id),
                'product_id': str(item.product.id),
                'product_name': item.product.name,
                'barcode': item.product.barcode,
                'category': item.product.category.name if item.product.category else None,
                'store_name': item.store.name,
                'quantity': float(item.quantity),
                'min_stock': float(item.min_stock),
                'max_stock': float(item.max_stock) if item.max_stock else None,
                'is_low_stock': item.quantity <= item.min_stock,
                'status': status_label,
                'batch_number': item.batch_number,
                'expiry_date': item.expiry_date.strftime('%Y-%m-%d') if item.expiry_date else None,
                'cost_price': float(item.product.cost_price),
                'sales_price': float(item.product.price),
                'value': value,
                'sales_in_range': float(sales_in_range),
                'days_remaining': days_remaining,
                'updated_at': item.updated_at.strftime('%Y-%m-%d %H:%M:%S'),
            })

        if export:
            response = HttpResponse(content_type='text/csv')
            response['Content-Disposition'] = 'attachment; filename="inventory_report.csv"'
            writer = csv.writer(response)
            writer.writerow([
                'Product', 'Barcode', 'Category', 'Store', 'Quantity', 'Min Stock',
                'Low Stock', 'Status', 'Batch', 'Expiry', 'Cost', 'Price', 'Value',
                f'Sales ({start_date} to {end_date})', 'Days Remaining',
            ])
            for item in result_data:
                writer.writerow([
                    item['product_name'], item['barcode'], item['category'], item['store_name'],
                    item['quantity'], item['min_stock'], 'Yes' if item['is_low_stock'] else 'No',
                    item['status'], item['batch_number'], item['expiry_date'], item['cost_price'],
                    item['sales_price'], item['value'], item['sales_in_range'], item['days_remaining'],
                ])
            return response

        return Response({
            'period': {
                'start_date': start_date.strftime('%Y-%m-%d'),
                'end_date': end_date.strftime('%Y-%m-%d'),
            },
            'inventory': result_data,
            'summary': {
                'total_items': len(result_data),
                'low_stock_items': sum(1 for item in result_data if item['is_low_stock']),
                'out_of_stock_items': sum(1 for item in result_data if item['status'] == 'out_of_stock'),
                'total_value': sum(item['value'] for item in result_data),
                'range_days': range_days,
            },
        })


class CustomerReportView(ReportBaseMixin, views.APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def get(self, request):
        export = request.query_params.get('export', 'false').lower() == 'true'
        all_time = request.query_params.get('all_time', 'false').lower() == 'true'

        if all_time:
            start_date = None
            end_date = None
        else:
            try:
                start_date, end_date = self._parse_date_range(request, default_days=90)
            except ValueError as exc:
                return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        bill_filters = Q(status='completed', customer__isnull=False)
        if start_date and end_date:
            bill_filters &= Q(
                created_at__date__gte=start_date,
                created_at__date__lte=end_date,
            )

        bill_qs = self._scope_bill_queryset(request, Bill.objects.filter(bill_filters))

        customer_purchase_data = bill_qs.values('customer__id', 'customer__name').annotate(
            purchase_count=Count('id'),
            purchase_total=Sum('total'),
            average_purchase=Avg('total'),
        ).order_by('-purchase_total')

        purchase_data_list = [
            {
                'customer_id': row['customer__id'],
                'customer_name': row['customer__name'],
                'purchase_count': row['purchase_count'],
                'purchase_total': float(row['purchase_total'] or 0),
                'average_purchase': float(row['average_purchase'] or 0),
            }
            for row in customer_purchase_data
        ]

        customer_ids = [row['customer_id'] for row in purchase_data_list]
        base_customers = self._customer_queryset(request)

        total_customers = base_customers.count()
        active_customers = len(set(customer_ids))
        if start_date and end_date:
            new_customers = base_customers.filter(created_at__date__gte=start_date, created_at__date__lte=end_date).count()
        else:
            new_customers = total_customers

        loyalty_data = base_customers.aggregate(total_points=Sum('loyalty_points'), avg_points=Avg('loyalty_points'))

        if export:
            response = HttpResponse(content_type='text/csv')
            range_tag = f"{start_date}_{end_date}" if start_date and end_date else "all_time"
            response['Content-Disposition'] = f'attachment; filename="customer_report_{range_tag}.csv"'
            writer = csv.writer(response)
            writer.writerow(['Customer Name', 'Number of Purchases', 'Total Spent', 'Average Purchase'])
            for item in purchase_data_list:
                writer.writerow([item['customer_name'], item['purchase_count'], item['purchase_total'], item['average_purchase']])
            return response

        return Response({
            'summary': {
                'total_customers': total_customers,
                'active_customers': active_customers,
                'new_customers': new_customers,
                'period': {
                    'start_date': start_date.strftime('%Y-%m-%d') if start_date else None,
                    'end_date': end_date.strftime('%Y-%m-%d') if end_date else None,
                    'all_time': all_time,
                },
            },
            'purchase_data': purchase_data_list,
            'top_customers': purchase_data_list[:10],
            'loyalty': {
                'total_points': loyalty_data['total_points'] or 0,
                'average_points_per_customer': float(loyalty_data['avg_points'] or 0),
            },
        })


class TaxReportView(ReportBaseMixin, views.APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def get(self, request):
        export = request.query_params.get('export', 'false').lower() == 'true'

        try:
            start_date, end_date = self._parse_date_range(request, default_days=30)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        bill_qs = self._scope_bill_queryset(
            request,
            Bill.objects.filter(
                created_at__date__gte=start_date,
                created_at__date__lte=end_date,
                status='completed',
            ),
        )

        tax_data = BillItem.objects.filter(
            bill__in=bill_qs
        ).values('tax_rate').annotate(
            taxable_value=Sum(ExpressionWrapper(F('price') * F('quantity'), output_field=DecimalField())),
            tax_amount=Sum('tax_amount'),
        ).order_by('tax_rate')

        total_taxable = 0.0
        total_tax = 0.0
        tax_summary = []
        for item in tax_data:
            taxable_value = float(item['taxable_value'] or 0)
            tax_amount = float(item['tax_amount'] or 0)
            total_taxable += taxable_value
            total_tax += tax_amount
            tax_summary.append({
                'tax_rate': item['tax_rate'],
                'taxable_value': taxable_value,
                'tax_amount': tax_amount,
            })

        if export:
            response = HttpResponse(content_type='text/csv')
            response['Content-Disposition'] = f'attachment; filename="tax_report_{start_date}_{end_date}.csv"'
            writer = csv.writer(response)
            writer.writerow(['Tax Rate', 'Taxable Value', 'Tax Amount'])
            for item in tax_summary:
                writer.writerow([f"{item['tax_rate']}%", item['taxable_value'], item['tax_amount']])
            writer.writerow([])
            writer.writerow(['Total', total_taxable, total_tax])
            return response

        return Response({
            'period': {
                'start_date': start_date.strftime('%Y-%m-%d'),
                'end_date': end_date.strftime('%Y-%m-%d'),
            },
            'summary': {
                'total_taxable_value': total_taxable,
                'total_tax_collected': total_tax,
            },
            'tax_rates': tax_summary,
        })


class StoreBootstrapExportView(ReportBaseMixin, views.APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: OpenApiTypes.BINARY})
    def get(self, request):
        store_id = self._resolve_scope_store_id(request)
        if not store_id:
            return Response({'detail': 'No store available for export.'}, status=status.HTTP_400_BAD_REQUEST)

        store = Store.objects.filter(id=store_id).first()
        if not store:
            return Response({'detail': 'Store not found.'}, status=status.HTTP_404_NOT_FOUND)

        def _dt(v):
            if not v:
                return None
            try:
                return v.isoformat(sep=' ', timespec='seconds')
            except TypeError:
                return str(v)

        def _date(v):
            return v.isoformat() if v else None

        stock_levels = StockLevel.objects.filter(store=store).select_related('product__category__parent', 'product')
        inventory_rows = []
        for sl in stock_levels:
            category = sl.product.category
            category_name = None
            sub_category_name = None
            if category:
                if category.parent:
                    category_name = category.parent.name
                    sub_category_name = category.name
                else:
                    category_name = category.name

            image_name = None
            if sl.product.image:
                image_name = str(sl.product.image.name).split('/')[-1]

            inventory_rows.append({
                'product_name': sl.product.name,
                'barcode': sl.product.barcode,
                'category': category_name,
                'sub_category': sub_category_name,
                'description': sl.product.description,
                'price': float(sl.product.price or 0),
                'cost_price': float(sl.product.cost_price or 0),
                'discount_price': float(sl.product.discount_price) if sl.product.discount_price is not None else None,
                'tax': int(sl.product.tax or 0),
                'hsn_code': sl.product.hsn_code,
                'unit': sl.product.unit,
                'weight': float(sl.product.weight) if sl.product.weight is not None else None,
                'is_active': bool(sl.product.is_active),
                'is_featured': bool(sl.product.is_featured),
                'is_service': bool(sl.product.is_service),
                'image_filename': image_name,
                'batch_number': sl.batch_number,
                'expiry_date': _date(sl.expiry_date),
                'quantity': float(sl.quantity or 0),
                'min_stock': float(sl.min_stock or 0),
                'max_stock': float(sl.max_stock) if sl.max_stock is not None else None,
            })

        store_bills = Bill.objects.filter(store=store).select_related('customer', 'cashier')
        customer_ids = store_bills.exclude(customer_id__isnull=True).values_list('customer_id', flat=True).distinct()
        customers = Customer.objects.filter(id__in=customer_ids)
        customer_rows = [
            {
                'name': c.name,
                'phone': c.phone,
                'email': c.email,
                'address': c.address,
                'city': c.city,
                'state': c.state,
                'pincode': c.pincode,
                'loyalty_points': c.loyalty_points,
                'total_purchases': float(c.total_purchases or 0),
                'last_purchase': _date(c.last_purchase),
                'gst_number': c.gst_number,
                'pan_number': c.pan_number,
                'birthdate': _date(c.birthdate),
                'anniversary': _date(c.anniversary),
                'notes': c.notes,
            }
            for c in customers
        ]

        sales_rows = [
            {
                'bill_number': b.bill_number,
                'invoice_number': b.invoice_number,
                'customer_phone': b.customer.phone if b.customer else None,
                'subtotal': float(b.subtotal or 0),
                'tax_total': float(b.tax_total or 0),
                'discount': float(b.discount or 0),
                'round_off': float(b.round_off or 0),
                'total': float(b.total or 0),
                'payment_status': b.payment_status,
                'payment_method': b.payment_method,
                'status': b.status,
                'notes': b.notes,
                'completed_at': _dt(b.completed_at or b.created_at),
            }
            for b in store_bills
        ]

        sales_items = BillItem.objects.filter(bill__store=store).select_related('bill', 'product')
        sales_item_rows = [
            {
                'bill_number': item.bill.bill_number,
                'product_barcode': item.product.barcode,
                'product_name': item.product.name,
                'quantity': float(item.quantity or 0),
                'price': float(item.price or 0),
                'tax_rate': float(item.tax_rate or 0),
                'discount_rate': float(item.discount_rate or 0),
                'total': float(item.total or 0),
            }
            for item in sales_items
        ]

        payment_rows = [
            {
                'bill_number': p.bill.bill_number,
                'amount': float(p.amount or 0),
                'payment_method': p.payment_method,
                'transaction_id': p.transaction_id,
                'status': p.status,
            }
            for p in Payment.objects.filter(bill__store=store).select_related('bill')
        ]

        purchase_orders = PurchaseOrder.objects.filter(store=store).select_related('supplier')
        supplier_ids = set(purchase_orders.values_list('supplier_id', flat=True))
        grns = GoodsReceiptNote.objects.filter(store=store).select_related('supplier', 'purchase_order')
        supplier_ids.update(grns.values_list('supplier_id', flat=True))
        supplier_invoices = SupplierInvoice.objects.filter(store=store).select_related('supplier', 'purchase_order', 'grn')
        supplier_ids.update(supplier_invoices.values_list('supplier_id', flat=True))

        suppliers = Supplier.objects.filter(id__in=[sid for sid in supplier_ids if sid])
        supplier_rows = [
            {
                'name': s.name,
                'contact_person': s.contact_person,
                'phone': s.phone,
                'email': s.email,
                'address': s.address,
                'city': s.city,
                'state': s.state,
                'pincode': s.pincode,
                'gst_number': s.gst_number,
                'pan_number': s.pan_number,
                'credit_period': s.credit_period,
                'credit_limit': float(s.credit_limit or 0),
                'current_balance': float(s.current_balance or 0),
                'notes': s.notes,
                'is_active': bool(s.is_active),
            }
            for s in suppliers
        ]

        po_rows = [
            {
                'po_number': po.po_number,
                'supplier_name': po.supplier.name if po.supplier else None,
                'supplier_phone': po.supplier.phone if po.supplier else None,
                'order_date': _date(po.order_date),
                'expected_delivery_date': _date(po.expected_delivery_date),
                'status': po.status,
                'payment_status': po.payment_status,
                'shipping_charges': float(po.shipping_charges or 0),
                'notes': po.notes,
                'terms': po.terms,
            }
            for po in purchase_orders
        ]

        po_item_rows = [
            {
                'po_number': item.purchase_order.po_number,
                'product_barcode': item.product.barcode if item.product else None,
                'product_name': item.product.name if item.product else None,
                'quantity_ordered': float(item.quantity_ordered or 0),
                'quantity_received': float(item.quantity_received or 0),
                'unit_price': float(item.unit_price or 0),
                'tax_rate': float(item.tax_rate or 0),
                'discount_percentage': float(item.discount_percentage or 0),
                'expected_delivery_date': _date(item.expected_delivery_date),
            }
            for item in PurchaseOrderItem.objects.filter(purchase_order__store=store).select_related('purchase_order', 'product')
        ]

        grn_rows = [
            {
                'grn_number': g.grn_number,
                'po_number': g.purchase_order.po_number if g.purchase_order else None,
                'supplier_name': g.supplier.name if g.supplier else None,
                'supplier_phone': g.supplier.phone if g.supplier else None,
                'receipt_date': _date(g.receipt_date),
                'invoice_number': g.invoice_number,
                'invoice_date': _date(g.invoice_date),
                'status': g.status,
                'shipping_charges': float(g.shipping_charges or 0),
                'notes': g.notes,
            }
            for g in grns
        ]

        grn_item_rows = [
            {
                'grn_number': item.grn.grn_number,
                'product_barcode': item.product.barcode if item.product else None,
                'product_name': item.product.name if item.product else None,
                'quantity': float(item.quantity or 0),
                'unit_price': float(item.unit_price or 0),
                'tax_rate': float(item.tax_rate or 0),
                'discount_percentage': float(item.discount_percentage or 0),
                'batch_number': item.batch_number,
                'expiry_date': _date(item.expiry_date),
            }
            for item in GoodsReceiptNoteItem.objects.filter(grn__store=store).select_related('grn', 'product')
        ]

        supplier_invoice_rows = [
            {
                'invoice_number': inv.invoice_number,
                'supplier_invoice_number': inv.supplier_invoice_number,
                'supplier_name': inv.supplier.name if inv.supplier else inv.supplier_name,
                'supplier_phone': inv.supplier.phone if inv.supplier else None,
                'po_number': inv.po_number,
                'grn_number': inv.grn_number,
                'invoice_date': _date(inv.invoice_date),
                'due_date': _date(inv.due_date),
                'status': inv.status,
                'payment_terms': inv.payment_terms,
                'subtotal': float(inv.subtotal or 0),
                'discount_total': float(inv.discount_total or 0),
                'tax_total': float(inv.tax_total or 0),
                'shipping_charges': float(inv.shipping_charges or 0),
                'grand_total': float(inv.grand_total or 0),
                'notes': inv.notes,
            }
            for inv in supplier_invoices
        ]

        supplier_invoice_item_rows = [
            {
                'invoice_number': item.invoice.invoice_number,
                'product_code': item.product_code or (item.product_ref.barcode if item.product_ref else None),
                'product_barcode': item.product_ref.barcode if item.product_ref else None,
                'product_name': item.product_name,
                'quantity': float(item.quantity or 0),
                'unit_price': float(item.unit_price or 0),
                'discount': float(item.discount or 0),
                'discount_type': item.discount_type,
                'tax_rate': float(item.tax_rate or 0),
            }
            for item in SupplierInvoiceItem.objects.filter(invoice__store=store).select_related('invoice', 'product_ref')
        ]

        supplier_payment_qs = SupplierPayment.objects.filter(
            Q(purchase_order__store=store) | Q(supplier_invoice__store=store)
        ).select_related('supplier', 'purchase_order', 'supplier_invoice').distinct()
        supplier_payment_rows = [
            {
                'supplier_name': pay.supplier.name if pay.supplier else None,
                'supplier_phone': pay.supplier.phone if pay.supplier else None,
                'po_number': pay.purchase_order.po_number if pay.purchase_order else None,
                'invoice_number': pay.supplier_invoice.invoice_number if pay.supplier_invoice else None,
                'amount': float(pay.amount or 0),
                'payment_method': pay.payment_method,
                'reference_number': pay.reference_number,
                'payment_date': _date(pay.payment_date),
                'status': pay.status,
                'notes': pay.notes,
            }
            for pay in supplier_payment_qs
        ]

        sheet_columns = {
            'inventory': ['product_name', 'barcode', 'category', 'sub_category', 'description', 'price', 'cost_price', 'discount_price', 'tax', 'hsn_code', 'unit', 'weight', 'is_active', 'is_featured', 'is_service', 'image_filename', 'batch_number', 'expiry_date', 'quantity', 'min_stock', 'max_stock'],
            'customers': ['name', 'phone', 'email', 'address', 'city', 'state', 'pincode', 'loyalty_points', 'total_purchases', 'last_purchase', 'gst_number', 'pan_number', 'birthdate', 'anniversary', 'notes'],
            'sales': ['bill_number', 'invoice_number', 'customer_phone', 'subtotal', 'tax_total', 'discount', 'round_off', 'total', 'payment_status', 'payment_method', 'status', 'notes', 'completed_at'],
            'sales_items': ['bill_number', 'product_barcode', 'product_name', 'quantity', 'price', 'tax_rate', 'discount_rate', 'total'],
            'payments': ['bill_number', 'amount', 'payment_method', 'transaction_id', 'status'],
            'suppliers': ['name', 'contact_person', 'phone', 'email', 'address', 'city', 'state', 'pincode', 'gst_number', 'pan_number', 'credit_period', 'credit_limit', 'current_balance', 'notes', 'is_active'],
            'purchase_orders': ['po_number', 'supplier_name', 'supplier_phone', 'order_date', 'expected_delivery_date', 'status', 'payment_status', 'shipping_charges', 'notes', 'terms'],
            'purchase_order_items': ['po_number', 'product_barcode', 'product_name', 'quantity_ordered', 'quantity_received', 'unit_price', 'tax_rate', 'discount_percentage', 'expected_delivery_date'],
            'grn': ['grn_number', 'po_number', 'supplier_name', 'supplier_phone', 'receipt_date', 'invoice_number', 'invoice_date', 'status', 'shipping_charges', 'notes'],
            'grn_items': ['grn_number', 'product_barcode', 'product_name', 'quantity', 'unit_price', 'tax_rate', 'discount_percentage', 'batch_number', 'expiry_date'],
            'supplier_invoices': ['invoice_number', 'supplier_invoice_number', 'supplier_name', 'supplier_phone', 'po_number', 'grn_number', 'invoice_date', 'due_date', 'status', 'payment_terms', 'subtotal', 'discount_total', 'tax_total', 'shipping_charges', 'grand_total', 'notes'],
            'supplier_invoice_items': ['invoice_number', 'product_code', 'product_barcode', 'product_name', 'quantity', 'unit_price', 'discount', 'discount_type', 'tax_rate'],
            'supplier_payments': ['supplier_name', 'supplier_phone', 'po_number', 'invoice_number', 'amount', 'payment_method', 'reference_number', 'payment_date', 'status', 'notes'],
        }

        sheets_data = {
            'inventory': inventory_rows,
            'customers': customer_rows,
            'sales': sales_rows,
            'sales_items': sales_item_rows,
            'payments': payment_rows,
            'suppliers': supplier_rows,
            'purchase_orders': po_rows,
            'purchase_order_items': po_item_rows,
            'grn': grn_rows,
            'grn_items': grn_item_rows,
            'supplier_invoices': supplier_invoice_rows,
            'supplier_invoice_items': supplier_invoice_item_rows,
            'supplier_payments': supplier_payment_rows,
        }

        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            for sheet_name, columns in sheet_columns.items():
                rows = sheets_data.get(sheet_name, [])
                df = pd.DataFrame(rows, columns=columns)
                df.to_excel(writer, sheet_name=sheet_name, index=False)

        output.seek(0)
        response = HttpResponse(
            output.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = (
            f'attachment; filename="store_bootstrap_live_{store.code}_{timezone.now().strftime("%Y%m%d_%H%M%S")}.xlsx"'
        )
        return response
