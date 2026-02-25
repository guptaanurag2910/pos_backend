import logging

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError
from django_filters.rest_framework import DjangoFilterBackend
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework import serializers
from decimal import Decimal, InvalidOperation

from .models import Bill, BillItem, Payment
from inventory.models import StockLevel
from .serializers import (
    BillSerializer, BillItemSerializer, BillDetailSerializer,
    PaymentSerializer, CreateBillSerializer
)
from accounts.permissions import IsManagerUser
from accounts.models import AuditLog
from accounts.utils import get_client_ip
from stores.models import Store

logger = logging.getLogger('sales')


def _is_global_admin(user):
    return bool(
        getattr(user, 'is_superuser', False) or
        (getattr(user, 'role', None) == 'admin' and not getattr(user, 'store_id', None))
    )


def _resolve_store(request):
    """
    Resolve store for bill creation:
    1) request.user.store
    2) explicit request.data['store']
    3) main active store
    4) first active store
    """
    user_store = getattr(request.user, 'store', None)
    if user_store:
        return user_store

    store_id = request.data.get('store')
    if store_id:
        try:
            return Store.objects.get(id=store_id, is_active=True)
        except Store.DoesNotExist:
            raise serializers.ValidationError({"store": "Invalid or inactive store."})

    # If user/store is not explicitly set, try to infer a store that can satisfy
    # the requested items. This keeps validation and final bill store consistent.
    requested_items = request.data.get('items') if hasattr(request, 'data') else None
    if isinstance(requested_items, list) and requested_items:
        requested_by_product = {}
        for item in requested_items:
            product_id = item.get('product_id') or item.get('product')
            quantity_raw = item.get('quantity', 0)
            try:
                product_id = int(product_id)
                quantity = Decimal(str(quantity_raw))
            except (TypeError, ValueError, InvalidOperation):
                continue
            if quantity > 0:
                requested_by_product[product_id] = requested_by_product.get(product_id, Decimal('0')) + quantity

        if requested_by_product:
            matching_store_ids = []
            active_store_ids = list(Store.objects.filter(is_active=True).order_by('id').values_list('id', flat=True))
            for candidate_store_id in active_store_ids:
                is_match = True
                for product_id, requested_qty in requested_by_product.items():
                    available_raw = StockLevel.objects.filter(
                        store_id=candidate_store_id,
                        product_id=product_id,
                    ).aggregate(total=Sum('quantity')).get('total') or Decimal('0')
                    available_qty = Decimal(str(available_raw))
                    if available_qty < requested_qty:
                        is_match = False
                        break
                if is_match:
                    matching_store_ids.append(candidate_store_id)

            if matching_store_ids:
                preferred = Store.objects.filter(
                    id__in=matching_store_ids,
                    is_main=True,
                    is_active=True
                ).first()
                if preferred:
                    return preferred
                return Store.objects.get(id=matching_store_ids[0])

    fallback = Store.objects.filter(is_main=True, is_active=True).first()
    if not fallback:
        fallback = Store.objects.filter(is_active=True).order_by('id').first()
    if fallback:
        return fallback

    raise serializers.ValidationError(
        {"store": "No active store found. Assign a store to this user or create an active store."}
    )

class BillViewSet(viewsets.ModelViewSet):
    serializer_class = BillSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['store', 'customer', 'status', 'payment_status', 'payment_method', 'created_at']
    search_fields = ['bill_number', 'invoice_number', 'customer__name', 'customer__phone']
    ordering_fields = ['created_at', 'total']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return BillDetailSerializer
        elif self.action == 'create':
            return CreateBillSerializer
        return BillSerializer
    
    def get_queryset(self):
        user = self.request.user
        if _is_global_admin(user):
            return Bill.objects.all()
        if getattr(user, 'store', None):
            return Bill.objects.filter(store=user.store)
        return Bill.objects.none()

    def _generate_invoice_number(self, bill):
        try:
            from stores.models import StoreSettings
            settings = StoreSettings.objects.get(store=bill.store)
            prefix = settings.invoice_prefix or 'INV'
            start_number = settings.invoice_start_number or 1
        except Exception:
            prefix = 'INV'
            start_number = 1

        base = f"{prefix}-{bill.store.code}-"
        max_seq = 0
        for inv in Bill.objects.filter(store=bill.store).exclude(invoice_number__isnull=True).values_list('invoice_number', flat=True):
            if not inv or not inv.startswith(base):
                continue
            try:
                seq = int(inv.split('-')[-1])
                if seq > max_seq:
                    max_seq = seq
            except (ValueError, IndexError):
                continue

        next_seq = max(start_number, max_seq + 1)
        return f"{base}{next_seq:06d}"
    
    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        bill = self.get_object()
        logger.info(
            f"Bill complete requested bill_id={bill.id} bill_number={bill.bill_number} status={bill.status} user_id={request.user.id}"
        )
        
        if bill.status == 'completed':
            return Response(
                {"detail": "Bill is already completed"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if bill.status == 'cancelled':
            return Response(
                {"detail": "Cannot complete a cancelled bill"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        payment_method = request.data.get('payment_method')
        valid_methods = {key for key, _ in Payment.PAYMENT_METHOD_CHOICES}
        if payment_method == '':
            payment_method = None
        if payment_method and payment_method not in valid_methods:
            return Response(
                {"detail": "Invalid payment_method"},
                status=status.HTTP_400_BAD_REQUEST
            )

        paid_total_raw = bill.payments.filter(status='completed').aggregate(total=Sum('amount')).get('total') or Decimal('0.00')
        paid_total = Decimal(str(paid_total_raw))
        bill_total = Decimal(str(bill.total))

        # Completion must either provide a payment method for due collection, or already have enough completed payments.
        if not payment_method and paid_total < bill_total:
            return Response(
                {"detail": "payment_method is required when bill is not fully paid"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        with transaction.atomic():
            # Complete the bill
            try:
                success = bill.complete(payment_method)
            except ValueError as e:
                return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
            
            if not success:
                return Response(
                    {"detail": "Failed to complete bill"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            if not bill.invoice_number:
                bill.invoice_number = self._generate_invoice_number(bill)
                bill.save(update_fields=['invoice_number', 'updated_at'])
            
            # Create payment record only for outstanding amount.
            # This avoids duplicate rows when frontend has already created payment entries before completion.
            amount_due = (bill_total - paid_total).quantize(Decimal('0.01'))
            if payment_method and amount_due > Decimal('0.00'):
                Payment.objects.create(
                    bill=bill,
                    amount=amount_due,
                    payment_method=payment_method,
                    status='completed',
                    created_by=request.user
                )
            
            # Log the action
            AuditLog.objects.create(
                user=request.user,
                action='update',
                model_name='Bill',
                object_id=str(bill.id),
                object_repr=bill.bill_number,
                ip_address=get_client_ip(request),
                details={
                    'action': 'complete',
                    'payment_method': payment_method,
                }
            )
        
        serializer = BillDetailSerializer(bill, context={'request': request})
        logger.info(
            f"Bill complete success bill_id={bill.id} bill_number={bill.bill_number} payment_status={bill.payment_status} user_id={request.user.id}"
        )
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def validate_payment_split(self, request, pk=None):
        bill = self.get_object()
        payments = request.data.get('payments', [])

        if not isinstance(payments, list) or not payments:
            return Response(
                {"detail": "payments must be a non-empty list"},
                status=status.HTTP_400_BAD_REQUEST
            )

        valid_methods = {key for key, _ in Payment.PAYMENT_METHOD_CHOICES}
        total_input = Decimal('0.00')
        errors = []

        for idx, payment in enumerate(payments, start=1):
            method = payment.get('payment_method')
            amount_raw = payment.get('amount')
            if method not in valid_methods:
                errors.append({'index': idx, 'error': 'invalid payment_method'})
                continue
            try:
                amount = Decimal(str(amount_raw))
                if amount <= 0:
                    raise ValueError
            except (InvalidOperation, ValueError):
                errors.append({'index': idx, 'error': 'amount must be > 0'})
                continue
            total_input += amount

        if errors:
            return Response({'valid': False, 'errors': errors}, status=status.HTTP_400_BAD_REQUEST)

        bill_total = Decimal(str(bill.total))
        difference = (total_input - bill_total).quantize(Decimal('0.01'))
        is_valid = abs(difference) <= Decimal('0.01')

        return Response({
            'valid': is_valid,
            'bill_total': str(bill_total),
            'input_total': str(total_input),
            'difference': str(difference),
            'suggestion': 'Split is valid' if is_valid else 'Adjust split amounts to match bill total'
        })

    @action(detail=True, methods=['get', 'post'])
    def receipt(self, request, pk=None):
        bill = self.get_object()
        if bill.status != 'completed':
            return Response({"detail": "Receipt is available only for completed bills"}, status=status.HTTP_400_BAD_REQUEST)

        reprint_count = AuditLog.objects.filter(
            model_name='Bill',
            object_id=str(bill.id),
            details__action='receipt_reprint'
        ).count()

        if request.method == 'POST':
            AuditLog.objects.create(
                user=request.user,
                action='view',
                model_name='Bill',
                object_id=str(bill.id),
                object_repr=bill.bill_number,
                ip_address=get_client_ip(request),
                details={'action': 'receipt_reprint'}
            )
            reprint_count += 1

        data = BillDetailSerializer(bill, context={'request': request}).data
        return Response({
            'bill': data,
            'meta': {
                'print_type': 'reprint' if request.method == 'POST' else 'original_view',
                'reprint_count': reprint_count
            }
        })

    def create(self, request, *args, **kwargs):
        logger.info(
            f"Bill create requested user_id={request.user.id} payload_keys={list(request.data.keys())}"
        )
        resolved_store = _resolve_store(request)
        serializer = self.get_serializer(data=request.data)
        serializer.context['resolved_store'] = resolved_store
        serializer.is_valid(raise_exception=True)
        self._resolved_store = resolved_store

        # Save using perform_create (which includes business logic like bill_number etc.)
        self.perform_create(serializer)
        bill = serializer.instance  # The created bill object

        # Serialize the full bill response using BillDetailSerializer
        response_serializer = BillDetailSerializer(bill, context={'request': request})
        logger.info(
            f"Bill create success bill_id={bill.id} bill_number={bill.bill_number} store_id={bill.store_id} user_id={request.user.id}"
        )
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        bill = self.get_object()
        
        if bill.status == 'cancelled':
            return Response(
                {"detail": "Bill is already cancelled"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if bill.status == 'completed':
            return Response(
                {"detail": "Cannot cancel a completed bill. Create a refund instead."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        with transaction.atomic():
            bill.status = 'cancelled'
            bill.save()
            
            # Log the action
            AuditLog.objects.create(
                user=request.user,
                action='update',
                model_name='Bill',
                object_id=str(bill.id),
                object_repr=bill.bill_number,
                ip_address=get_client_ip(request),
                details={'action': 'cancel'}
            )
        
        serializer = BillDetailSerializer(bill, context={'request': request})
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def hold(self, request, pk=None):
        bill = self.get_object()
        
        if bill.status != 'draft':
            return Response(
                {"detail": f"Cannot put a {bill.status} bill on hold"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        with transaction.atomic():
            bill.status = 'on_hold'
            bill.save()
            
            # Log the action
            AuditLog.objects.create(
                user=request.user,
                action='update',
                model_name='Bill',
                object_id=str(bill.id),
                object_repr=bill.bill_number,
                ip_address=get_client_ip(request),
                details={'action': 'hold'}
            )
        
        serializer = BillDetailSerializer(bill, context={'request': request})
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def resume(self, request, pk=None):
        bill = self.get_object()
        
        if bill.status != 'on_hold':
            return Response(
                {"detail": f"Cannot resume a {bill.status} bill"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        with transaction.atomic():
            bill.status = 'draft'
            bill.save()
            
            # Log the action
            AuditLog.objects.create(
                user=request.user,
                action='update',
                model_name='Bill',
                object_id=str(bill.id),
                object_repr=bill.bill_number,
                ip_address=get_client_ip(request),
                details={'action': 'resume'}
            )
        
        serializer = BillDetailSerializer(bill, context={'request': request})
        return Response(serializer.data)

    def perform_create(self, serializer):
        with transaction.atomic():
            user = self.request.user
            store = getattr(self, '_resolved_store', None) or _resolve_store(self.request)
            logger.info(f"Bill perform_create resolved store_id={store.id} store_code={store.code} user_id={user.id}")

            last_bill = Bill.objects.filter(store=store).order_by('-created_at').first()

            if last_bill:
                try:
                    last_num = int(last_bill.bill_number.split('-')[-1])
                    bill_number = f"{store.code}-{last_num + 1:06d}"
                except ValueError:
                    bill_number = f"{store.code}-{timezone.now().strftime('%Y%m%d')}-001"
            else:
                bill_number = f"{store.code}-{timezone.now().strftime('%Y%m%d')}-001"

            bill = serializer.save(
                bill_number=bill_number,
                store=store,
                cashier=user
            )

            bill.calculate_totals()
            bill.save()

            AuditLog.objects.create(
                user=user,
                action='create',
                model_name='Bill',
                object_id=str(bill.id),
                object_repr=bill.bill_number,
                ip_address=get_client_ip(self.request)
            )

    def perform_update(self, serializer):
        with transaction.atomic():
            bill = serializer.save()
            
            # Calculate bill totals
            bill.calculate_totals()
            bill.save()
            
            # Log the action
            AuditLog.objects.create(
                user=self.request.user,
                action='update',
                model_name='Bill',
                object_id=str(bill.id),
                object_repr=bill.bill_number,
                ip_address=get_client_ip(self.request)
            )

class BillItemViewSet(viewsets.ModelViewSet):
    serializer_class = BillItemSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        bill_id = self.kwargs.get('bill_pk')
        if bill_id:
            qs = BillItem.objects.filter(bill_id=bill_id)
            if _is_global_admin(user):
                return qs
            user_store = getattr(user, 'store', None)
            if not user_store:
                return BillItem.objects.none()
            return qs.filter(bill__store=user_store)
        return BillItem.objects.none()

    def _get_scoped_bill(self, bill_id):
        user = self.request.user
        qs = Bill.objects.filter(id=bill_id)
        if _is_global_admin(user):
            return qs.first()
        user_store = getattr(user, 'store', None)
        if not user_store:
            return None
        return qs.filter(store=user_store).first()
    
    def perform_create(self, serializer):
        bill_id = self.kwargs.get('bill_pk')
        bill = self._get_scoped_bill(bill_id)
        if not bill:
            raise ValidationError({"detail": "Bill not found for this store/user"})
        
        # Check if bill can be modified
        if bill.status not in ['draft', 'on_hold']:
            raise ValidationError({"detail": f"Cannot add items to a {bill.status} bill"})
        
        with transaction.atomic():
            item = serializer.save(bill_id=bill_id)
            
            # Update bill totals
            bill.calculate_totals()
            bill.save()
            
            # Log the action
            AuditLog.objects.create(
                user=self.request.user,
                action='create',
                model_name='BillItem',
                object_id=str(item.id),
                object_repr=str(item),
                ip_address=get_client_ip(self.request)
            )
    
    def perform_update(self, serializer):
        with transaction.atomic():
            item = serializer.save()
            
            # Update bill totals
            bill = item.bill
            bill.calculate_totals()
            bill.save()
            
            # Log the action
            AuditLog.objects.create(
                user=self.request.user,
                action='update',
                model_name='BillItem',
                object_id=str(item.id),
                object_repr=str(item),
                ip_address=get_client_ip(self.request)
            )
    
    def perform_destroy(self, instance):
        bill = instance.bill
        
        # Check if bill can be modified
        if bill.status not in ['draft', 'on_hold']:
            raise ValidationError({"detail": f"Cannot remove items from a {bill.status} bill"})
        
        with transaction.atomic():
            # Log the action before deletion
            AuditLog.objects.create(
                user=self.request.user,
                action='delete',
                model_name='BillItem',
                object_id=str(instance.id),
                object_repr=str(instance),
                ip_address=get_client_ip(self.request)
            )
            
            # Delete the item
            instance.delete()
            
            # Update bill totals
            bill.calculate_totals()
            bill.save()

class PaymentViewSet(viewsets.ModelViewSet):
    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['bill', 'payment_method', 'status', 'created_at']
    search_fields = ['bill__bill_number', 'transaction_id']
    
    def get_queryset(self):
        user = self.request.user
        if _is_global_admin(user):
            return Payment.objects.all()
        if getattr(user, 'store', None):
            return Payment.objects.filter(bill__store=user.store)
        return Payment.objects.none()
    
    def get_bill_queryset(self):
        bill_id = self.kwargs.get('bill_pk')
        if bill_id:
            return Payment.objects.filter(bill_id=bill_id)
        return Payment.objects.none()
    
    def perform_create(self, serializer):
        with transaction.atomic():
            amount = Decimal(str(serializer.validated_data.get('amount', 0)))
            if amount <= 0:
                raise ValidationError({"detail": "Payment amount must be greater than zero"})
            payment = serializer.save(created_by=self.request.user, status='completed')
            
            # Log the action
            AuditLog.objects.create(
                user=self.request.user,
                action='create',
                model_name='Payment',
                object_id=str(payment.id),
                object_repr=str(payment),
                ip_address=get_client_ip(self.request)
            )
    
    @action(detail=True, methods=['post'])
    def refund(self, request, pk=None):
        payment = self.get_object()
        
        if payment.status != 'completed':
            return Response(
                {"detail": "Only completed payments can be refunded"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        with transaction.atomic():
            # Update payment status
            payment.status = 'refunded'
            payment.save()
            
            # Create refund record
            refund = Payment.objects.create(
                bill=payment.bill,
                amount=-payment.amount,
                payment_method=payment.payment_method,
                transaction_id=f"REFUND-{payment.transaction_id}" if payment.transaction_id else None,
                payment_details=payment.payment_details,
                status='completed',
                created_by=request.user
            )
            
            # Update bill status if needed
            bill = payment.bill
            if bill.payment_status == 'paid':
                bill.payment_status = 'refunded'
                bill.save()
            
            # Log the action
            AuditLog.objects.create(
                user=request.user,
                action='update',
                model_name='Payment',
                object_id=str(payment.id),
                object_repr=str(payment),
                ip_address=get_client_ip(request),
                details={
                    'action': 'refund',
                    'refund_id': str(refund.id)
                }
            )
        
        serializer = PaymentSerializer(payment)
        return Response(serializer.data)
