### views.py
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from .models import Return
from .serializers import ReturnSerializer
from inventory.models import StockLevel, StockRecord
from sales.models import Payment


class ReturnViewSet(viewsets.ModelViewSet):
    queryset = Return.objects.all().select_related('bill').prefetch_related('items')
    serializer_class = ReturnSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'refund_method', 'return_date', 'bill']
    search_fields = ['return_number', 'customer_name', 'bill__bill_number']
    ordering_fields = ['return_date', 'refund_amount']
    ordering = ['-return_date']

    def perform_create(self, serializer):
        count = Return.objects.count() + 1
        return_number = f"RET-{count:06d}"
        serializer.save(return_number=return_number)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        ret = self.get_object()
        if ret.status != 'pending':
            return Response({"detail": "Already processed."}, status=400)
        ret.status = 'approved'
        ret.processed_by = request.user
        ret.processed_at = timezone.now()
        ret.save()
        return Response(ReturnSerializer(ret).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        ret = self.get_object()
        if ret.status != 'pending':
            return Response({"detail": "Already processed."}, status=400)
        ret.status = 'rejected'
        ret.processed_by = request.user
        ret.processed_at = timezone.now()
        ret.save()
        return Response(ReturnSerializer(ret).data)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        ret = self.get_object()

        if ret.status != 'approved':
            return Response({"detail": "Return must be approved first."}, status=400)

        for item in ret.items.all():
            StockRecord.objects.create(
                product=item.product,
                store=ret.bill.store,
                quantity=item.return_quantity,
                record_type='return',
                reference_id=ret.return_number,
                created_by=request.user
            )
            stock_level, _ = StockLevel.objects.get_or_create(
                product=item.product,
                store=ret.bill.store,
                defaults={'quantity': 0}
            )
            stock_level.quantity += item.return_quantity
            stock_level.save()

        Payment.objects.create(
            bill=ret.bill,
            amount=-ret.refund_amount,
            payment_method=ret.refund_method,
            status='completed',
            created_by=request.user,
            transaction_id=f"REFUND-{ret.return_number}"
        )

        ret.status = 'completed'
        ret.processed_by = request.user
        ret.processed_at = timezone.now()
        ret.save()

        return Response(ReturnSerializer(ret).data)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.status in ['completed', 'rejected']:
            return Response({"detail": "Cannot update a completed or rejected return."}, status=400)
        return super().update(request, *args, **kwargs)
