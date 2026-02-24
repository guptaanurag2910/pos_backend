import logging

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.exceptions import ValidationError
from django_filters.rest_framework import DjangoFilterBackend
from django.db import transaction, models
from django.db.models import Sum, F
from django.utils import timezone
from decimal import Decimal, InvalidOperation
import csv

from .models import (
    Category, Product, StockRecord, StockLevel,
    StockTransfer, StockTransferItem, InventoryUpload
)
from .serializers import (
    CategorySerializer, ProductSerializer, StockRecordSerializer,
    StockLevelSerializer, StockTransferSerializer, StockTransferItemSerializer,
    InventoryUploadSerializer
)
from accounts.permissions import IsAdminUser, IsManagerUser
from accounts.models import AuditLog
from accounts.utils import get_client_ip

logger = logging.getLogger('inventory')

class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['is_active', 'parent']
    search_fields = ['name', 'description']
    
    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'adjust_stock', 'bulk_adjust_stock']:
            permission_classes = [IsManagerUser]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]
    
    def perform_create(self, serializer):
        category = serializer.save()
        logger.info(f"category_create_completed actor_id={self.request.user.id} category_id={category.id}")
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
        logger.info(f"category_update_completed actor_id={self.request.user.id} category_id={category.id}")
        AuditLog.objects.create(
            user=self.request.user,
            action='update',
            model_name='Category',
            object_id=str(category.id),
            object_repr=category.name,
            ip_address=get_client_ip(self.request)
        )
    
    def perform_destroy(self, instance):
        logger.info(f"category_delete_requested actor_id={self.request.user.id} category_id={instance.id}")
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
        queryset = Product.objects.all()
        user = self.request.user

        store_id = None
        if user.role == 'admin':
            # Store-admin users should default to their own store.
            # Global admin (no store) can still view all stores unless `store` is provided.
            store_id = self.request.query_params.get('store') or getattr(user, 'store_id', None)
        else:
            store_id = getattr(user, 'store_id', None)

        if store_id:
            queryset = queryset.annotate(
                current_stock=Sum(
                    'stock_levels__quantity',
                    filter=models.Q(stock_levels__store_id=store_id)
                )
            )
        else:
            queryset = queryset.annotate(current_stock=Sum('stock_levels__quantity'))

        return queryset
    
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
        logger.info(f"adjust_stock_requested actor_id={request.user.id} product_id={product.id}")
        
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
            quantity = Decimal(str(quantity))
        except (InvalidOperation, ValueError):
            return Response(
                {"detail": "Quantity must be a number"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        with transaction.atomic():
            # Update stock level
            stock_level, created = StockLevel.objects.get_or_create(
                product=product,
                store_id=store_id,
                defaults={'quantity': 0}
            )

            projected_quantity = Decimal(str(stock_level.quantity)) + quantity
            if projected_quantity < 0:
                return Response(
                    {"detail": "Adjustment would result in negative stock"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Create stock record
            record = StockRecord.objects.create(
                product=product,
                store_id=store_id,
                quantity=quantity,
                record_type='adjustment',
                notes=reason,
                created_by=request.user
            )

            stock_level.quantity = projected_quantity
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
                    'adjustment': str(quantity),
                    'reason': reason,
                    'new_level': str(stock_level.quantity)
                }
            )
        logger.info(f"adjust_stock_completed actor_id={request.user.id} product_id={product.id} store_id={store_id} quantity={quantity}")
            
        serializer = StockRecordSerializer(record)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'])
    def bulk_adjust_stock(self, request):
        adjustments = request.data.get('adjustments', [])
        default_store_id = request.data.get('store')
        reason = request.data.get('reason', 'Bulk stock adjustment')
        logger.info(f"bulk_adjust_stock_requested actor_id={request.user.id} adjustment_count={len(adjustments)} default_store_id={default_store_id}")

        if not isinstance(adjustments, list) or not adjustments:
            return Response(
                {"detail": "adjustments must be a non-empty list"},
                status=status.HTTP_400_BAD_REQUEST
            )

        results = []
        errors = []

        for idx, adjustment in enumerate(adjustments, start=1):
            try:
                product_id = adjustment.get('product') or adjustment.get('product_id')
                barcode = adjustment.get('barcode')
                store_id = adjustment.get('store') or default_store_id
                quantity_raw = adjustment.get('quantity')
                item_reason = adjustment.get('reason') or reason
                batch_number = adjustment.get('batch_number')
                expiry_date = adjustment.get('expiry_date')

                if quantity_raw is None:
                    raise ValueError("quantity is required")
                quantity = Decimal(str(quantity_raw))
                if not store_id:
                    raise ValueError("store is required")

                product = None
                if product_id:
                    product = Product.objects.filter(id=product_id).first()
                elif barcode:
                    product = Product.objects.filter(barcode=barcode).first()
                if not product:
                    raise ValueError("product not found")

                with transaction.atomic():
                    stock_level, _ = StockLevel.objects.get_or_create(
                        product=product,
                        store_id=store_id,
                        batch_number=batch_number,
                        defaults={'quantity': 0, 'expiry_date': expiry_date}
                    )

                    projected = Decimal(str(stock_level.quantity)) + quantity
                    if projected < 0:
                        raise ValueError("adjustment would result in negative stock")

                    stock_level.quantity = projected
                    if expiry_date:
                        stock_level.expiry_date = expiry_date
                    stock_level.save()

                    record = StockRecord.objects.create(
                        product=product,
                        store_id=store_id,
                        quantity=quantity,
                        record_type='adjustment',
                        notes=item_reason,
                        batch_number=batch_number,
                        expiry_date=expiry_date,
                        created_by=request.user
                    )

                results.append({
                    'index': idx,
                    'product_id': product.id,
                    'store_id': int(store_id),
                    'quantity': str(quantity),
                    'stock_record_id': record.id,
                    'new_stock_level': str(stock_level.quantity)
                })
            except (InvalidOperation, ValueError) as e:
                errors.append({'index': idx, 'error': str(e), 'payload': adjustment})

        return Response({
            'processed': len(results),
            'failed': len(errors),
            'results': results,
            'errors': errors
        }, status=status.HTTP_207_MULTI_STATUS if errors else status.HTTP_200_OK)
    
    def perform_create(self, serializer):
        product = serializer.save()
        logger.info(f"product_create_completed actor_id={self.request.user.id} product_id={product.id}")
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
        logger.info(f"product_update_completed actor_id={self.request.user.id} product_id={product.id}")
        AuditLog.objects.create(
            user=self.request.user,
            action='update',
            model_name='Product',
            object_id=str(product.id),
            object_repr=product.name,
            ip_address=get_client_ip(self.request)
        )
    
    def perform_destroy(self, instance):
        logger.info(f"product_soft_delete_requested actor_id={self.request.user.id} product_id={instance.id}")
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

    def get_permissions(self):
        if self.action in ['reconcile']:
            permission_classes = [IsManagerUser]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]
    
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

    @action(detail=False, methods=['post'])
    def reconcile(self, request):
        store_id = request.data.get('store')
        items = request.data.get('items', [])
        reason = request.data.get('reason', 'Stock reconciliation')
        apply_changes = bool(request.data.get('apply', True))
        logger.info(f"stock_reconcile_requested actor_id={request.user.id} store_id={store_id} items={len(items)} apply={apply_changes}")

        if not store_id:
            return Response({"detail": "store is required"}, status=status.HTTP_400_BAD_REQUEST)
        if not isinstance(items, list) or not items:
            return Response({"detail": "items must be a non-empty list"}, status=status.HTTP_400_BAD_REQUEST)

        reconciled = []
        errors = []

        for idx, item in enumerate(items, start=1):
            try:
                product_id = item.get('product') or item.get('product_id')
                batch_number = item.get('batch_number')
                expected_qty_raw = item.get('expected_quantity')

                if not product_id:
                    raise ValueError("product is required")
                if expected_qty_raw is None:
                    raise ValueError("expected_quantity is required")

                expected_qty = Decimal(str(expected_qty_raw))
                if expected_qty < 0:
                    raise ValueError("expected_quantity cannot be negative")

                stock_level, _ = StockLevel.objects.get_or_create(
                    product_id=product_id,
                    store_id=store_id,
                    batch_number=batch_number,
                    defaults={'quantity': 0}
                )
                current_qty = Decimal(str(stock_level.quantity))
                difference = expected_qty - current_qty

                entry = {
                    'index': idx,
                    'product_id': int(product_id),
                    'batch_number': batch_number,
                    'current_quantity': str(current_qty),
                    'expected_quantity': str(expected_qty),
                    'difference': str(difference),
                    'applied': False,
                }

                if apply_changes and difference != 0:
                    with transaction.atomic():
                        stock_level.quantity = expected_qty
                        stock_level.save(update_fields=['quantity', 'updated_at'])
                        StockRecord.objects.create(
                            product_id=product_id,
                            store_id=store_id,
                            quantity=difference,
                            record_type='adjustment',
                            notes=reason,
                            batch_number=batch_number,
                            created_by=request.user
                        )
                    entry['applied'] = True

                reconciled.append(entry)
            except (InvalidOperation, ValueError) as e:
                errors.append({'index': idx, 'error': str(e), 'payload': item})

        return Response({
            'store_id': int(store_id),
            'apply': apply_changes,
            'processed': len(reconciled),
            'failed': len(errors),
            'reconciled': reconciled,
            'errors': errors,
        }, status=status.HTTP_207_MULTI_STATUS if errors else status.HTTP_200_OK)

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
    def approve(self, request, pk=None):
        transfer = self.get_object()
        logger.info(f"transfer_approve_requested actor_id={request.user.id} transfer_id={transfer.id}")

        if transfer.status != 'pending':
            return Response(
                {"detail": "Only pending transfers can be approved"},
                status=status.HTTP_400_BAD_REQUEST
            )

        if request.user.role != 'admin' and request.user.store != transfer.to_store:
            return Response(
                {"detail": "Only receiving store or admin can approve transfer"},
                status=status.HTTP_403_FORBIDDEN
            )

        transfer.status = 'approved'
        transfer.save(update_fields=['status'])

        AuditLog.objects.create(
            user=request.user,
            action='update',
            model_name='StockTransfer',
            object_id=str(transfer.id),
            object_repr=f"Transfer #{transfer.id}",
            ip_address=get_client_ip(request),
            details={'action': 'approve'}
        )
        logger.info(f"transfer_approve_completed actor_id={request.user.id} transfer_id={transfer.id}")

        return Response(self.get_serializer(transfer).data)
    
    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        transfer = self.get_object()
        new_status = request.data.get('status')
        logger.info(f"transfer_status_requested actor_id={request.user.id} transfer_id={transfer.id} new_status={new_status}")
        
        if not new_status or new_status not in dict(StockTransfer.STATUS_CHOICES).keys():
            return Response(
                {"detail": "Invalid status"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check permissions based on status
        if new_status == 'approved':
            if transfer.status != 'pending':
                return Response(
                    {"detail": "Only pending transfers can be approved"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if request.user.store != transfer.to_store and request.user.role != 'admin':
                return Response(
                    {"detail": "Only receiving store or admin can approve transfer"},
                    status=status.HTTP_403_FORBIDDEN
                )

        if new_status in ['in_transit', 'cancelled']:
            if request.user.store != transfer.from_store and request.user.role != 'admin':
                return Response(
                    {"detail": "Only sending store or admin can update this status"},
                    status=status.HTTP_403_FORBIDDEN
                )

        if new_status == 'completed':
            if request.user.store != transfer.to_store and request.user.role != 'admin':
                return Response(
                    {"detail": "Only receiving store or admin can complete the transfer"},
                    status=status.HTTP_403_FORBIDDEN
                )

        # Enforce transition sequence
        valid_transitions = {
            'pending': {'approved', 'cancelled', 'in_transit'},
            'approved': {'in_transit', 'cancelled'},
            'in_transit': {'completed', 'cancelled'},
            'completed': set(),
            'cancelled': set(),
        }
        if new_status not in valid_transitions.get(transfer.status, set()):
            return Response(
                {"detail": f"Invalid transition from {transfer.status} to {new_status}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        with transaction.atomic():
            old_status = transfer.status
            transfer.status = new_status
            
            # Handle stock adjustments when completing a transfer
            if new_status == 'completed' and old_status != 'completed':
                transfer.completed_by = request.user
                transfer.completed_at = timezone.now()
                
                for item in transfer.items.all():
                    # Reduce stock from sending store
                    from_stock, _ = StockLevel.objects.get_or_create(
                        product=item.product,
                        store=transfer.from_store,
                        defaults={'quantity': 0}
                    )
                    if from_stock.quantity < item.quantity:
                        raise ValidationError(
                            {"detail": f"Insufficient stock for product {item.product.name} in source store"}
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
                    'new_status': new_status
                }
            )
        logger.info(f"transfer_status_completed actor_id={request.user.id} transfer_id={transfer.id} old_status={old_status} new_status={new_status}")
        
        serializer = self.get_serializer(transfer)
        return Response(serializer.data)
    
    def perform_create(self, serializer):
        with transaction.atomic():
            transfer = serializer.save(created_by=self.request.user)
            logger.info(f"transfer_create_completed actor_id={self.request.user.id} transfer_id={transfer.id}")
            
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
            transfer = StockTransfer.objects.get(id=transfer_id)
            if transfer.status in ['completed', 'cancelled']:
                raise ValidationError({"detail": "Cannot modify items for completed/cancelled transfer"})
            serializer.save(transfer_id=transfer_id)
        else:
            serializer.save()

    def perform_update(self, serializer):
        instance = serializer.instance
        if instance.transfer.status in ['completed', 'cancelled']:
            raise ValidationError({"detail": "Cannot modify items for completed/cancelled transfer"})
        serializer.save()

    def perform_destroy(self, instance):
        if instance.transfer.status in ['completed', 'cancelled']:
            raise ValidationError({"detail": "Cannot modify items for completed/cancelled transfer"})
        instance.delete()


class InventoryUploadViewSet(viewsets.ModelViewSet):
    queryset = InventoryUpload.objects.all().order_by('-uploaded_at')
    serializer_class = InventoryUploadSerializer
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [IsAuthenticated, IsManagerUser]

    def create(self, request, *args, **kwargs):
        logger.info(f"inventory_upload_requested actor_id={request.user.id} filename={request.data.get('file')}")
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        upload = serializer.save()

        process_now = str(request.data.get('process', 'true')).lower() == 'true'
        mode = str(request.data.get('mode', 'set')).lower()
        if mode not in {'set', 'adjust'}:
            mode = 'set'

        if not process_now:
            logger.info(f"inventory_upload_saved_only actor_id={request.user.id} upload_id={upload.id}")
            return Response(
                {'upload': InventoryUploadSerializer(upload).data, 'detail': 'File uploaded successfully'},
                status=status.HTTP_201_CREATED
            )

        store_id_default = request.data.get('store')
        content = upload.file.read().decode('utf-8-sig').splitlines()
        reader = csv.DictReader(content)

        processed = 0
        failed = 0
        errors = []
        applied = []

        for idx, row in enumerate(reader, start=2):  # header is line 1
            try:
                barcode = (row.get('barcode') or '').strip()
                product_id = (row.get('product_id') or '').strip()
                store_id = (row.get('store_id') or store_id_default or '').strip()
                quantity_raw = (row.get('quantity') or '').strip()
                min_stock_raw = (row.get('min_stock') or '').strip()
                max_stock_raw = (row.get('max_stock') or '').strip()
                batch_number = (row.get('batch_number') or '').strip() or None
                expiry_date = (row.get('expiry_date') or '').strip() or None
                reason = (row.get('reason') or 'Inventory upload').strip()

                if not store_id:
                    raise ValueError('store_id is required')
                if not quantity_raw:
                    raise ValueError('quantity is required')

                quantity = Decimal(quantity_raw)
                if mode == 'set' and quantity < 0:
                    raise ValueError('quantity cannot be negative in set mode')

                product = None
                if product_id:
                    product = Product.objects.filter(id=product_id).first()
                elif barcode:
                    product = Product.objects.filter(barcode=barcode).first()
                if not product:
                    raise ValueError('product not found')

                with transaction.atomic():
                    stock_level, _ = StockLevel.objects.get_or_create(
                        product=product,
                        store_id=store_id,
                        batch_number=batch_number,
                        defaults={'quantity': 0, 'expiry_date': expiry_date}
                    )

                    current_qty = Decimal(str(stock_level.quantity))
                    delta = quantity - current_qty if mode == 'set' else quantity
                    final_qty = quantity if mode == 'set' else current_qty + quantity
                    if final_qty < 0:
                        raise ValueError('resulting stock cannot be negative')

                    stock_level.quantity = final_qty
                    if min_stock_raw:
                        stock_level.min_stock = Decimal(min_stock_raw)
                    if max_stock_raw:
                        stock_level.max_stock = Decimal(max_stock_raw)
                    if expiry_date:
                        stock_level.expiry_date = expiry_date
                    stock_level.save()

                    if delta != 0:
                        StockRecord.objects.create(
                            product=product,
                            store_id=store_id,
                            quantity=delta,
                            record_type='adjustment',
                            reference_id=f'UPLOAD-{upload.id}',
                            batch_number=batch_number,
                            expiry_date=expiry_date,
                            notes=reason,
                            created_by=request.user
                        )

                processed += 1
                applied.append({
                    'line': idx,
                    'product_id': product.id,
                    'store_id': int(store_id),
                    'new_quantity': str(final_qty),
                    'delta': str(delta)
                })
            except Exception as e:
                failed += 1
                errors.append({'line': idx, 'error': str(e), 'row': row})

        logger.info(f"inventory_upload_processed actor_id={request.user.id} upload_id={upload.id} processed={processed} failed={failed} mode={mode}")
        return Response({
            'upload': InventoryUploadSerializer(upload).data,
            'mode': mode,
            'processed': processed,
            'failed': failed,
            'applied': applied,
            'errors': errors
        }, status=status.HTTP_207_MULTI_STATUS if failed else status.HTTP_201_CREATED)
