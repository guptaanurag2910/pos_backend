from rest_framework import views, status, viewsets
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Sum, Count, F, Q, Avg
from django.db.models.functions import TruncDate, TruncMonth, TruncDay, TruncWeek
from django.utils import timezone

from accounts.permissions import IsManagerUser
from sales.models import Bill, BillItem
from inventory.models import Product, Category, StockLevel
from customers.models import Customer
from datetime import datetime, timedelta
import csv
from django.http import HttpResponse

class DashboardView(views.APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        user = request.user
        store = user.store
        
        # Filter by store if user has a store
        store_filter = Q(store=store) if store else Q()
        
        # Get date ranges
        today = timezone.now().date()
        yesterday = today - timedelta(days=1)
        week_start = today - timedelta(days=today.weekday())
        month_start = today.replace(day=1)
        
        # Get sales data
        today_sales = Bill.objects.filter(
            store_filter,
            status='completed',
            created_at__date=today
        ).aggregate(total=Sum('total'))
        
        yesterday_sales = Bill.objects.filter(
            store_filter,
            status='completed',
            created_at__date=yesterday
        ).aggregate(total=Sum('total'))
        
        week_sales = Bill.objects.filter(
            store_filter,
            status='completed',
            created_at__date__gte=week_start
        ).aggregate(total=Sum('total'))
        
        month_sales = Bill.objects.filter(
            store_filter,
            status='completed',
            created_at__date__gte=month_start
        ).aggregate(total=Sum('total'))
        
        # Get inventory summary
        all_products = Product.objects.count()
        
        if store:
            low_stock = StockLevel.objects.filter(
                store=store,
                quantity__lte=F('min_stock')
            ).count()
            
            out_of_stock = StockLevel.objects.filter(
                store=store,
                quantity=0
            ).count()
        else:
            low_stock = StockLevel.objects.filter(
                quantity__lte=F('min_stock')
            ).count()
            
            out_of_stock = StockLevel.objects.filter(
                quantity=0
            ).count()
        
        # Get recent sales
        recent_sales = Bill.objects.filter(
            store_filter,
            status='completed'
        ).order_by('-created_at')[:10]
        
        from sales.serializers import BillSerializer
        recent_sales_data = BillSerializer(recent_sales, many=True, context={'request': request}).data
        
        # Get top products
        today_minus_30 = today - timedelta(days=30)
        top_products = BillItem.objects.filter(
            bill__store_filter,
            bill__status='completed',
            bill__created_at__date__gte=today_minus_30
        ).values('product__name').annotate(
            quantity=Sum('quantity'),
            amount=Sum('total')
        ).order_by('-amount')[:10]
        
        # Convert decimal values to float for JSON serialization
        top_products_data = []
        for product in top_products:
            top_products_data.append({
                'productName': product['product__name'],
                'quantity': float(product['quantity']),
                'amount': float(product['amount'])
            })
        
        return Response({
            'salesSummary': {
                'today': float(today_sales.get('total') or 0),
                'yesterday': float(yesterday_sales.get('total') or 0),
                'thisWeek': float(week_sales.get('total') or 0),
                'thisMonth': float(month_sales.get('total') or 0)
            },
            'inventorySummary': {
                'totalItems': all_products,
                'lowStock': low_stock,
                'outOfStock': out_of_stock
            },
            'recentSales': recent_sales_data,
            'topProducts': top_products_data
        })

class SalesReportView(views.APIView):
    permission_classes = [IsAuthenticated, IsManagerUser]
    
    def get(self, request):
        # Get parameters
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        group_by = request.query_params.get('group_by', 'day')
        store_id = request.query_params.get('store')
        export = request.query_params.get('export', 'false').lower() == 'true'
        
        # Validate parameters
        try:
            if start_date:
                start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
            else:
                start_date = timezone.now().date() - timedelta(days=30)
            
            if end_date:
                end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
            else:
                end_date = timezone.now().date()
        except ValueError:
            return Response(
                {"detail": "Invalid date format. Use YYYY-MM-DD"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Filter by date range and store
        filters = Q(
            created_at__date__gte=start_date,
            created_at__date__lte=end_date,
            status='completed'
        )
        
        if store_id:
            filters &= Q(store_id=store_id)
        elif request.user.store:
            filters &= Q(store=request.user.store)
        
        # Group data by specified interval
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
            return Response(
                {"detail": "Invalid group_by parameter. Use day, week, or month"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get sales data grouped by interval
        sales_data = Bill.objects.filter(filters).annotate(
            date=trunc_func
        ).values('date').annotate(
            count=Count('id'),
            total_sales=Sum('total'),
            avg_bill_value=Avg('total')
        ).order_by('date')
        
        # Get payment method breakdown
        payment_data = Bill.objects.filter(filters).values(
            'payment_method'
        ).annotate(
            count=Count('id'),
            total=Sum('total')
        ).order_by('-total')
        
        # Prepare the response data
        result = {
            'summary': {
                'start_date': start_date.strftime('%Y-%m-%d'),
                'end_date': end_date.strftime('%Y-%m-%d'),
                'total_sales': float(Bill.objects.filter(filters).aggregate(Sum('total'))['total__sum'] or 0),
                'bill_count': Bill.objects.filter(filters).count(),
            },
            'sales_over_time': [
                {
                    'date': item['date'].strftime(date_format) if item['date'] else 'Unknown',
                    'count': item['count'],
                    'total': float(item['total_sales']),
                    'average': float(item['avg_bill_value'])
                }
                for item in sales_data
            ],
            'payment_methods': [
                {
                    'method': item['payment_method'] or 'Unknown',
                    'count': item['count'],
                    'total': float(item['total'])
                }
                for item in payment_data
            ]
        }
        
        if export:
            # Create CSV response
            response = HttpResponse(content_type='text/csv')
            response['Content-Disposition'] = f'attachment; filename="sales_report_{start_date}_{end_date}.csv"'
            
            writer = csv.writer(response)
            writer.writerow(['Date', 'Number of Bills', 'Total Sales', 'Average Bill Value'])
            
            for item in result['sales_over_time']:
                writer.writerow([
                    item['date'],
                    item['count'],
                    item['total'],
                    item['average']
                ])
            
            writer.writerow([])
            writer.writerow(['Payment Method', 'Number of Bills', 'Total Amount'])
            
            for item in result['payment_methods']:
                writer.writerow([
                    item['method'],
                    item['count'],
                    item['total']
                ])
            
            return response
        
        return Response(result)

class InventoryReportView(views.APIView):
    permission_classes = [IsAuthenticated, IsManagerUser]
    
    def get(self, request):
        store_id = request.query_params.get('store')
        category_id = request.query_params.get('category')
        low_stock_only = request.query_params.get('low_stock', 'false').lower() == 'true'
        export = request.query_params.get('export', 'false').lower() == 'true'
        
        # Filter by store and category
        filters = Q()
        
        if store_id:
            filters &= Q(store_id=store_id)
        elif request.user.store:
            filters &= Q(store=request.user.store)
        
        if category_id:
            filters &= Q(product__category_id=category_id)
        
        if low_stock_only:
            filters &= Q(quantity__lte=F('min_stock'))
        
        # Get inventory data
        from inventory.models import StockLevel
        inventory_data = StockLevel.objects.filter(filters).select_related('product', 'store')
        
        # For calculation efficiency, let's get the sales data for these products
        from django.db.models import OuterRef, Subquery
        
        # Get last 30 day sales for each product
        thirty_days_ago = timezone.now() - timedelta(days=30)
        sales_subquery = BillItem.objects.filter(
            product=OuterRef('product'),
            bill__store=OuterRef('store'),
            bill__status='completed',
            bill__created_at__gte=thirty_days_ago
        ).values('product').annotate(
            total_sold=Sum('quantity')
        ).values('total_sold')
        
        # Add the sales data to our queryset
        inventory_data = inventory_data.annotate(
            sales_30_days=Subquery(sales_subquery)
        )
        
        from inventory.serializers import StockLevelSerializer
        inventory_serialized = StockLevelSerializer(inventory_data, many=True, context={'request': request}).data
        
        # Add computed fields for each item
        result_data = []
        for item in inventory_data:
            sales_30_days = item.sales_30_days or 0
            
            # Calculate days of inventory remaining based on sales velocity
            days_remaining = None
            if sales_30_days > 0:
                daily_sales = sales_30_days / 30
                if daily_sales > 0:
                    days_remaining = int(item.quantity / daily_sales)
            
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
                'is_low_stock': item.is_low_stock,
                'batch_number': item.batch_number,
                'expiry_date': item.expiry_date.strftime('%Y-%m-%d') if item.expiry_date else None,
                'cost_price': float(item.product.cost_price),
                'sales_price': float(item.product.price),
                'value': float(item.quantity * item.product.cost_price),
                'sales_30_days': float(sales_30_days),
                'days_remaining': days_remaining,
                'updated_at': item.updated_at.strftime('%Y-%m-%d %H:%M:%S')
            })
        
        if export:
            # Create CSV response
            response = HttpResponse(content_type='text/csv')
            response['Content-Disposition'] = 'attachment; filename="inventory_report.csv"'
            
            writer = csv.writer(response)
            writer.writerow([
                'Product', 'Barcode', 'Category', 'Store', 'Quantity', 'Min Stock', 
                'Low Stock', 'Batch', 'Expiry', 'Cost', 'Price', 'Value',
                'Sales (30d)', 'Days Remaining'
            ])
            
            for item in result_data:
                writer.writerow([
                    item['product_name'],
                    item['barcode'],
                    item['category'],
                    item['store_name'],
                    item['quantity'],
                    item['min_stock'],
                    'Yes' if item['is_low_stock'] else 'No',
                    item['batch_number'],
                    item['expiry_date'],
                    item['cost_price'],
                    item['sales_price'],
                    item['value'],
                    item['sales_30_days'],
                    item['days_remaining']
                ])
            
            return response
        
        return Response({
            'inventory': result_data,
            'summary': {
                'total_items': len(result_data),
                'low_stock_items': sum(1 for item in result_data if item['is_low_stock']),
                'total_value': sum(item['value'] for item in result_data)
            }
        })

class CustomerReportView(views.APIView):
    permission_classes = [IsAuthenticated, IsManagerUser]
    
    def get(self, request):
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        export = request.query_params.get('export', 'false').lower() == 'true'
        
        # Validate parameters
        try:
            if start_date:
                start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
            else:
                start_date = timezone.now().date() - timedelta(days=90)
            
            if end_date:
                end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
            else:
                end_date = timezone.now().date()
        except ValueError:
            return Response(
                {"detail": "Invalid date format. Use YYYY-MM-DD"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get active customers (customers who made purchases in date range)
        date_filters = Q(
            bills__created_at__date__gte=start_date,
            bills__created_at__date__lte=end_date,
            bills__status='completed'
        )
        
        # Apply store filter if user has a store
        if request.user.store:
            date_filters &= Q(bills__store=request.user.store)
        
        active_customers = Customer.objects.filter(date_filters).distinct()
        
        # Get new customers in period
        new_customers = Customer.objects.filter(
            created_at__date__gte=start_date,
            created_at__date__lte=end_date
        )
        
        # Get customer purchase data
        customer_purchase_data = Bill.objects.filter(
            created_at__date__gte=start_date,
            created_at__date__lte=end_date,
            status='completed',
            customer__isnull=False
        ).values('customer__id', 'customer__name').annotate(
            purchase_count=Count('id'),
            purchase_total=Sum('total'),
            average_purchase=Avg('total')
        ).order_by('-purchase_total')
        
        if request.user.store:
            customer_purchase_data = customer_purchase_data.filter(store=request.user.store)
        
        # Convert data for response
        purchase_data_list = []
        for item in customer_purchase_data:
            purchase_data_list.append({
                'customer_id': item['customer__id'],
                'customer_name': item['customer__name'],
                'purchase_count': item['purchase_count'],
                'purchase_total': float(item['purchase_total']),
                'average_purchase': float(item['average_purchase'])
            })
        
        # Get loyalty metrics
        loyalty_data = Customer.objects.aggregate(
            total_points=Sum('loyalty_points'),
            avg_points=Avg('loyalty_points')
        )
        
        if export:
            # Create CSV response
            response = HttpResponse(content_type='text/csv')
            response['Content-Disposition'] = f'attachment; filename="customer_report_{start_date}_{end_date}.csv"'
            
            writer = csv.writer(response)
            writer.writerow([
                'Customer Name', 'Number of Purchases', 'Total Spent', 'Average Purchase'
            ])
            
            for item in purchase_data_list:
                writer.writerow([
                    item['customer_name'],
                    item['purchase_count'],
                    item['purchase_total'],
                    item['average_purchase']
                ])
            
            return response
        
        return Response({
            'summary': {
                'total_customers': Customer.objects.count(),
                'active_customers': active_customers.count(),
                'new_customers': new_customers.count(),
                'period': {
                    'start_date': start_date.strftime('%Y-%m-%d'),
                    'end_date': end_date.strftime('%Y-%m-%d')
                }
            },
            'purchase_data': purchase_data_list,
            'loyalty': {
                'total_points': loyalty_data['total_points'] or 0,
                'average_points_per_customer': float(loyalty_data['avg_points'] or 0)
            }
        })

class TaxReportView(views.APIView):
    permission_classes = [IsAuthenticated, IsManagerUser]
    
    def get(self, request):
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        export = request.query_params.get('export', 'false').lower() == 'true'
        
        # Validate parameters
        try:
            if start_date:
                start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
            else:
                # Default to current month
                today = timezone.now().date()
                start_date = today.replace(day=1)
            
            if end_date:
                end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
            else:
                end_date = timezone.now().date()
        except ValueError:
            return Response(
                {"detail": "Invalid date format. Use YYYY-MM-DD"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Filter bills by date and completed status
        filters = Q(
            created_at__date__gte=start_date,
            created_at__date__lte=end_date,
            status='completed'
        )
        
        # Apply store filter if user has a store
        if request.user.store:
            filters &= Q(store=request.user.store)
        
        # Get tax data from bill items
        tax_data = BillItem.objects.filter(
            bill__in=Bill.objects.filter(filters)
        ).values('tax_rate').annotate(
            taxable_value=Sum('price' * F('quantity')),
            tax_amount=Sum('tax_amount')
        ).order_by('tax_rate')
        
        # Prepare result data
        tax_summary = []
        total_taxable = 0
        total_tax = 0
        
        for item in tax_data:
            tax_rate = item['tax_rate']
            taxable_value = float(item['taxable_value'])
            tax_amount = float(item['tax_amount'])
            
            total_taxable += taxable_value
            total_tax += tax_amount
            
            tax_summary.append({
                'tax_rate': tax_rate,
                'taxable_value': taxable_value,
                'tax_amount': tax_amount
            })
        
        if export:
            # Create CSV response
            response = HttpResponse(content_type='text/csv')
            response['Content-Disposition'] = f'attachment; filename="tax_report_{start_date}_{end_date}.csv"'
            
            writer = csv.writer(response)
            writer.writerow(['Tax Rate', 'Taxable Value', 'Tax Amount'])
            
            for item in tax_summary:
                writer.writerow([
                    f"{item['tax_rate']}%",
                    item['taxable_value'],
                    item['tax_amount']
                ])
            
            writer.writerow([])
            writer.writerow(['Total', total_taxable, total_tax])
            
            return response
        
        return Response({
            'period': {
                'start_date': start_date.strftime('%Y-%m-%d'),
                'end_date': end_date.strftime('%Y-%m-%d')
            },
            'summary': {
                'total_taxable_value': total_taxable,
                'total_tax_collected': total_tax
            },
            'tax_rates': tax_summary
        })