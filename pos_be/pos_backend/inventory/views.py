import logging
import io

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
import pandas as pd

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
from stores.models import Store

logger = logging.getLogger('inventory')

def _normalize_batch_number(value):
    if value is None:
        return None
    if isinstance(value, str):
        cleaned = value.strip()
        return cleaned or None
    cleaned = str(value).strip()
    return cleaned or None

def _get_scoped_store_id(request):
    user_store_id = getattr(request.user, 'store_id', None)
    if user_store_id:
        return user_store_id
    return request.query_params.get('store')

def _resolve_store_for_request(request, explicit_store_id=None):
    user_store_id = getattr(request.user, 'store_id', None)
    requested_store_id = explicit_store_id
    if requested_store_id in ['', None]:
        requested_store_id = None

    if user_store_id:
        if requested_store_id and str(requested_store_id) != str(user_store_id):
            raise ValidationError({"store": "You can only access your assigned store"})
        store = Store.objects.filter(id=user_store_id, is_active=True).first()
        if not store:
            raise ValidationError({"store": "Assigned store is invalid or inactive"})
        return store

    if requested_store_id:
        store = Store.objects.filter(id=requested_store_id, is_active=True).first()
        if not store:
            raise ValidationError({"store": "Invalid or inactive store"})
        return store

    fallback = Store.objects.filter(is_main=True, is_active=True).first()
    if fallback:
        return fallback
    return Store.objects.filter(is_active=True).order_by('id').first()

def _get_or_create_stock_level_safe(product, store, batch_number=None, defaults=None, lock_for_update=False):
    normalized_batch = _normalize_batch_number(batch_number)
    defaults = defaults or {}
    qs = StockLevel.objects
    if lock_for_update:
        qs = qs.select_for_update()
    qs = qs.filter(product=product, store=store)

    if normalized_batch is None:
        stock_level = qs.filter(
            models.Q(batch_number__isnull=True) | models.Q(batch_number='')
        ).order_by('-updated_at', '-id').first()
    else:
        stock_level = qs.filter(batch_number=normalized_batch).order_by('-updated_at', '-id').first()

    if stock_level:
        return stock_level, False

    create_kwargs = {
        'product': product,
        'store': store,
        'batch_number': normalized_batch,
    }
    create_kwargs.update(defaults)
    return StockLevel.objects.create(**create_kwargs), True

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
        store_id = _get_scoped_store_id(self.request)

        if store_id:
            # Enforce store-level visibility for list and detail routes.
            # Without this filter, scoped users could fetch products from other stores by ID.
            queryset = queryset.filter(stock_levels__store_id=store_id).annotate(
                current_stock=Sum(
                    'stock_levels__quantity',
                    filter=models.Q(stock_levels__store_id=store_id)
                )
            ).distinct()
        else:
            queryset = queryset.annotate(current_stock=Sum('stock_levels__quantity'))

        in_stock_only = str(self.request.query_params.get('in_stock_only', '')).lower() in ['1', 'true', 'yes']
        if in_stock_only:
            queryset = queryset.filter(current_stock__gt=0)

        stock_status = str(self.request.query_params.get('stock_status', '')).lower()
        if stock_status == 'in_stock':
            queryset = queryset.filter(current_stock__gt=0)
        elif stock_status == 'out_of_stock':
            queryset = queryset.filter(models.Q(current_stock__lte=0) | models.Q(current_stock__isnull=True))

        return queryset
    
    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            permission_classes = [IsManagerUser]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]

    def _parse_decimal(self, value, field_name):
        if value is None or value == '':
            return None
        try:
            return Decimal(str(value))
        except (InvalidOperation, ValueError, TypeError):
            raise ValidationError({field_name: f"{field_name} must be a valid number"})

    def _resolve_store_for_stock(self, explicit_store_id=None):
        return _resolve_store_for_request(self.request, explicit_store_id)

    def _resolve_store_for_inventory_io(self, explicit_store_id=None):
        store = self._resolve_store_for_stock(explicit_store_id)
        if not store:
            raise ValidationError({"store": "No active store available"})
        return store

    def _extract_stock_entries(self):
        payload = self.request.data
        if not hasattr(payload, 'get'):
            return []

        entries = []
        raw_entries = payload.get('stock_details')
        if isinstance(raw_entries, list):
            for row in raw_entries:
                if isinstance(row, dict):
                    entries.append(row)
        else:
            quantity = payload.get('quantity', payload.get('stock_quantity', payload.get('initial_stock')))
            min_stock = payload.get('min_stock')
            max_stock = payload.get('max_stock')
            batch_number = payload.get('batch_number')
            expiry_date = payload.get('expiry_date')
            store_id = payload.get('store')

            has_stock_values = any(
                value not in [None, '']
                for value in [quantity, min_stock, max_stock, batch_number, expiry_date]
            )
            if has_stock_values:
                entries.append({
                    'quantity': quantity,
                    'min_stock': min_stock,
                    'max_stock': max_stock,
                    'batch_number': batch_number,
                    'expiry_date': expiry_date,
                    'store': store_id,
                })
        return entries

    def _apply_stock_entries(self, product, entries):
        applied = []
        for idx, entry in enumerate(entries, start=1):
            quantity = self._parse_decimal(entry.get('quantity', entry.get('stock_quantity')), 'quantity')
            min_stock = self._parse_decimal(entry.get('min_stock'), 'min_stock')
            max_stock = self._parse_decimal(entry.get('max_stock'), 'max_stock')
            batch_raw = entry.get('batch_number')
            batch_number = (batch_raw.strip() if isinstance(batch_raw, str) else batch_raw) or None
            expiry_date = entry.get('expiry_date') or None
            store = self._resolve_store_for_stock(entry.get('store'))
            if not store:
                raise ValidationError({"store": "No active store available for stock update"})

            base_qs = StockLevel.objects.filter(product=product, store=store)
            stock_levels_for_store = list(base_qs.order_by('-updated_at', '-id'))

            def _normalize_batch(value):
                if value is None:
                    return None
                if isinstance(value, str):
                    value = value.strip()
                    return value or None
                value = str(value).strip()
                return value or None

            stock_level = None
            if batch_number is not None:
                for row in stock_levels_for_store:
                    if _normalize_batch(row.batch_number) == batch_number:
                        stock_level = row
                        break
            else:
                # Product modal edits are store-level overwrite operations.
                # Prefer the non-batch stock row for the store.
                for row in stock_levels_for_store:
                    if _normalize_batch(row.batch_number) is None:
                        stock_level = row
                        break

            if stock_level is None:
                stock_level = StockLevel.objects.create(
                    product=product,
                    store=store,
                    batch_number=batch_number,
                    quantity=0,
                    expiry_date=expiry_date,
                )
                stock_levels_for_store.append(stock_level)

            old_quantity = Decimal(str(stock_level.quantity))
            if quantity is not None and quantity < 0:
                raise ValidationError({"quantity": "quantity cannot be negative"})
            if min_stock is not None and min_stock < 0:
                raise ValidationError({"min_stock": "min_stock cannot be negative"})
            if max_stock is not None and max_stock < 0:
                raise ValidationError({"max_stock": "max_stock cannot be negative"})

            if quantity is not None:
                stock_level.quantity = quantity
            if min_stock is not None:
                stock_level.min_stock = min_stock
            if max_stock is not None:
                stock_level.max_stock = max_stock
            if expiry_date:
                stock_level.expiry_date = expiry_date
            stock_level.save()

            new_quantity = Decimal(str(stock_level.quantity))
            delta = new_quantity - old_quantity
            if delta != 0:
                StockRecord.objects.create(
                    product=product,
                    store=store,
                    quantity=delta,
                    record_type='adjustment',
                    reference_id=f'PRODUCT-{product.id}',
                    batch_number=stock_level.batch_number,
                    expiry_date=expiry_date,
                    notes='Product create/update stock set',
                    created_by=self.request.user
                )

            # For store-level overwrite (no batch provided), keep one effective row so
            # current_stock and product view always reflect the latest edited value.
            merged_rows = 0
            if batch_number is None and quantity is not None:
                for extra_row in stock_levels_for_store:
                    if extra_row.id == stock_level.id:
                        continue
                    extra_old_quantity = Decimal(str(extra_row.quantity))
                    if extra_old_quantity == 0:
                        continue
                    extra_row.quantity = 0
                    extra_row.save(update_fields=['quantity', 'updated_at'])
                    StockRecord.objects.create(
                        product=product,
                        store=store,
                        quantity=-extra_old_quantity,
                        record_type='adjustment',
                        reference_id=f'PRODUCT-{product.id}',
                        batch_number=extra_row.batch_number,
                        expiry_date=extra_row.expiry_date,
                        notes='Product create/update stock overwrite merge',
                        created_by=self.request.user
                    )
                    merged_rows += 1

            applied.append({
                'index': idx,
                'store_id': store.id,
                'batch_number': stock_level.batch_number,
                'old_quantity': str(old_quantity),
                'new_quantity': str(new_quantity),
                'delta': str(delta),
                'merged_rows': merged_rows,
            })
        return applied
    
    @action(detail=True, methods=['get'])
    def stock_levels(self, request, pk=None):
        product = self.get_object()
        stock_levels = StockLevel.objects.filter(product=product)
        scoped_store_id = _get_scoped_store_id(request)
        if scoped_store_id:
            stock_levels = stock_levels.filter(store_id=scoped_store_id)
        serializer = StockLevelSerializer(stock_levels, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def stock_history(self, request, pk=None):
        product = self.get_object()
        stock_records = StockRecord.objects.filter(product=product)
        scoped_store_id = _get_scoped_store_id(request)
        if scoped_store_id:
            stock_records = stock_records.filter(store_id=scoped_store_id)
        serializer = StockRecordSerializer(stock_records, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def adjust_stock(self, request, pk=None):
        product = self.get_object()
        logger.info(f"adjust_stock_requested actor_id={request.user.id} product_id={product.id}")
        
        # Validate input
        store_id = request.data.get('store')
        quantity = request.data.get('quantity')
        batch_number = _normalize_batch_number(request.data.get('batch_number'))
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
            store = self._resolve_store_for_stock(store_id)
            # Update stock level
            stock_level, _ = _get_or_create_stock_level_safe(
                product=product,
                store=store,
                batch_number=batch_number,
                defaults={'quantity': 0},
                lock_for_update=True,
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
                store=store,
                quantity=quantity,
                record_type='adjustment',
                batch_number=stock_level.batch_number,
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

    @action(detail=False, methods=['get'])
    def export_inventory_sheet(self, request):
        """
        Export product + stock snapshot for a store in a single-sheet Excel.
        """
        store = self._resolve_store_for_inventory_io(request.query_params.get('store'))
        logger.info(f"inventory_export_requested actor_id={request.user.id} store_id={store.id}")

        rows = []
        products = Product.objects.select_related('category').order_by('name')
        for product in products:
            stock = StockLevel.objects.filter(store=store, product=product).order_by('id').first()
            rows.append({
                'barcode': product.barcode,
                'product_name': product.name,
                'category': product.category.name if product.category else '',
                'description': product.description or '',
                'price': product.price,
                'cost_price': product.cost_price,
                'discount_price': product.discount_price if product.discount_price is not None else '',
                'tax': product.tax,
                'hsn_code': product.hsn_code or '',
                'unit': product.unit or '',
                'weight': product.weight if product.weight is not None else '',
                'is_active': product.is_active,
                'is_featured': product.is_featured,
                'is_service': product.is_service,
                'batch_number': stock.batch_number if stock and stock.batch_number else '',
                'expiry_date': stock.expiry_date.isoformat() if stock and stock.expiry_date else '',
                'quantity': stock.quantity if stock else Decimal('0'),
                'min_stock': stock.min_stock if stock else Decimal('0'),
                'max_stock': stock.max_stock if stock and stock.max_stock is not None else '',
            })

        if not rows:
            rows = [{
                'barcode': '',
                'product_name': '',
                'category': '',
                'description': '',
                'price': '',
                'cost_price': '',
                'discount_price': '',
                'tax': '',
                'hsn_code': '',
                'unit': '',
                'weight': '',
                'is_active': True,
                'is_featured': False,
                'is_service': False,
                'batch_number': '',
                'expiry_date': '',
                'quantity': '',
                'min_stock': '',
                'max_stock': '',
            }]

        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            pd.DataFrame(rows).to_excel(writer, index=False, sheet_name='inventory')
        output.seek(0)

        from django.http import HttpResponse
        response = HttpResponse(
            output.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        response['Content-Disposition'] = (
            f'attachment; filename="inventory_store_{store.code}_{timezone.now().strftime("%Y%m%d_%H%M%S")}.xlsx"'
        )
        logger.info(f"inventory_export_completed actor_id={request.user.id} store_id={store.id} rows={len(rows)}")
        return response

    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def import_inventory_sheet(self, request):
        """
        Import single-sheet inventory and override stock snapshot for selected store.
        Expected columns: barcode, product_name, category, description, price, cost_price, discount_price,
        tax, hsn_code, unit, weight, is_active, is_featured, is_service, batch_number, expiry_date,
        quantity, min_stock, max_stock
        """
        upload = request.FILES.get('file')
        if not upload:
            return Response({"detail": "file is required"}, status=status.HTTP_400_BAD_REQUEST)

        upload_entry = InventoryUpload.objects.create(file=upload)

        override = str(request.data.get('override', 'true')).lower() != 'false'
        store = self._resolve_store_for_inventory_io(request.data.get('store'))
        logger.info(
            f"inventory_import_requested actor_id={request.user.id} store_id={store.id} "
            f"override={override} filename={upload.name} upload_id={upload_entry.id}"
        )

        try:
            df = pd.read_excel(upload_entry.file, sheet_name=0)
        except Exception as e:
            return Response(
                {
                    "detail": f"Unable to read Excel file: {e}",
                    "upload": InventoryUploadSerializer(upload_entry).data,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        required_cols = {'barcode', 'product_name', 'price', 'cost_price', 'tax', 'quantity'}
        normalized_cols = {str(c).strip() for c in df.columns}
        missing = [c for c in required_cols if c not in normalized_cols]
        if missing:
            return Response({"detail": f"Missing required columns: {', '.join(missing)}"}, status=status.HTTP_400_BAD_REQUEST)

        # Normalize column names and values
        df.columns = [str(c).strip() for c in df.columns]
        df = df.fillna('')

        processed = 0
        created_products = 0
        updated_products = 0
        created_stock_levels = 0
        updated_stock_levels = 0
        errors = []
        seen_stock_keys = set()
        ref_id = f"INV-IMPORT-{timezone.now().strftime('%Y%m%d%H%M%S')}"

        for idx, row in df.iterrows():
            line = idx + 2
            try:
                with transaction.atomic():
                    barcode = str(row.get('barcode', '')).strip()
                    product_name = str(row.get('product_name', '')).strip()
                    if not barcode or not product_name:
                        continue

                    category_name = str(row.get('category', '')).strip()
                    category = None
                    if category_name:
                        slug = category_name.lower().replace(' ', '-')
                        category, _ = Category.objects.get_or_create(
                            slug=slug,
                            defaults={'name': category_name, 'is_active': True}
                        )
                        if category.name != category_name:
                            category.name = category_name
                            category.save(update_fields=['name'])

                    price = Decimal(str(row.get('price', 0) or 0))
                    cost_price = Decimal(str(row.get('cost_price', 0) or 0))
                    discount_price_raw = str(row.get('discount_price', '')).strip()
                    discount_price = Decimal(discount_price_raw) if discount_price_raw else None
                    tax = int(float(row.get('tax', 0) or 0))
                    tax = min([0, 5, 12, 18, 28], key=lambda x: abs(x - tax))
                    quantity = Decimal(str(row.get('quantity', 0) or 0))
                    min_stock = Decimal(str(row.get('min_stock', 0) or 0))
                    max_stock_raw = str(row.get('max_stock', '')).strip()
                    max_stock = Decimal(max_stock_raw) if max_stock_raw else None
                    batch_number = str(row.get('batch_number', '')).strip() or None
                    expiry_date = str(row.get('expiry_date', '')).strip() or None

                    product = Product.objects.filter(barcode=barcode).first()
                    if not product:
                        product = Product.objects.create(
                            name=product_name[:255],
                            barcode=barcode[:20],
                            category=category,
                            description=str(row.get('description', '')).strip() or None,
                            price=price,
                            cost_price=cost_price,
                            discount_price=discount_price,
                            tax=tax,
                            hsn_code=str(row.get('hsn_code', '')).strip() or None,
                            unit=str(row.get('unit', '')).strip() or 'piece',
                            weight=Decimal(str(row.get('weight', 0) or 0)) if str(row.get('weight', '')).strip() else None,
                            is_active=str(row.get('is_active', 'true')).lower() not in ['false', '0', 'no'],
                            is_featured=str(row.get('is_featured', 'false')).lower() in ['true', '1', 'yes'],
                            is_service=str(row.get('is_service', 'false')).lower() in ['true', '1', 'yes'],
                        )
                        created_products += 1
                    else:
                        product.name = product_name[:255]
                        product.category = category
                        product.description = str(row.get('description', '')).strip() or None
                        product.price = price
                        product.cost_price = cost_price
                        product.discount_price = discount_price
                        product.tax = tax
                        product.hsn_code = str(row.get('hsn_code', '')).strip() or None
                        product.unit = str(row.get('unit', '')).strip() or 'piece'
                        product.weight = Decimal(str(row.get('weight', 0) or 0)) if str(row.get('weight', '')).strip() else None
                        product.is_active = str(row.get('is_active', 'true')).lower() not in ['false', '0', 'no']
                        product.is_featured = str(row.get('is_featured', 'false')).lower() in ['true', '1', 'yes']
                        product.is_service = str(row.get('is_service', 'false')).lower() in ['true', '1', 'yes']
                        product.save()
                        updated_products += 1

                    stock_level, created = _get_or_create_stock_level_safe(
                        product=product,
                        store=store,
                        batch_number=batch_number,
                        defaults={'quantity': 0, 'min_stock': 0, 'max_stock': max_stock, 'expiry_date': expiry_date},
                        lock_for_update=True,
                    )
                    old_qty = Decimal(str(stock_level.quantity))
                    stock_level.quantity = quantity
                    stock_level.min_stock = min_stock
                    stock_level.max_stock = max_stock
                    if expiry_date:
                        stock_level.expiry_date = expiry_date
                    stock_level.save()
                    if created:
                        created_stock_levels += 1
                    else:
                        updated_stock_levels += 1

                    delta = quantity - old_qty
                    if delta != 0:
                        StockRecord.objects.create(
                            product=product,
                            store=store,
                            quantity=delta,
                            record_type='adjustment',
                            reference_id=ref_id,
                            batch_number=batch_number,
                            expiry_date=expiry_date,
                            notes='Inventory sheet import override',
                            created_by=request.user
                        )

                    seen_stock_keys.add((product.id, batch_number or ''))
                    processed += 1
            except Exception as e:
                errors.append({'line': line, 'error': str(e)})

        if override:
            remaining_levels = StockLevel.objects.filter(store=store).select_related('product')
            for level in remaining_levels:
                key = (level.product_id, level.batch_number or '')
                if key in seen_stock_keys:
                    continue
                old_qty = Decimal(str(level.quantity))
                if old_qty == 0:
                    continue
                try:
                    with transaction.atomic():
                        level.quantity = 0
                        level.save(update_fields=['quantity', 'updated_at'])
                        StockRecord.objects.create(
                            product=level.product,
                            store=store,
                            quantity=-old_qty,
                            record_type='adjustment',
                            reference_id=ref_id,
                            batch_number=level.batch_number,
                            expiry_date=level.expiry_date,
                            notes='Inventory sheet override reset',
                            created_by=request.user
                        )
                except Exception as e:
                    errors.append({
                        'line': 'override',
                        'product_id': level.product_id,
                        'batch_number': level.batch_number or '',
                        'error': str(e),
                    })

        AuditLog.objects.create(
            user=request.user,
            action='update',
            model_name='InventoryImport',
            object_id=str(store.id),
            object_repr=f"Store {store.code} inventory import",
            ip_address=get_client_ip(request),
            details={
                'upload_id': upload_entry.id,
                'override': override,
                'processed': processed,
                'errors': len(errors),
                'created_products': created_products,
                'updated_products': updated_products,
                'created_stock_levels': created_stock_levels,
                'updated_stock_levels': updated_stock_levels,
            }
        )

        logger.info(f"inventory_import_completed actor_id={request.user.id} store_id={store.id} processed={processed} errors={len(errors)}")
        return Response({
            'upload': InventoryUploadSerializer(upload_entry).data,
            'store_id': store.id,
            'override': override,
            'processed': processed,
            'created_products': created_products,
            'updated_products': updated_products,
            'created_stock_levels': created_stock_levels,
            'updated_stock_levels': updated_stock_levels,
            'errors': errors,
        }, status=status.HTTP_207_MULTI_STATUS if errors else status.HTTP_200_OK)

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
                store = self._resolve_store_for_stock(store_id)

                product = None
                if product_id:
                    product = Product.objects.filter(id=product_id).first()
                elif barcode:
                    product = Product.objects.filter(barcode=barcode).first()
                if not product:
                    raise ValueError("product not found")

                with transaction.atomic():
                    stock_level, _ = _get_or_create_stock_level_safe(
                        product=product,
                        store=store,
                        batch_number=batch_number,
                        defaults={'quantity': 0, 'expiry_date': expiry_date},
                        lock_for_update=True,
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
                        store=store,
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
                    'store_id': int(store.id),
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
        with transaction.atomic():
            product = serializer.save()
            stock_entries = self._extract_stock_entries()
            applied_stock = self._apply_stock_entries(product, stock_entries) if stock_entries else []
            logger.info(f"product_create_completed actor_id={self.request.user.id} product_id={product.id} stock_entries={len(applied_stock)}")
            AuditLog.objects.create(
                user=self.request.user,
                action='create',
                model_name='Product',
                object_id=str(product.id),
                object_repr=product.name,
                ip_address=get_client_ip(self.request),
                details={'stock_entries': applied_stock}
            )
    
    def perform_update(self, serializer):
        with transaction.atomic():
            product = serializer.save()
            stock_entries = self._extract_stock_entries()
            applied_stock = self._apply_stock_entries(product, stock_entries) if stock_entries else []
            logger.info(f"product_update_completed actor_id={self.request.user.id} product_id={product.id} stock_entries={len(applied_stock)}")
            AuditLog.objects.create(
                user=self.request.user,
                action='update',
                model_name='Product',
                object_id=str(product.id),
                object_repr=product.name,
                ip_address=get_client_ip(self.request),
                details={'stock_entries': applied_stock}
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
        queryset = StockRecord.objects.all()
        scoped_store_id = _get_scoped_store_id(self.request)
        if scoped_store_id:
            return queryset.filter(store_id=scoped_store_id)
        if user.role == 'admin':
            return queryset
        return queryset.none()

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
        scoped_store_id = _get_scoped_store_id(self.request)
        queryset = StockLevel.objects.all()
        if scoped_store_id:
            return queryset.filter(store_id=scoped_store_id)
        if self.request.user.role == 'admin':
            return queryset
        return queryset.none()
    
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

        try:
            store = _resolve_store_for_request(request, store_id)
        except ValidationError as e:
            return Response(e.detail, status=status.HTTP_400_BAD_REQUEST)

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
                product = Product.objects.filter(id=product_id).first()
                if not product:
                    raise ValueError("product not found")

                expected_qty = Decimal(str(expected_qty_raw))
                if expected_qty < 0:
                    raise ValueError("expected_quantity cannot be negative")

                with transaction.atomic():
                    stock_level, _ = _get_or_create_stock_level_safe(
                        product=product,
                        store=store,
                        batch_number=batch_number,
                        defaults={'quantity': 0},
                        lock_for_update=apply_changes,
                    )
                    current_qty = Decimal(str(stock_level.quantity))
                    difference = expected_qty - current_qty

                    entry = {
                        'index': idx,
                        'product_id': int(product.id),
                        'batch_number': batch_number,
                        'current_quantity': str(current_qty),
                        'expected_quantity': str(expected_qty),
                        'difference': str(difference),
                        'applied': False,
                    }

                    if apply_changes and difference != 0:
                        stock_level.quantity = expected_qty
                        stock_level.save(update_fields=['quantity', 'updated_at'])
                        StockRecord.objects.create(
                            product=product,
                            store=store,
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
            'store_id': int(store.id),
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
        user_store_id = getattr(user, 'store_id', None)
        if user_store_id:
            return StockTransfer.objects.filter(
                models.Q(from_store_id=user_store_id) | models.Q(to_store_id=user_store_id)
            )
        if user.role == 'admin':
            return StockTransfer.objects.all()
        return StockTransfer.objects.none()

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
                    from_stock, _ = _get_or_create_stock_level_safe(
                        product=item.product,
                        store=transfer.from_store,
                        defaults={'quantity': 0},
                        lock_for_update=True,
                    )
                    if from_stock.quantity < item.quantity:
                        raise ValidationError(
                            {"detail": f"Insufficient stock for product {item.product.name} in source store"}
                        )
                    from_stock.quantity -= item.quantity
                    from_stock.save()
                    
                    # Add stock to receiving store
                    to_stock, _ = _get_or_create_stock_level_safe(
                        product=item.product,
                        store=transfer.to_store,
                        batch_number=item.batch_number,
                        defaults={'quantity': 0},
                        lock_for_update=True,
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
                store = _resolve_store_for_request(request, store_id)

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
                    stock_level, _ = _get_or_create_stock_level_safe(
                        product=product,
                        store=store,
                        batch_number=batch_number,
                        defaults={'quantity': 0, 'expiry_date': expiry_date},
                        lock_for_update=True,
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
                            store=store,
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
                    'store_id': int(store.id),
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
