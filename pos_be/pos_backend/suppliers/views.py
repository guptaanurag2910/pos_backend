import logging

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError, NotFound
from django_filters.rest_framework import DjangoFilterBackend
from django.db import transaction, models
from django.utils import timezone
from django.db.models import Q
from decimal import Decimal, InvalidOperation

from .models import (
    Supplier, PurchaseOrder, PurchaseOrderItem, 
    GoodsReceiptNote, GoodsReceiptNoteItem, SupplierPayment, SupplierInvoice, SupplierInvoiceItem
)
from .serializers import (
    SupplierSerializer, PurchaseOrderSerializer, PurchaseOrderItemSerializer,
    GoodsReceiptNoteSerializer, GoodsReceiptNoteItemSerializer, SupplierPaymentSerializer,
    PurchaseOrderDetailSerializer, GoodsReceiptNoteDetailSerializer, SupplierInvoiceSerializer,
    SupplierInvoiceItemSerializer
)
from accounts.permissions import IsManagerUser
from accounts.models import AuditLog
from accounts.utils import get_client_ip
from stores.models import Store

logger = logging.getLogger('suppliers')


def _to_decimal(value, default='0'):
    try:
        if value is None or value == '':
            return Decimal(default)
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal(default)


def _is_global_admin(user):
    return bool(
        getattr(user, 'is_superuser', False) or
        (getattr(user, 'role', None) == 'admin' and not getattr(user, 'store_id', None))
    )


def _scope_store_queryset(queryset, user, store_field='store'):
    if _is_global_admin(user):
        return queryset
    user_store_id = getattr(user, 'store_id', None)
    if not user_store_id:
        return queryset.none()
    return queryset.filter(**{f'{store_field}_id': user_store_id})


def _assert_user_store_access(user, target_store_id, field_name='store'):
    if _is_global_admin(user):
        return
    user_store_id = getattr(user, 'store_id', None)
    if not user_store_id:
        raise ValidationError({field_name: "User is not assigned to a store."})
    if target_store_id and str(target_store_id) != str(user_store_id):
        raise ValidationError({field_name: "You can only access records for your assigned store."})


def _resolve_store(request):
    """
    Resolve store for create flows:
    1) request.user.store
    2) explicit request.data['store']
    3) main active store
    4) first active store
    """
    user_store = getattr(request.user, 'store', None)
    requested_store_id = request.data.get('store')
    if user_store:
        if requested_store_id and str(requested_store_id) != str(user_store.id):
            raise ValidationError({"store": "You can only access records for your assigned store."})
        logger.info(f"store_resolved_from_user user_id={request.user.id} store_id={user_store.id}")
        return user_store

    store_id = requested_store_id
    if store_id:
        try:
            store = Store.objects.get(id=store_id, is_active=True)
            logger.info(f"store_resolved_from_payload user_id={request.user.id} store_id={store.id}")
            return store
        except Store.DoesNotExist:
            raise ValidationError({"store": "Invalid or inactive store."})

    fallback = Store.objects.filter(is_main=True, is_active=True).first()
    if not fallback:
        fallback = Store.objects.filter(is_active=True).order_by('id').first()
    if fallback:
        logger.info(f"store_resolved_from_fallback user_id={request.user.id} store_id={fallback.id}")
        return fallback

    raise ValidationError(
        {"store": "No active store found. Assign a store to this user or create an active store."}
    )


def _recalculate_supplier_payment_effects(supplier):
    total_completed = SupplierPayment.objects.filter(
        supplier=supplier,
        status='completed',
        is_active=True
    ).aggregate(total=models.Sum('amount')).get('total') or Decimal('0')
    supplier.current_balance = total_completed
    supplier.save(update_fields=['current_balance', 'updated_at'])


def _recalculate_po_payment_status(po):
    total_paid = SupplierPayment.objects.filter(
        purchase_order=po,
        status='completed',
        is_active=True
    ).aggregate(total=models.Sum('amount')).get('total') or Decimal('0')
    if total_paid >= po.total:
        po.payment_status = 'paid'
    elif total_paid > 0:
        po.payment_status = 'partially_paid'
    else:
        po.payment_status = 'pending'
    po.save(update_fields=['payment_status', 'updated_at'])


def _recalculate_invoice_payment_status(invoice):
    previous_status = invoice.status
    total_paid = SupplierPayment.objects.filter(
        supplier_invoice=invoice,
        status='completed',
        is_active=True
    ).aggregate(total=models.Sum('amount')).get('total') or Decimal('0')
    invoice.amount_paid = total_paid
    if total_paid >= invoice.grand_total:
        invoice.status = 'paid'
    elif total_paid > 0:
        invoice.status = 'partially_paid'
    else:
        if previous_status in ['paid', 'partially_paid']:
            invoice.status = 'approved'
        else:
            invoice.status = previous_status
    invoice.save(update_fields=['amount_paid', 'status', 'updated_at'])


def _validate_invoice_payment_limit(invoice, amount, exclude_payment_id=None):
    if not invoice:
        return
    base_qs = SupplierPayment.objects.filter(
        supplier_invoice=invoice,
        status='completed',
        is_active=True
    )
    if exclude_payment_id:
        base_qs = base_qs.exclude(id=exclude_payment_id)
    already_paid = base_qs.aggregate(total=models.Sum('amount')).get('total') or Decimal('0')
    if already_paid + amount > invoice.grand_total:
        raise ValidationError({
            "amount": (
                f"Payment exceeds invoice due amount. Due: {invoice.grand_total - already_paid}, "
                f"attempted: {amount}."
            )
        })


def _complete_grn_and_update_inventory(grn, actor):
    from inventory.models import StockRecord, StockLevel

    # Idempotency guard: if purchase stock records already exist for this GRN, skip stock posting.
    already_posted = StockRecord.objects.filter(
        record_type='purchase',
        reference_id=grn.grn_number,
        store=grn.store
    ).exists()

    if not already_posted:
        for item in grn.items.all():
            StockRecord.objects.create(
                product=item.product,
                store=grn.store,
                quantity=item.quantity,
                record_type='purchase',
                reference_id=grn.grn_number,
                batch_number=item.batch_number,
                expiry_date=item.expiry_date,
                created_by=actor
            )

            stock_level, _ = StockLevel.objects.get_or_create(
                product=item.product,
                store=grn.store,
                batch_number=item.batch_number,
                defaults={
                    'quantity': 0,
                    'expiry_date': item.expiry_date
                }
            )
            stock_level.quantity += item.quantity
            if not stock_level.expiry_date and item.expiry_date:
                stock_level.expiry_date = item.expiry_date
            stock_level.save()

            product = item.product
            if product.cost_price != item.unit_price:
                product.cost_price = item.unit_price
                product.save(update_fields=['cost_price', 'updated_at'])

    if grn.status != 'completed':
        grn.status = 'completed'
        grn.save(update_fields=['status', 'updated_at'])

    if grn.purchase_order:
        po = grn.purchase_order
        all_received = True
        for po_item in po.items.all():
            received_qty = GoodsReceiptNoteItem.objects.filter(
                grn__purchase_order=po,
                grn__status='completed',
                product=po_item.product
            ).aggregate(total=models.Sum('quantity')).get('total') or Decimal('0')
            po_item.quantity_received = received_qty
            po_item.save(update_fields=['quantity_received'])
            if received_qty < po_item.quantity_ordered:
                all_received = False

        po.status = 'received' if all_received else 'partially_received'
        po.save(update_fields=['status', 'updated_at'])

class SupplierViewSet(viewsets.ModelViewSet):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    permission_classes = [IsAuthenticated, IsManagerUser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['is_active', 'city', 'state']
    search_fields = ['name', 'contact_person', 'phone', 'email', 'gst_number']
    
    @action(detail=True, methods=['get'])
    def purchase_history(self, request, pk=None):
        supplier = self.get_object()
        purchase_orders = supplier.purchase_orders.all()
        serializer = PurchaseOrderSerializer(purchase_orders, many=True, context={'request': request})
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def payment_history(self, request, pk=None):
        supplier = self.get_object()
        payments = supplier.payments.all()
        serializer = SupplierPaymentSerializer(payments, many=True, context={'request': request})
        return Response(serializer.data)
    
    def perform_create(self, serializer):
        with transaction.atomic():
            supplier = serializer.save(created_by=self.request.user)
            logger.info(f"supplier_create_completed actor_id={self.request.user.id} supplier_id={supplier.id}")
            
            # Log the action
            AuditLog.objects.create(
                user=self.request.user,
                action='create',
                model_name='Supplier',
                object_id=str(supplier.id),
                object_repr=supplier.name,
                ip_address=get_client_ip(self.request)
            )

class PurchaseOrderViewSet(viewsets.ModelViewSet):
    queryset = PurchaseOrder.objects.all()
    permission_classes = [IsAuthenticated, IsManagerUser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['supplier', 'store', 'status', 'payment_status', 'order_date']
    search_fields = ['po_number', 'supplier__name', 'notes']
    ordering_fields = ['created_at', 'order_date', 'expected_delivery_date', 'total']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return PurchaseOrderDetailSerializer
        return PurchaseOrderSerializer
    
    def get_queryset(self):
        user = getattr(self.request, 'user', None)
        if not user or not getattr(user, 'is_authenticated', False):
            return PurchaseOrder.objects.none()
        role = getattr(user, 'role', None)
        if role not in ['admin', 'manager', 'cashier']:
            return PurchaseOrder.objects.none()
        return _scope_store_queryset(PurchaseOrder.objects.all(), user)
    
    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        purchase_order = self.get_object()
        new_status = request.data.get('status')
        logger.info(f"po_status_requested actor_id={request.user.id} po_id={purchase_order.id} new_status={new_status}")
        
        valid_statuses = dict(PurchaseOrder.STATUS_CHOICES).keys()
        if not new_status or new_status not in valid_statuses:
            return Response(
                {"detail": f"Invalid status. Must be one of: {', '.join(valid_statuses)}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        with transaction.atomic():
            purchase_order.status = new_status
            purchase_order.save()
            
            # Log the action
            AuditLog.objects.create(
                user=request.user,
                action='update',
                model_name='PurchaseOrder',
                object_id=str(purchase_order.id),
                object_repr=purchase_order.po_number,
                ip_address=get_client_ip(request),
                details={
                    'action': 'update_status',
                    'new_status': new_status
                }
            )
        logger.info(f"po_status_completed actor_id={request.user.id} po_id={purchase_order.id} new_status={new_status}")
        
        serializer = self.get_serializer(purchase_order)
        return Response(serializer.data)

    def perform_create(self, serializer):
        with transaction.atomic():
            # Generate PO number
            store = _resolve_store(self.request)
            today = timezone.now().strftime('%Y%m%d')

            last_po = PurchaseOrder.objects.filter(
                store=store,
                po_number__startswith=f"PO-{store.code}-{today}"
            ).order_by('-po_number').first()

            if last_po:
                try:
                    last_num = int(last_po.po_number.split('-')[-1])
                    po_number = f"PO-{store.code}-{today}-{last_num + 1:03d}"
                except ValueError:
                    po_number = f"PO-{store.code}-{today}-001"
            else:
                po_number = f"PO-{store.code}-{today}-001"

            items_data = serializer.validated_data.pop('items', [])  # Extract items here
            po = serializer.save(po_number=po_number, store=store, created_by=self.request.user)
            logger.info(f"po_create_started actor_id={self.request.user.id} po_id={po.id} po_number={po.po_number}")

            # Create each PurchaseOrderItem
            for item_data in items_data:
                PurchaseOrderItem.objects.create(purchase_order=po, **item_data)

            po.calculate_totals()

            # Audit log
            AuditLog.objects.create(
                user=self.request.user,
                action='create',
                model_name='PurchaseOrder',
                object_id=str(po.id),
                object_repr=po.po_number,
                ip_address=get_client_ip(self.request)
            )
            logger.info(f"po_create_completed actor_id={self.request.user.id} po_id={po.id} items={len(items_data)}")

class PurchaseOrderItemViewSet(viewsets.ModelViewSet):
    serializer_class = PurchaseOrderItemSerializer
    permission_classes = [IsAuthenticated, IsManagerUser]

    def _get_scoped_purchase_order(self):
        po_id = self.kwargs.get('po_pk')
        if not po_id:
            raise NotFound("Purchase order not found.")
        po = _scope_store_queryset(PurchaseOrder.objects.all(), self.request.user).filter(id=po_id).first()
        if not po:
            raise NotFound("Purchase order not found.")
        return po

    def get_queryset(self):
        try:
            purchase_order = self._get_scoped_purchase_order()
        except NotFound:
            return PurchaseOrderItem.objects.none()
        return PurchaseOrderItem.objects.filter(purchase_order=purchase_order)
    
    def perform_create(self, serializer):
        purchase_order = self._get_scoped_purchase_order()

        if purchase_order.status not in ['draft', 'sent']:
            raise ValidationError({"detail": f"Cannot add items to a {purchase_order.status} purchase order"})

        with transaction.atomic():
            item = serializer.save(purchase_order=purchase_order)
            
            # Update PO totals
            purchase_order.calculate_totals()
            
            # Log the action
            AuditLog.objects.create(
                user=self.request.user,
                action='create',
                model_name='PurchaseOrderItem',
                object_id=str(item.id),
                object_repr=str(item),
                ip_address=get_client_ip(self.request),
                details={'purchase_order': purchase_order.po_number}
            )
    
    def perform_update(self, serializer):
        with transaction.atomic():
            existing_po = serializer.instance.purchase_order
            if not _scope_store_queryset(PurchaseOrder.objects.all(), self.request.user).filter(id=existing_po.id).exists():
                raise NotFound("Purchase order item not found.")
            item = serializer.save()
            
            # Update PO totals
            purchase_order = item.purchase_order
            purchase_order.calculate_totals()
            
            # Log the action
            AuditLog.objects.create(
                user=self.request.user,
                action='update',
                model_name='PurchaseOrderItem',
                object_id=str(item.id),
                object_repr=str(item),
                ip_address=get_client_ip(self.request),
                details={'purchase_order': purchase_order.po_number}
            )
    
    def perform_destroy(self, instance):
        purchase_order = instance.purchase_order

        if not _scope_store_queryset(PurchaseOrder.objects.all(), self.request.user).filter(id=purchase_order.id).exists():
            raise NotFound("Purchase order item not found.")

        if purchase_order.status not in ['draft', 'sent']:
            raise ValidationError({"detail": f"Cannot remove items from a {purchase_order.status} purchase order"})
        
        with transaction.atomic():
            # Log the action before deletion
            AuditLog.objects.create(
                user=self.request.user,
                action='delete',
                model_name='PurchaseOrderItem',
                object_id=str(instance.id),
                object_repr=str(instance),
                ip_address=get_client_ip(self.request),
                details={'purchase_order': purchase_order.po_number}
            )
            
            instance.delete()
            
            # Update PO totals
            purchase_order.calculate_totals()

class GoodsReceiptNoteViewSet(viewsets.ModelViewSet):
    queryset = GoodsReceiptNote.objects.all()
    permission_classes = [IsAuthenticated, IsManagerUser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['supplier', 'store', 'status', 'receipt_date', 'purchase_order', 'is_active']
    search_fields = ['grn_number', 'invoice_number', 'supplier__name', 'notes']
    ordering_fields = ['created_at', 'receipt_date', 'total']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return GoodsReceiptNoteDetailSerializer
        return GoodsReceiptNoteSerializer
    
    def get_queryset(self):
        user = getattr(self.request, 'user', None)
        if not user or not getattr(user, 'is_authenticated', False):
            return GoodsReceiptNote.objects.none()
        role = getattr(user, 'role', None)
        if role not in ['admin', 'manager', 'cashier']:
            return GoodsReceiptNote.objects.none()
        include_inactive = str(self.request.query_params.get('include_inactive', 'false')).lower() == 'true'
        qs = _scope_store_queryset(GoodsReceiptNote.objects.all(), user)
        if not include_inactive:
            qs = qs.filter(is_active=True)
        return qs

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        was_completed = instance.status == 'completed'
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            self.perform_update(serializer)

            items_data = request.data.get('items', [])
            po_items_data = request.data.get('po_items', [])

            # Clear existing GRN items
            if items_data:
                instance.items.all().delete()

                for item in items_data:
                    product_id = item.get('product_id') or item.get('product')
                    if not product_id:
                        continue  # skip invalid items

                    GoodsReceiptNoteItem.objects.create(
                        grn=instance,
                        product_id=product_id,
                        quantity=item.get('received_quantity', 0),
                        unit_price=item.get('unit_price', 0),
                        discount_percentage=item.get('discount_percentage', 0),
                        discount_amount=item.get('discount_amount', 0),
                        tax_rate=item.get('tax_rate', 0),
                        tax_amount=item.get('tax_amount', 0),
                        total=item.get('total', 0),
                        batch_number=item.get('batch_no'),
                        expiry_date=item.get('expiry_date') or None
                    )

            # Update corresponding PO items
            for po_item in po_items_data:
                product_id = po_item.get('product')
                if not product_id:
                    continue

                try:
                    po_item_obj = PurchaseOrderItem.objects.get(
                        purchase_order=instance.purchase_order,
                        product_id=product_id
                    )

                    # Match GRN item using product_id or product
                    matched_grn_item = next(
                        (i for i in items_data if (i.get('product_id') or i.get('product')) == product_id),
                        None
                    )
                    if matched_grn_item:
                        po_item_obj.quantity_received += _to_decimal(matched_grn_item.get('received_quantity', 0))
                        po_item_obj.discount_percentage = _to_decimal(matched_grn_item.get('discount_percentage', 0))
                        po_item_obj.discount_amount = _to_decimal(matched_grn_item.get('discount_amount', 0))
                        po_item_obj.tax_rate = _to_decimal(matched_grn_item.get('tax_rate', 0))
                        po_item_obj.tax_amount = _to_decimal(matched_grn_item.get('tax_amount', 0))
                        po_item_obj.total = _to_decimal(matched_grn_item.get('total', 0))
                        po_item_obj.save()

                except PurchaseOrderItem.DoesNotExist:
                    pass  # gracefully ignore missing PO item

            # Recalculate totals
            instance.calculate_totals()
            if instance.purchase_order:
                instance.purchase_order.calculate_totals()
            if instance.status == 'completed' and not was_completed:
                _complete_grn_and_update_inventory(instance, request.user)

        return Response(self.get_serializer(instance).data)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        grn = self.get_object()
        logger.info(f"grn_complete_requested actor_id={request.user.id} grn_id={grn.id}")

        with transaction.atomic():
            _complete_grn_and_update_inventory(grn, request.user)
            
            # Log the action
            AuditLog.objects.create(
                user=request.user,
                action='update',
                model_name='GoodsReceiptNote',
                object_id=str(grn.id),
                object_repr=grn.grn_number,
                ip_address=get_client_ip(request),
                details={'action': 'complete'}
            )
        logger.info(f"grn_complete_completed actor_id={request.user.id} grn_id={grn.id} status={grn.status}")
        
        serializer = self.get_serializer(grn)
        return Response(serializer.data)

    def perform_destroy(self, instance):
        with transaction.atomic():
            if not instance.is_active:
                return
            instance.is_active = False
            instance.save(update_fields=['is_active', 'updated_at'])
            AuditLog.objects.create(
                user=self.request.user,
                action='delete',
                model_name='GoodsReceiptNote',
                object_id=str(instance.id),
                object_repr=instance.grn_number,
                ip_address=get_client_ip(self.request),
                details={'action': 'soft_delete'}
            )
            logger.info(f"grn_soft_delete_completed actor_id={self.request.user.id} grn_id={instance.id}")

    def perform_create(self, serializer):
        with transaction.atomic():
            store = _resolve_store(self.request)
            purchase_order = serializer.validated_data.get('purchase_order')
            if purchase_order and purchase_order.store_id != store.id:
                raise ValidationError({"purchase_order": "Purchase order belongs to a different store."})
            today = timezone.now().strftime('%Y%m%d')

            last_grn = GoodsReceiptNote.objects.filter(
                store=store,
                grn_number__startswith=f"GRN-{store.code}-{today}"
            ).order_by('-grn_number').first()

            if last_grn:
                try:
                    last_num = int(last_grn.grn_number.split('-')[-1])
                    grn_number = f"GRN-{store.code}-{today}-{last_num + 1:03d}"
                except ValueError:
                    grn_number = f"GRN-{store.code}-{today}-001"
            else:
                grn_number = f"GRN-{store.code}-{today}-001"

            # Extract items and po_items data from request
            items_data = self.request.data.get('items', [])
            po_items_data = self.request.data.get('po_items', [])
            grn = serializer.save(grn_number=grn_number, store=store, created_by=self.request.user)
            logger.info(f"grn_create_started actor_id={self.request.user.id} grn_id={grn.id} grn_number={grn.grn_number}")

            # Create GRN Items
            for item in items_data:
                GoodsReceiptNoteItem.objects.create(
                    grn=grn,
                    product_id=item['product_id'],
                    quantity=item['received_quantity'],
                    unit_price=item['unit_price'],
                    discount_percentage=item['discount_percentage'],
                    discount_amount=item['discount_amount'],
                    tax_rate=item['tax_rate'],
                    tax_amount=item['tax_amount'],
                    total=item['total'],
                    batch_number=item.get('batch_no'),
                    expiry_date=item.get('expiry_date') or None
                )

            # Update matching PO items
            for po_item in po_items_data:
                product_id = po_item['product']
                try:
                    po_item_obj = PurchaseOrderItem.objects.get(purchase_order=grn.purchase_order,
                                                                product_id=product_id)
                    # find corresponding received item
                    matched_grn_item = next((i for i in items_data if i['product_id'] == product_id), None)
                    if matched_grn_item:
                        po_item_obj.quantity_received += _to_decimal(matched_grn_item.get('received_quantity', 0))
                        po_item_obj.discount_percentage = _to_decimal(matched_grn_item.get('discount_percentage', 0))
                        po_item_obj.discount_amount = _to_decimal(matched_grn_item.get('discount_amount', 0))
                        po_item_obj.tax_rate = _to_decimal(matched_grn_item.get('tax_rate', 0))
                        po_item_obj.tax_amount = _to_decimal(matched_grn_item.get('tax_amount', 0))
                        po_item_obj.total = _to_decimal(matched_grn_item.get('total', 0))
                        po_item_obj.save()
                except PurchaseOrderItem.DoesNotExist:
                    pass  # ignore if not found

            grn.calculate_totals()
            if grn.purchase_order:
                grn.purchase_order.calculate_totals()
            if grn.status == 'completed':
                _complete_grn_and_update_inventory(grn, self.request.user)

            # Audit log
            AuditLog.objects.create(
                user=self.request.user,
                action='create',
                model_name='GoodsReceiptNote',
                object_id=str(grn.id),
                object_repr=grn.grn_number,
                ip_address=get_client_ip(self.request)
            )
            logger.info(f"grn_create_completed actor_id={self.request.user.id} grn_id={grn.id} items={len(items_data)}")


class GoodsReceiptNoteItemViewSet(viewsets.ModelViewSet):
    serializer_class = GoodsReceiptNoteItemSerializer
    permission_classes = [IsAuthenticated, IsManagerUser]

    def _get_scoped_grn(self):
        grn_id = self.kwargs.get('grn_pk')
        if not grn_id:
            raise NotFound("GRN not found.")
        grn = _scope_store_queryset(GoodsReceiptNote.objects.all(), self.request.user).filter(id=grn_id).first()
        if not grn:
            raise NotFound("GRN not found.")
        return grn

    def get_queryset(self):
        try:
            grn = self._get_scoped_grn()
        except NotFound:
            return GoodsReceiptNoteItem.objects.none()
        return GoodsReceiptNoteItem.objects.filter(grn=grn)
    
    def perform_create(self, serializer):
        grn = self._get_scoped_grn()

        if grn.status == 'completed':
            raise ValidationError({"detail": "Cannot add items to a completed GRN"})

        with transaction.atomic():
            item = serializer.save(grn=grn)
            
            # Update GRN totals
            grn.calculate_totals()
            
            # Log the action
            AuditLog.objects.create(
                user=self.request.user,
                action='create',
                model_name='GoodsReceiptNoteItem',
                object_id=str(item.id),
                object_repr=str(item),
                ip_address=get_client_ip(self.request),
                details={'grn': grn.grn_number}
            )

    def perform_update(self, serializer):
        with transaction.atomic():
            existing_grn = serializer.instance.grn
            if not _scope_store_queryset(GoodsReceiptNote.objects.all(), self.request.user).filter(id=existing_grn.id).exists():
                raise NotFound("GRN item not found.")
            item = serializer.save()
            item.grn.calculate_totals()

    def perform_destroy(self, instance):
        grn = instance.grn
        if not _scope_store_queryset(GoodsReceiptNote.objects.all(), self.request.user).filter(id=grn.id).exists():
            raise NotFound("GRN item not found.")
        instance.delete()
        grn.calculate_totals()


class SupplierInvoiceViewSet(viewsets.ModelViewSet):
    queryset = SupplierInvoice.objects.all().order_by('-created_at')
    serializer_class = SupplierInvoiceSerializer
    permission_classes = [IsAuthenticated, IsManagerUser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['supplier', 'purchase_order', 'grn', 'store', 'status', 'invoice_date', 'due_date', 'is_active']
    search_fields = ['invoice_number', 'supplier_invoice_number', 'supplier_name', 'po_number', 'grn_number']
    ordering_fields = ['created_at', 'invoice_date', 'due_date', 'grand_total']
    ordering = ['-created_at']

    def get_queryset(self):
        user = getattr(self.request, 'user', None)
        if not user or not getattr(user, 'is_authenticated', False):
            return SupplierInvoice.objects.none()
        role = getattr(user, 'role', None)
        if role not in ['admin', 'manager', 'cashier']:
            return SupplierInvoice.objects.none()
        include_inactive = str(self.request.query_params.get('include_inactive', 'false')).lower() == 'true'
        if _is_global_admin(user):
            qs = SupplierInvoice.objects.all()
        else:
            user_store_id = getattr(user, 'store_id', None)
            if not user_store_id:
                return SupplierInvoice.objects.none()
            qs = SupplierInvoice.objects.filter(
                Q(store_id=user_store_id) |
                Q(store__isnull=True, created_by=user)
            )
        if not include_inactive:
            qs = qs.filter(is_active=True)
        return qs.order_by('-created_at')

    def perform_create(self, serializer):
        with transaction.atomic():
            store = _resolve_store(self.request)
            supplier = serializer.validated_data.get('supplier')
            purchase_order = serializer.validated_data.get('purchase_order')
            grn = serializer.validated_data.get('grn')

            if purchase_order and purchase_order.store_id != store.id:
                raise ValidationError({"purchase_order": "Purchase order belongs to a different store."})
            if grn and grn.store_id != store.id:
                raise ValidationError({"grn": "GRN belongs to a different store."})

            if not serializer.validated_data.get('invoice_number'):
                date_part = timezone.now().strftime('%Y%m%d')
                store_code = store.code if store else 'GEN'
                supplier_part = (supplier.name[:3].upper() if supplier and supplier.name else 'SUP')
                last_invoice = SupplierInvoice.objects.filter(
                    invoice_number__startswith=f"SI-{store_code}-{date_part}"
                ).order_by('-invoice_number').first()
                seq = 1
                if last_invoice:
                    try:
                        seq = int(last_invoice.invoice_number.split('-')[-1]) + 1
                    except (ValueError, IndexError):
                        seq = 1
                invoice_number = f"SI-{store_code}-{date_part}-{seq:03d}"
            else:
                invoice_number = serializer.validated_data['invoice_number']

            invoice = serializer.save(
                invoice_number=invoice_number,
                store=store,
                created_by=self.request.user,
                supplier_name=serializer.validated_data.get('supplier_name') or (supplier.name if supplier else None),
                po_number=serializer.validated_data.get('po_number') or (
                    serializer.validated_data.get('purchase_order').po_number
                    if serializer.validated_data.get('purchase_order') else None
                ),
                grn_number=serializer.validated_data.get('grn_number') or (
                    serializer.validated_data.get('grn').grn_number
                    if serializer.validated_data.get('grn') else None
                )
            )
            invoice.calculate_totals()
            invoice.save(update_fields=['subtotal', 'discount_total', 'tax_total', 'grand_total', 'updated_at'])
            logger.info(f"supplier_invoice_create_completed actor_id={self.request.user.id} invoice_id={invoice.id} invoice_number={invoice.invoice_number}")

            AuditLog.objects.create(
                user=self.request.user,
                action='create',
                model_name='SupplierInvoice',
                object_id=str(invoice.id),
                object_repr=invoice.invoice_number,
                ip_address=get_client_ip(self.request)
            )

    def perform_update(self, serializer):
        with transaction.atomic():
            target_store_id = serializer.instance.store_id or getattr(self.request.user, 'store_id', None)
            purchase_order = serializer.validated_data.get('purchase_order', serializer.instance.purchase_order)
            grn = serializer.validated_data.get('grn', serializer.instance.grn)
            if purchase_order and target_store_id and purchase_order.store_id != target_store_id:
                raise ValidationError({"purchase_order": "Purchase order belongs to a different store."})
            if grn and target_store_id and grn.store_id != target_store_id:
                raise ValidationError({"grn": "GRN belongs to a different store."})

            invoice = serializer.save()
            invoice.calculate_totals()
            invoice.save(update_fields=['subtotal', 'discount_total', 'tax_total', 'grand_total', 'updated_at'])
            logger.info(f"supplier_invoice_update_completed actor_id={self.request.user.id} invoice_id={invoice.id}")
            AuditLog.objects.create(
                user=self.request.user,
                action='update',
                model_name='SupplierInvoice',
                object_id=str(invoice.id),
                object_repr=invoice.invoice_number,
                ip_address=get_client_ip(self.request)
            )

    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        invoice = self.get_object()
        new_status = request.data.get('status')
        logger.info(f"supplier_invoice_status_requested actor_id={request.user.id} invoice_id={invoice.id} new_status={new_status}")
        valid_statuses = dict(SupplierInvoice.STATUS_CHOICES).keys()
        if new_status not in valid_statuses:
            return Response(
                {"detail": f"Invalid status. Must be one of: {', '.join(valid_statuses)}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        invoice.status = new_status
        invoice.save(update_fields=['status', 'updated_at'])
        logger.info(f"supplier_invoice_status_completed actor_id={request.user.id} invoice_id={invoice.id} new_status={new_status}")
        return Response(self.get_serializer(invoice).data)

    def perform_destroy(self, instance):
        with transaction.atomic():
            if not instance.is_active:
                return
            instance.is_active = False
            instance.save(update_fields=['is_active', 'updated_at'])
            AuditLog.objects.create(
                user=self.request.user,
                action='delete',
                model_name='SupplierInvoice',
                object_id=str(instance.id),
                object_repr=instance.invoice_number,
                ip_address=get_client_ip(self.request),
                details={'action': 'soft_delete'}
            )
            logger.info(f"supplier_invoice_soft_delete_completed actor_id={self.request.user.id} invoice_id={instance.id}")


class SupplierInvoiceItemViewSet(viewsets.ModelViewSet):
    serializer_class = SupplierInvoiceItemSerializer
    permission_classes = [IsAuthenticated, IsManagerUser]

    def _get_scoped_invoice(self):
        invoice_id = self.kwargs.get('invoice_pk')
        if not invoice_id:
            raise NotFound("Supplier invoice not found.")
        invoice = self._scoped_invoice_queryset().filter(id=invoice_id).first()
        if not invoice:
            raise NotFound("Supplier invoice not found.")
        return invoice

    def _scoped_invoice_queryset(self):
        user = self.request.user
        if _is_global_admin(user):
            return SupplierInvoice.objects.all()
        user_store_id = getattr(user, 'store_id', None)
        if not user_store_id:
            return SupplierInvoice.objects.none()
        return SupplierInvoice.objects.filter(
            Q(store_id=user_store_id) |
            Q(store__isnull=True, created_by=user)
        )

    def get_queryset(self):
        try:
            invoice = self._get_scoped_invoice()
        except NotFound:
            return SupplierInvoiceItem.objects.none()
        return SupplierInvoiceItem.objects.filter(invoice=invoice)

    def perform_create(self, serializer):
        invoice = self._get_scoped_invoice()
        item = serializer.save(invoice=invoice)
        invoice.calculate_totals()
        invoice.save(update_fields=['subtotal', 'discount_total', 'tax_total', 'grand_total', 'updated_at'])
        AuditLog.objects.create(
            user=self.request.user,
            action='create',
            model_name='SupplierInvoiceItem',
            object_id=str(item.id),
            object_repr=f"{invoice.invoice_number} item",
            ip_address=get_client_ip(self.request)
        )

    def perform_update(self, serializer):
        existing_invoice = serializer.instance.invoice
        if not self._scoped_invoice_queryset().filter(id=existing_invoice.id).exists():
            raise NotFound("Supplier invoice item not found.")
        item = serializer.save()
        invoice = item.invoice
        invoice.calculate_totals()
        invoice.save(update_fields=['subtotal', 'discount_total', 'tax_total', 'grand_total', 'updated_at'])
        AuditLog.objects.create(
            user=self.request.user,
            action='update',
            model_name='SupplierInvoiceItem',
            object_id=str(item.id),
            object_repr=f"InvoiceItem#{item.id}",
            ip_address=get_client_ip(self.request)
        )

    def perform_destroy(self, instance):
        invoice = instance.invoice
        if not self._scoped_invoice_queryset().filter(id=invoice.id).exists():
            raise NotFound("Supplier invoice item not found.")
        AuditLog.objects.create(
            user=self.request.user,
            action='delete',
            model_name='SupplierInvoiceItem',
            object_id=str(instance.id),
            object_repr=f"InvoiceItem#{instance.id}",
            ip_address=get_client_ip(self.request)
        )
        instance.delete()
        invoice.calculate_totals()
        invoice.save(update_fields=['subtotal', 'discount_total', 'tax_total', 'grand_total', 'updated_at'])

class SupplierPaymentViewSet(viewsets.ModelViewSet):
    queryset = SupplierPayment.objects.all()
    serializer_class = SupplierPaymentSerializer
    permission_classes = [IsAuthenticated, IsManagerUser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['supplier', 'purchase_order', 'supplier_invoice', 'payment_method', 'status', 'payment_date', 'is_active']
    search_fields = ['reference_number', 'notes', 'supplier__name']
    ordering_fields = ['payment_date', 'amount', 'created_at']
    ordering = ['-payment_date']
    
    def get_queryset(self):
        user = getattr(self.request, 'user', None)
        if not user or not getattr(user, 'is_authenticated', False):
            return SupplierPayment.objects.none()
        role = getattr(user, 'role', None)
        if role not in ['admin', 'manager', 'cashier']:
            return SupplierPayment.objects.none()
        include_inactive = str(self.request.query_params.get('include_inactive', 'false')).lower() == 'true'
        if _is_global_admin(user):
            qs = SupplierPayment.objects.all()
        else:
            user_store_id = getattr(user, 'store_id', None)
            if not user_store_id:
                return SupplierPayment.objects.none()
            qs = SupplierPayment.objects.filter(
                Q(purchase_order__store_id=user_store_id) |
                Q(supplier_invoice__store_id=user_store_id) |
                Q(purchase_order__isnull=True, supplier_invoice__isnull=True, created_by=user)
            )
        if not include_inactive:
            qs = qs.filter(is_active=True)
        return qs
    
    def perform_create(self, serializer):
        with transaction.atomic():
            purchase_order = serializer.validated_data.get('purchase_order')
            invoice = serializer.validated_data.get('supplier_invoice')
            if purchase_order:
                _assert_user_store_access(self.request.user, purchase_order.store_id, field_name='purchase_order')
            if invoice:
                _assert_user_store_access(self.request.user, invoice.store_id, field_name='supplier_invoice')
            if purchase_order and invoice and purchase_order.store_id and invoice.store_id and purchase_order.store_id != invoice.store_id:
                raise ValidationError({"detail": "purchase_order and supplier_invoice must belong to the same store."})

            payment_status = serializer.validated_data.get('status')
            amount = _to_decimal(serializer.validated_data.get('amount', 0))
            if invoice and payment_status == 'completed':
                _validate_invoice_payment_limit(invoice, amount)

            payment = serializer.save(created_by=self.request.user)

            if payment.supplier:
                _recalculate_supplier_payment_effects(payment.supplier)
            if payment.purchase_order:
                _recalculate_po_payment_status(payment.purchase_order)
            if payment.supplier_invoice:
                _recalculate_invoice_payment_status(payment.supplier_invoice)
            logger.info(f"supplier_payment_create_completed actor_id={self.request.user.id} payment_id={payment.id} amount={payment.amount}")
            
            # Log the action
            AuditLog.objects.create(
                user=self.request.user,
                action='create',
                model_name='SupplierPayment',
                object_id=str(payment.id),
                object_repr=str(payment),
                ip_address=get_client_ip(self.request)
            )

    def perform_update(self, serializer):
        with transaction.atomic():
            old_payment = SupplierPayment.objects.select_related('supplier', 'purchase_order', 'supplier_invoice').get(
                id=serializer.instance.id
            )
            old_supplier = old_payment.supplier
            old_po = old_payment.purchase_order
            old_invoice = old_payment.supplier_invoice

            new_po = serializer.validated_data.get('purchase_order', old_po)
            new_invoice = serializer.validated_data.get('supplier_invoice', old_invoice)
            new_status = serializer.validated_data.get('status', old_payment.status)
            new_amount = _to_decimal(serializer.validated_data.get('amount', old_payment.amount))

            if new_po:
                _assert_user_store_access(self.request.user, new_po.store_id, field_name='purchase_order')
            if new_invoice:
                _assert_user_store_access(self.request.user, new_invoice.store_id, field_name='supplier_invoice')
            if new_po and new_invoice and new_po.store_id and new_invoice.store_id and new_po.store_id != new_invoice.store_id:
                raise ValidationError({"detail": "purchase_order and supplier_invoice must belong to the same store."})
            if new_invoice and new_status == 'completed':
                _validate_invoice_payment_limit(new_invoice, new_amount, exclude_payment_id=old_payment.id)

            payment = serializer.save()

            related_suppliers = {obj for obj in [old_supplier, payment.supplier] if obj is not None}
            for supplier in related_suppliers:
                _recalculate_supplier_payment_effects(supplier)

            related_pos = {obj for obj in [old_po, payment.purchase_order] if obj is not None}
            for po in related_pos:
                _recalculate_po_payment_status(po)

            related_invoices = {obj for obj in [old_invoice, payment.supplier_invoice] if obj is not None}
            for invoice in related_invoices:
                _recalculate_invoice_payment_status(invoice)

            AuditLog.objects.create(
                user=self.request.user,
                action='update',
                model_name='SupplierPayment',
                object_id=str(payment.id),
                object_repr=str(payment),
                ip_address=get_client_ip(self.request),
                details={'action': 'payment_update'}
            )

    def perform_destroy(self, instance):
        with transaction.atomic():
            if not instance.is_active:
                return
            instance.is_active = False
            instance.save(update_fields=['is_active', 'updated_at'])

            if instance.supplier:
                _recalculate_supplier_payment_effects(instance.supplier)
            if instance.purchase_order:
                _recalculate_po_payment_status(instance.purchase_order)
            if instance.supplier_invoice:
                _recalculate_invoice_payment_status(instance.supplier_invoice)

            AuditLog.objects.create(
                user=self.request.user,
                action='delete',
                model_name='SupplierPayment',
                object_id=str(instance.id),
                object_repr=str(instance),
                ip_address=get_client_ip(self.request),
                details={'action': 'soft_delete'}
            )
            logger.info(f"supplier_payment_soft_delete_completed actor_id={self.request.user.id} payment_id={instance.id}")
