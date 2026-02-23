from datetime import datetime, timedelta
import csv
from decimal import Decimal

from django.db import connection
from django.db.models import Avg, Count, F, Q, Sum, DecimalField, ExpressionWrapper
from django.db.models.functions import TruncDate, TruncMonth, TruncWeek, TruncHour
from django.http import HttpResponse
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import status, views
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.permissions import IsManagerUser
from customers.models import Customer
from inventory.models import StockLevel
from sales.models import Bill, BillItem, Payment


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

        store_id = request.query_params.get('store')
        if request.user.role == 'admin' and store_id:
            queryset = queryset.filter(bills__store_id=store_id).distinct()
        elif request.user.role != 'admin' and request.user.store_id:
            queryset = queryset.filter(bills__store_id=request.user.store_id).distinct()

        return queryset

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
        store_id = request.query_params.get('store')
        user = request.user

        if user.role == 'admin' and store_id:
            return queryset.filter(store_id=store_id)

        if user.role == 'admin':
            return queryset

        if user.store_id:
            return queryset.filter(store_id=user.store_id)

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
        try:
            start_date, end_date = self._parse_date_range(request, default_days=30)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        bills = Bill.objects.filter(
            status='completed',
            created_at__date__gte=start_date,
            created_at__date__lte=end_date,
        ).select_related('customer', 'store')
        bills = self._scope_bill_queryset(request, bills)

        today = timezone.localdate()
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
        if request.user.role != 'admin' and request.user.store_id:
            stock_levels = stock_levels.filter(store_id=request.user.store_id)
        elif request.user.role == 'admin' and request.query_params.get('store'):
            stock_levels = stock_levels.filter(store_id=request.query_params.get('store'))

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
            bill__created_at__date__gte=max(start_date, end_date - timedelta(days=30)),
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
    permission_classes = [IsAuthenticated, IsManagerUser]

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def get(self, request):
        group_by = request.query_params.get('group_by', 'day')
        export = request.query_params.get('export', 'false').lower() == 'true'

        try:
            start_date, end_date = self._parse_date_range(request, default_days=30)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        filters = Q(
            created_at__date__gte=start_date,
            created_at__date__lte=end_date,
            status='completed',
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
                'start_date': start_date.strftime('%Y-%m-%d'),
                'end_date': end_date.strftime('%Y-%m-%d'),
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
            response['Content-Disposition'] = f'attachment; filename="sales_report_{start_date}_{end_date}.csv"'
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
    permission_classes = [IsAuthenticated, IsManagerUser]

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def get(self, request):
        category_id = request.query_params.get('category')
        low_stock_only = request.query_params.get('low_stock', 'false').lower() == 'true'
        export = request.query_params.get('export', 'false').lower() == 'true'

        filters = Q()
        if request.user.role == 'admin' and request.query_params.get('store'):
            filters &= Q(store_id=request.query_params.get('store'))
        elif request.user.store_id:
            filters &= Q(store_id=request.user.store_id)

        if category_id:
            filters &= Q(product__category_id=category_id)

        if low_stock_only:
            filters &= Q(quantity__lte=F('min_stock'))

        inventory_data = StockLevel.objects.filter(filters).select_related('product', 'store', 'product__category')

        thirty_days_ago = timezone.now() - timedelta(days=30)
        result_data = []
        for item in inventory_data:
            sales_30_days = BillItem.objects.filter(
                product=item.product,
                bill__store=item.store,
                bill__status='completed',
                bill__created_at__gte=thirty_days_ago,
            ).aggregate(total=Sum('quantity')).get('total') or 0

            days_remaining = None
            if sales_30_days and float(sales_30_days) > 0:
                daily_sales = float(sales_30_days) / 30
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
                'sales_30_days': float(sales_30_days),
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
                'Sales (30d)', 'Days Remaining',
            ])
            for item in result_data:
                writer.writerow([
                    item['product_name'], item['barcode'], item['category'], item['store_name'],
                    item['quantity'], item['min_stock'], 'Yes' if item['is_low_stock'] else 'No',
                    item['status'], item['batch_number'], item['expiry_date'], item['cost_price'],
                    item['sales_price'], item['value'], item['sales_30_days'], item['days_remaining'],
                ])
            return response

        return Response({
            'inventory': result_data,
            'summary': {
                'total_items': len(result_data),
                'low_stock_items': sum(1 for item in result_data if item['is_low_stock']),
                'out_of_stock_items': sum(1 for item in result_data if item['status'] == 'out_of_stock'),
                'total_value': sum(item['value'] for item in result_data),
            },
        })


class CustomerReportView(ReportBaseMixin, views.APIView):
    permission_classes = [IsAuthenticated, IsManagerUser]

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def get(self, request):
        export = request.query_params.get('export', 'false').lower() == 'true'

        try:
            start_date, end_date = self._parse_date_range(request, default_days=90)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        bill_qs = self._scope_bill_queryset(
            request,
            Bill.objects.filter(
                created_at__date__gte=start_date,
                created_at__date__lte=end_date,
                status='completed',
                customer__isnull=False,
            ),
        )

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
        new_customers = base_customers.filter(created_at__date__gte=start_date, created_at__date__lte=end_date).count()

        loyalty_data = base_customers.aggregate(total_points=Sum('loyalty_points'), avg_points=Avg('loyalty_points'))

        if export:
            response = HttpResponse(content_type='text/csv')
            response['Content-Disposition'] = f'attachment; filename="customer_report_{start_date}_{end_date}.csv"'
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
                    'start_date': start_date.strftime('%Y-%m-%d'),
                    'end_date': end_date.strftime('%Y-%m-%d'),
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
    permission_classes = [IsAuthenticated, IsManagerUser]

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
