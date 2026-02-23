from random import randint

from django.db import IntegrityError, transaction
from django.db.models import Sum
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import AuditLog
from accounts.permissions import IsManagerUser
from accounts.utils import get_client_ip
from inventory.models import StockLevel, StockRecord
from sales.models import Payment

from .models import Return
from .serializers import ReturnSerializer


class ReturnViewSet(viewsets.ModelViewSet):
    queryset = Return.objects.all()
    serializer_class = ReturnSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'refund_method', 'return_date', 'bill', 'is_active', 'return_type']
    search_fields = ['return_number', 'customer_name', 'bill__bill_number']
    ordering_fields = ['return_date', 'refund_amount', 'processed_at']
    ordering = ['-return_date', '-id']

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'approve', 'reject', 'complete']:
            permission_classes = [IsManagerUser]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]

    def get_queryset(self):
        user = self.request.user
        queryset = Return.objects.select_related(
            'bill', 'bill__store', 'processed_by'
        ).prefetch_related('items', 'items__product', 'items__bill_item')

        include_inactive = str(self.request.query_params.get('include_inactive', 'false')).lower() == 'true'
        if not include_inactive:
            queryset = queryset.filter(is_active=True)

        if user.role == 'admin':
            return queryset
        return queryset.filter(bill__store=user.store)

    @staticmethod
    def _generate_return_number():
        timestamp = timezone.now().strftime('%y%m%d%H%M%S')
        return f"RET-{timestamp}{randint(0, 999):03d}"

    def _audit(self, action, ret, details=None):
        AuditLog.objects.create(
            user=self.request.user,
            action='update' if action != 'create' else 'create',
            model_name='Return',
            object_id=str(ret.id),
            object_repr=ret.return_number,
            ip_address=get_client_ip(self.request),
            details=details or {'action': action},
        )

    def perform_create(self, serializer):
        with transaction.atomic():
            for _ in range(5):
                try:
                    ret = serializer.save(return_number=self._generate_return_number())
                    break
                except IntegrityError:
                    ret = None
            if not ret:
                raise ValidationError({"detail": "Unable to generate unique return number. Please retry."})

            if ret.bill.customer:
                updates = []
                if not ret.customer_name:
                    ret.customer_name = ret.bill.customer.name
                    updates.append('customer_name')
                if not ret.customer_id:
                    ret.customer_id = str(ret.bill.customer.id)
                    updates.append('customer_id')
                if updates:
                    ret.save(update_fields=updates)

            self._audit('create', ret, {'action': 'create'})

    def perform_update(self, serializer):
        with transaction.atomic():
            ret = serializer.save()
            self._audit('update', ret, {'action': 'update'})

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        ret = self.get_object()
        if ret.status != 'pending':
            return Response({"detail": "Only pending returns can be approved."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            ret.status = 'approved'
            ret.processed_by = request.user
            ret.processed_at = timezone.now()
            ret.save(update_fields=['status', 'processed_by', 'processed_at'])
            self._audit('approve', ret, {'action': 'approve'})

        return Response(self.get_serializer(ret).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        ret = self.get_object()
        if ret.status != 'pending':
            return Response({"detail": "Only pending returns can be rejected."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            ret.status = 'rejected'
            ret.processed_by = request.user
            ret.processed_at = timezone.now()
            ret.save(update_fields=['status', 'processed_by', 'processed_at'])
            self._audit('reject', ret, {'action': 'reject', 'reason': request.data.get('reason')})

        return Response(self.get_serializer(ret).data)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        ret = self.get_object()

        if ret.status != 'approved':
            return Response({"detail": "Return must be approved before completion."}, status=status.HTTP_400_BAD_REQUEST)

        if not ret.items.exists():
            return Response({"detail": "Cannot complete return without return items."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            net_paid = Payment.objects.filter(
                bill=ret.bill,
                status='completed',
            ).aggregate(total=Sum('amount')).get('total') or 0

            if ret.refund_amount > net_paid:
                raise ValidationError({"detail": "Refund amount exceeds current net paid amount on the bill."})

            for item in ret.items.all():
                StockRecord.objects.create(
                    product=item.product,
                    store=ret.bill.store,
                    quantity=item.return_quantity,
                    record_type='return',
                    reference_id=ret.return_number,
                    created_by=request.user,
                )

                stock_level, _ = StockLevel.objects.get_or_create(
                    product=item.product,
                    store=ret.bill.store,
                    batch_number=None,
                    defaults={'quantity': 0},
                )
                stock_level.quantity += item.return_quantity
                stock_level.save(update_fields=['quantity', 'updated_at'])

            Payment.objects.create(
                bill=ret.bill,
                amount=-ret.refund_amount,
                payment_method=ret.refund_method,
                status='completed',
                created_by=request.user,
                transaction_id=f"REFUND-{ret.return_number}",
                payment_details={'source': 'return_module', 'return_id': ret.id},
            )

            ret.status = 'completed'
            ret.processed_by = request.user
            ret.processed_at = timezone.now()
            ret.save(update_fields=['status', 'processed_by', 'processed_at'])

            self._audit('complete', ret, {'action': 'complete'})

        return Response(self.get_serializer(ret).data)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.status != 'pending':
            return Response(
                {"detail": "Only pending returns can be updated."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().update(request, *args, **kwargs)

    def perform_destroy(self, instance):
        with transaction.atomic():
            instance.is_active = False
            instance.save(update_fields=['is_active'])
            self._audit('soft_delete', instance, {'action': 'soft_delete'})
