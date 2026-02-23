from rest_framework import serializers
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
        if data['return_quantity'] > data['original_quantity']:
            raise serializers.ValidationError("Return quantity cannot exceed original quantity.")
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

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        return_number = validated_data.pop('return_number', None) or f"RET-{Return.objects.count() + 1:06d}"
        return_obj = Return.objects.create(return_number=return_number, **validated_data)
        for item in items_data:
            ReturnItem.objects.create(return_ref=return_obj, **item)
        return return_obj
