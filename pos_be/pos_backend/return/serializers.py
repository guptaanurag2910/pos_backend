from rest_framework import serializers
from django.db.models import Sum
from django.db import transaction
from decimal import Decimal
from .models import Return, ReturnItem

class ReturnItemSerializer(serializers.ModelSerializer):
    productName = serializers.CharField(source='product.name', read_only=True)

    class Meta:
        model = ReturnItem
        fields = '__all__'
        extra_kwargs = {
            'return_ref': {'required': False},  # Not required for input
        }

    def validate(self, data):
        bill_item = data.get('bill_item')
        product = data.get('product')
        return_quantity = data.get('return_quantity')
        original_quantity = data.get('original_quantity')

        if return_quantity is not None and original_quantity is not None and return_quantity > original_quantity:
            raise serializers.ValidationError("Return quantity cannot exceed original quantity.")

        if bill_item and original_quantity is not None and original_quantity > bill_item.quantity:
            raise serializers.ValidationError("original_quantity cannot exceed bill item quantity.")

        if bill_item and product and bill_item.product_id != product.id:
            raise serializers.ValidationError("Selected product does not match bill item product.")

        return data


class ReturnSerializer(serializers.ModelSerializer):
    items = ReturnItemSerializer(many=True)
    billNumber = serializers.CharField(source='bill.bill_number', read_only=True)
    customerName = serializers.CharField(source='customer_name', read_only=True)
    customerId = serializers.CharField(source='customer_id', read_only=True)
    processedBy = serializers.SerializerMethodField()
    processedAt = serializers.DateTimeField(source='processed_at', read_only=True)

    class Meta:
        model = Return
        fields = '__all__'
        extra_fields = ['billNumber', 'customerName', 'customerId', 'processedBy', 'processedAt']
        extra_kwargs = {
            'return_number': {'required': False},  # Auto-generated
        }

    def get_processedBy(self, obj):
        return obj.processed_by.name if obj.processed_by else None

    @staticmethod
    def _to_decimal(value):
        if value is None:
            return Decimal('0')
        return Decimal(str(value))

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        with transaction.atomic():
            return_obj = Return.objects.create(**validated_data)
            for item in items_data:
                ReturnItem.objects.create(return_ref=return_obj, **item)
        return return_obj

    def validate(self, attrs):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        items_data = attrs.get('items')
        bill = attrs.get('bill') or getattr(self.instance, 'bill', None)
        refund_amount = attrs.get('refund_amount', getattr(self.instance, 'refund_amount', 0))

        if not items_data and not self.instance:
            raise serializers.ValidationError("At least one return item is required.")
        if not bill:
            raise serializers.ValidationError("Bill is required.")
        if bill.status != 'completed':
            raise serializers.ValidationError("Return can only be created for completed bills.")
        if user:
            user_store_id = getattr(user, 'store_id', None)
            is_global_admin = bool(
                getattr(user, 'is_superuser', False) or
                (getattr(user, 'role', None) == 'admin' and not user_store_id)
            )
            if not is_global_admin:
                if not user_store_id or bill.store_id != user_store_id:
                    raise serializers.ValidationError("You can only create returns for your store.")

        total_item_refund = Decimal('0')
        for item in (items_data or []):
            bill_item = item.get('bill_item')
            product = item.get('product')
            return_qty = item.get('return_quantity')

            if bill_item and bill_item.bill_id != bill.id:
                raise serializers.ValidationError("bill_item does not belong to the selected bill.")
            if bill_item and product and bill_item.product_id != product.id:
                raise serializers.ValidationError("product does not match bill_item product.")

            if bill_item and return_qty is not None:
                previous_returned = ReturnItem.objects.filter(
                    bill_item=bill_item,
                    return_ref__status__in=['approved', 'completed'],
                    return_ref__is_active=True
                )
                if self.instance:
                    previous_returned = previous_returned.exclude(return_ref=self.instance)

                already_returned = previous_returned.aggregate(total=Sum('return_quantity')).get('total') or 0
                if return_qty + already_returned > bill_item.quantity:
                    raise serializers.ValidationError(
                        f"Return quantity exceeds available quantity for bill item {bill_item.id}."
                    )

            total_item_refund += self._to_decimal(item.get('refund_amount'))

        if items_data and total_item_refund.quantize(Decimal('0.01')) != self._to_decimal(refund_amount).quantize(Decimal('0.01')):
            raise serializers.ValidationError("refund_amount must match total refund_amount of items.")

        if self._to_decimal(refund_amount) > self._to_decimal(bill.total):
            raise serializers.ValidationError("refund_amount cannot exceed bill total.")

        return attrs
