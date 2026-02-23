from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.db import transaction
from django.db.models import Sum, F

from .models import Category, Product, StockRecord, StockLevel, StockTransfer, StockTransferItem
from .serializers import (
    CategorySerializer, ProductSerializer, StockRecordSerializer,
    StockLevelSerializer, StockTransferSerializer, StockTransferItemSerializer
)
from accounts.permissions import IsAdminUser, IsManagerUser
from accounts.models import AuditLog
from accounts.utils import get_client_ip

class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['is_active', 'parent']
    search_fields = ['name', 'description']
    
    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            permission_classes = [IsManagerUser]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]
    
    def perform_create(self, serializer):
        category = serializer.save()
        AuditLog.objects.create(
            user=self.request.user,
            action='create',
            model_name='Category',
            object_id=str(category.id),
            object_repr=category.name,
            ip_address=get_client_ip(self.request)
        )
    
    def perform_update(self, serializer):
        category = serializer.save()
        AuditLog.objects.create(
            user=self.request.user,
            action='update',
            model_name='Category',
            object_id=str(category.id),
            object_repr=category.name,
            ip_address=get_client_ip(self.request)
        )
    
    def perform_destroy(self, instance):
        AuditLog.objects.create(
            user=self.request.user,
            action='delete',
            model_name='Category',
            object_id=str(instance.id),
            object_repr=instance.name,
            ip_address=get_client_ip(self.request)
        )
        instance.delete()

class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all()  # ✅ Required for DRF router
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['category', 'is_active', 'is_featured', 'is_service', 'tax']
    search_fields = ['name', 'barcode', 'description', 'hsn_code']

    def get_queryset(self):
        return Product.objects.annotate(
            current_stock=Sum('stock_levels__quantity')
        )
    
    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            permission_classes = [IsManagerUser]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]
    
    @action(detail=True, methods=['get'])
    def stock_levels(self, request, pk=None):
        product = self.get_object()
        stock_levels = StockLevel.objects.filter(product=product)
        serializer = StockLevelSerializer(stock_levels, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def stock_history(self, request, pk=None):
        product = self.get_object()
        stock_records = StockRecord.objects.filter(product=product)
        serializer = StockRecordSerializer(stock_records, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def adjust_stock(self, request, pk=None):
        product = self.get_object()
        
        # Validate input
        store_id = request.data.get('store')
        quantity = request.data.get('quantity')
        reason = request.data.get('reason', 'Manual adjustment')
        
        if not store_id or quantity is None:
            return Response(
                {"detail": "Store and quantity are required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            quantity = float(quantity)
        except ValueError:
            return Response(
                {"detail": "Quantity must be a number"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        with transaction.atomic():
            # Create stock record
            record = StockRecord.objects.create(
                product=product,
                store_id=store_id,
                quantity=quantity,
                record_type='adjustment',
                notes=reason,
                created_by=request.user
            )
            
            # Update stock level
            stock_level, created = StockLevel.objects.get_or_create(
                product=product,
                store_id=store_id,
                defaults={'quantity': 0}
            )
            
            stock_level.quantity += quantity
            stock_level.save()
            
            # Log the action
            AuditLog.objects.create(
                user=request.user,
                action='update',
                model_name='StockLevel',
                object_id=str(stock_level.id),
                object_repr=f"{product.name} stock adjustment",
                ip_address=get_client_ip(request),
                details={
                    'adjustment': quantity,
                    'reason': reason,
                    'new_level': str(stock_level.quantity)
                }
            )
            
        serializer = StockRecordSerializer(record)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    def perform_create(self, serializer):
        product = serializer.save()
        AuditLog.objects.create(
            user=self.request.user,
            action='create',
            model_name='Product',
            object_id=str(product.id),
            object_repr=product.name,
            ip_address=get_client_ip(self.request)
        )
    
    def perform_update(self, serializer):
        product = serializer.save()
        AuditLog.objects.create(
            user=self.request.user,
            action='update',
            model_name='Product',
            object_id=str(product.id),
            object_repr=product.name,
            ip_address=get_client_ip(self.request)
        )
    
    def perform_destroy(self, instance):
        AuditLog.objects.create(
            user=self.request.user,
            action='delete',
            model_name='Product',
            object_id=str(instance.id),
            object_repr=instance.name,
            ip_address=get_client_ip(self.request)
        )
        # Instead of deleting, mark as inactive
        instance.is_active = False
        instance.save()

class StockRecordViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = StockRecordSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['product', 'store', 'record_type', 'batch_number', 'created_at']
    search_fields = ['product__name', 'batch_number', 'notes']
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return StockRecord.objects.all()
        return StockRecord.objects.filter(store=user.store)

class StockLevelViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = StockLevelSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['product', 'store', 'batch_number']
    search_fields = ['product__name', 'batch_number']
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return StockLevel.objects.all()
        return StockLevel.objects.filter(store=user.store)
    
    @action(detail=False, methods=['get'])
    def low_stock(self, request):
        queryset = self.get_queryset().filter(quantity__lte=models.F('min_stock'))
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

class StockTransferViewSet(viewsets.ModelViewSet):
    queryset = StockTransfer.objects.all()
    serializer_class = StockTransferSerializer
    permission_classes = [IsAuthenticated, IsManagerUser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['status', 'from_store', 'to_store', 'created_at']
    search_fields = ['notes']
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return StockTransfer.objects.all()
        return StockTransfer.objects.filter(
            models.Q(from_store=user.store) | models.Q(to_store=user.store)
        )
    
    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        transfer = self.get_object()
        status = request.data.get('status')
        
        if not status or status not in dict(StockTransfer.STATUS_CHOICES).keys():
            return Response(
                {"detail": "Invalid status"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check permissions based on status
        if status in ['in_transit', 'cancelled']:
            if request.user.store != transfer.from_store and request.user.role != 'admin':
                return Response(
                    {"detail": "Only sending store or admin can update this status"},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        if status == 'completed':
            if request.user.store != transfer.to_store and request.user.role != 'admin':
                return Response(
                    {"detail": "Only receiving store or admin can complete the transfer"},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        with transaction.atomic():
            old_status = transfer.status
            transfer.status = status
            
            # Handle stock adjustments when completing a transfer
            if status == 'completed' and old_status != 'completed':
                transfer.completed_by = request.user
                transfer.completed_at = timezone.now()
                
                for item in transfer.items.all():
                    # Reduce stock from sending store
                    from_stock, _ = StockLevel.objects.get_or_create(
                        product=item.product,
                        store=transfer.from_store,
                        defaults={'quantity': 0}
                    )
                    from_stock.quantity -= item.quantity
                    from_stock.save()
                    
                    # Add stock to receiving store
                    to_stock, _ = StockLevel.objects.get_or_create(
                        product=item.product,
                        store=transfer.to_store,
                        batch_number=item.batch_number,
                        defaults={'quantity': 0}
                    )
                    to_stock.quantity += item.quantity
                    if item.expiry_date:
                        to_stock.expiry_date = item.expiry_date
                    to_stock.save()
                    
                    # Create stock records
                    StockRecord.objects.create(
                        product=item.product,
                        store=transfer.from_store,
                        quantity=-item.quantity,
                        record_type='transfer_out',
                        reference_id=f'TRANSFER-{transfer.id}',
                        batch_number=item.batch_number,
                        expiry_date=item.expiry_date,
                        notes=f"Transfer to {transfer.to_store.name}",
                        created_by=request.user
                    )
                    
                    StockRecord.objects.create(
                        product=item.product,
                        store=transfer.to_store,
                        quantity=item.quantity,
                        record_type='transfer_in',
                        reference_id=f'TRANSFER-{transfer.id}',
                        batch_number=item.batch_number,
                        expiry_date=item.expiry_date,
                        notes=f"Transfer from {transfer.from_store.name}",
                        created_by=request.user
                    )
            
            transfer.save()
            
            # Log the action
            AuditLog.objects.create(
                user=request.user,
                action='update',
                model_name='StockTransfer',
                object_id=str(transfer.id),
                object_repr=f"Transfer #{transfer.id}",
                ip_address=get_client_ip(request),
                details={
                    'old_status': old_status,
                    'new_status': status
                }
            )
        
        serializer = self.get_serializer(transfer)
        return Response(serializer.data)
    
    def perform_create(self, serializer):
        with transaction.atomic():
            transfer = serializer.save(created_by=self.request.user)
            
            # Log the action
            AuditLog.objects.create(
                user=self.request.user,
                action='create',
                model_name='StockTransfer',
                object_id=str(transfer.id),
                object_repr=f"Transfer #{transfer.id}",
                ip_address=get_client_ip(self.request)
            )

class StockTransferItemViewSet(viewsets.ModelViewSet):
    serializer_class = StockTransferItemSerializer
    permission_classes = [IsAuthenticated, IsManagerUser]
    
    def get_queryset(self):
        transfer_id = self.kwargs.get('transfer_pk')
        if transfer_id:
            return StockTransferItem.objects.filter(transfer_id=transfer_id)
        return StockTransferItem.objects.none()
    
    def perform_create(self, serializer):
        transfer_id = self.kwargs.get('transfer_pk')
        if transfer_id:
            serializer.save(transfer_id=transfer_id)
        else:
            serializer.save()