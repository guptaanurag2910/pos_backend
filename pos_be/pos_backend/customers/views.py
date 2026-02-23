from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.db import transaction
from django.db.models import Sum, Count, F, Q
from django.utils import timezone

from .models import Customer, CustomerGroup
from .serializers import CustomerSerializer, CustomerGroupSerializer
from accounts.permissions import IsManagerUser
from accounts.models import AuditLog
from accounts.utils import get_client_ip

class CustomerViewSet(viewsets.ModelViewSet):
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['city', 'state', 'is_active']
    search_fields = ['name', 'phone', 'email', 'gst_number']
    ordering_fields = ['name', 'loyalty_points', 'total_purchases', 'last_purchase', 'created_at']
    ordering = ['name']
    
    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'merge']:
            permission_classes = [IsManagerUser]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]

    def get_queryset(self):
        queryset = Customer.objects.all()
        include_inactive = str(self.request.query_params.get('include_inactive', 'false')).lower() == 'true'
        if not include_inactive:
            queryset = queryset.filter(is_active=True)
        return queryset
    
    @action(detail=True, methods=['get'])
    def purchase_history(self, request, pk=None):
        customer = self.get_object()
        bills = customer.bills.all().order_by('-created_at')
        
        from sales.serializers import BillSerializer
        serializer = BillSerializer(bills, many=True, context={'request': request})
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def add_points(self, request, pk=None):
        customer = self.get_object()
        points = request.data.get('points', 0)
        reason = request.data.get('reason', 'Manual adjustment')
        
        try:
            points = int(points)
        except ValueError:
            return Response(
                {"detail": "Points must be a number"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if points == 0:
            return Response(
                {"detail": "Points cannot be zero"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        with transaction.atomic():
            customer.loyalty_points += points
            customer.save()
            
            # Log the action
            AuditLog.objects.create(
                user=request.user,
                action='update',
                model_name='Customer',
                object_id=str(customer.id),
                object_repr=customer.name,
                ip_address=get_client_ip(request),
                details={
                    'action': 'add_points',
                    'points': points,
                    'reason': reason,
                    'new_balance': customer.loyalty_points
                }
            )
        
        serializer = self.get_serializer(customer)
        return Response(serializer.data)
    
    def perform_create(self, serializer):
        with transaction.atomic():
            customer = serializer.save(created_by=self.request.user)
            
            # Log the action
            AuditLog.objects.create(
                user=self.request.user,
                action='create',
                model_name='Customer',
                object_id=str(customer.id),
                object_repr=customer.name,
                ip_address=get_client_ip(self.request)
            )
    
    def perform_update(self, serializer):
        with transaction.atomic():
            customer = serializer.save()
            
            # Log the action
            AuditLog.objects.create(
                user=self.request.user,
                action='update',
                model_name='Customer',
                object_id=str(customer.id),
                object_repr=customer.name,
                ip_address=get_client_ip(self.request)
            )

    def perform_destroy(self, instance):
        with transaction.atomic():
            instance.is_active = False
            instance.save(update_fields=['is_active', 'updated_at'])
            AuditLog.objects.create(
                user=self.request.user,
                action='update',
                model_name='Customer',
                object_id=str(instance.id),
                object_repr=instance.name,
                ip_address=get_client_ip(self.request),
                details={'action': 'soft_delete'}
            )
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get customer statistics"""
        total_customers = Customer.objects.count()
        active_customers = Customer.objects.filter(
            bills__created_at__gte=timezone.now() - timezone.timedelta(days=90)
        ).distinct().count()
        
        # Top customers by purchase amount
        top_by_amount = Customer.objects.order_by('-total_purchases')[:10]
        top_by_amount_data = CustomerSerializer(top_by_amount, many=True, context={'request': request}).data
        
        # Top customers by loyalty points
        top_by_points = Customer.objects.order_by('-loyalty_points')[:10]
        top_by_points_data = CustomerSerializer(top_by_points, many=True, context={'request': request}).data
        
        # New customers this month
        this_month = timezone.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        new_customers = Customer.objects.filter(created_at__gte=this_month).count()
        
        return Response({
            'total_customers': total_customers,
            'active_customers': active_customers,
            'new_this_month': new_customers,
            'top_by_amount': top_by_amount_data,
            'top_by_points': top_by_points_data
        })

    @action(detail=False, methods=['post'])
    def merge(self, request):
        primary_id = request.data.get('primary_customer_id')
        duplicate_ids = request.data.get('duplicate_customer_ids', [])

        if not primary_id or not isinstance(duplicate_ids, list) or not duplicate_ids:
            return Response(
                {"detail": "primary_customer_id and duplicate_customer_ids are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if primary_id in duplicate_ids:
            return Response({"detail": "primary customer cannot be in duplicates."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            primary = Customer.objects.get(id=primary_id)
        except Customer.DoesNotExist:
            return Response({"detail": "Primary customer not found."}, status=status.HTTP_404_NOT_FOUND)

        duplicates = Customer.objects.filter(id__in=duplicate_ids, is_active=True).exclude(id=primary.id)
        if not duplicates.exists():
            return Response({"detail": "No valid active duplicate customers found."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            merged_ids = list(duplicates.values_list('id', flat=True))

            # Re-assign bills to primary
            from sales.models import Bill
            Bill.objects.filter(customer_id__in=merged_ids).update(customer=primary)

            # Merge points and purchases
            primary.loyalty_points += sum(duplicates.values_list('loyalty_points', flat=True))
            primary.total_purchases += sum(duplicates.values_list('total_purchases', flat=True))
            latest_last_purchase = duplicates.exclude(last_purchase__isnull=True).order_by('-last_purchase').first()
            if latest_last_purchase and (not primary.last_purchase or latest_last_purchase.last_purchase > primary.last_purchase):
                primary.last_purchase = latest_last_purchase.last_purchase
            primary.save()

            # Move groups and deactivate duplicates
            for dup in duplicates:
                for group in dup.groups.all():
                    group.customers.add(primary)
                    group.customers.remove(dup)
                dup.is_active = False
                dup.notes = ((dup.notes or '') + f"\nMerged into customer #{primary.id}").strip()
                dup.save(update_fields=['is_active', 'notes', 'updated_at'])

            AuditLog.objects.create(
                user=request.user,
                action='update',
                model_name='Customer',
                object_id=str(primary.id),
                object_repr=primary.name,
                ip_address=get_client_ip(request),
                details={'action': 'merge', 'duplicate_customer_ids': merged_ids}
            )

        return Response({
            'detail': 'Customers merged successfully.',
            'primary_customer_id': primary.id,
            'merged_customer_ids': merged_ids
        }, status=status.HTTP_200_OK)

class CustomerGroupViewSet(viewsets.ModelViewSet):
    queryset = CustomerGroup.objects.all()
    serializer_class = CustomerGroupSerializer
    permission_classes = [IsAuthenticated, IsManagerUser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['is_active']
    search_fields = ['name', 'description']
    
    @action(detail=True, methods=['post'])
    def add_customers(self, request, pk=None):
        group = self.get_object()
        customer_ids = request.data.get('customer_ids', [])
        
        if not customer_ids:
            return Response(
                {"detail": "No customer IDs provided"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        customers = Customer.objects.filter(id__in=customer_ids)
        if not customers.exists():
            return Response(
                {"detail": "No valid customers found"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        with transaction.atomic():
            for customer in customers:
                group.customers.add(customer)
            
            # Log the action
            AuditLog.objects.create(
                user=request.user,
                action='update',
                model_name='CustomerGroup',
                object_id=str(group.id),
                object_repr=group.name,
                ip_address=get_client_ip(request),
                details={
                    'action': 'add_customers',
                    'customer_count': customers.count(),
                    'customer_ids': list(customers.values_list('id', flat=True))
                }
            )
        
        serializer = self.get_serializer(group)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def remove_customers(self, request, pk=None):
        group = self.get_object()
        customer_ids = request.data.get('customer_ids', [])
        
        if not customer_ids:
            return Response(
                {"detail": "No customer IDs provided"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        customers = Customer.objects.filter(id__in=customer_ids)
        if not customers.exists():
            return Response(
                {"detail": "No valid customers found"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        with transaction.atomic():
            for customer in customers:
                group.customers.remove(customer)
            
            # Log the action
            AuditLog.objects.create(
                user=request.user,
                action='update',
                model_name='CustomerGroup',
                object_id=str(group.id),
                object_repr=group.name,
                ip_address=get_client_ip(request),
                details={
                    'action': 'remove_customers',
                    'customer_count': customers.count(),
                    'customer_ids': list(customers.values_list('id', flat=True))
                }
            )
        
        serializer = self.get_serializer(group)
        return Response(serializer.data)
    
    def perform_create(self, serializer):
        with transaction.atomic():
            group = serializer.save(created_by=self.request.user)
            
            # Log the action
            AuditLog.objects.create(
                user=self.request.user,
                action='create',
                model_name='CustomerGroup',
                object_id=str(group.id),
                object_repr=group.name,
                ip_address=get_client_ip(self.request)
            )
