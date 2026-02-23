from rest_framework import serializers
from .models import Customer, CustomerGroup

class CustomerSerializer(serializers.ModelSerializer):
    created_by_name = serializers.StringRelatedField(source='created_by', read_only=True)
    
    class Meta:
        model = Customer
        fields = (
            'id', 'name', 'phone', 'email', 'address', 'city', 'state', 'pincode',
            'loyalty_points', 'total_purchases', 'last_purchase', 'gst_number',
            'pan_number', 'birthdate', 'anniversary', 'notes', 'is_active', 'created_at',
            'updated_at', 'created_by', 'created_by_name'
        )
        read_only_fields = ('id', 'created_at', 'updated_at', 'created_by', 'total_purchases', 'last_purchase')

    def validate_phone(self, value):
        phone = ''.join(ch for ch in value if ch.isdigit())
        if len(phone) < 7 or len(phone) > 15:
            raise serializers.ValidationError("Phone must have 7 to 15 digits.")
        return phone

    def validate_pincode(self, value):
        if value in (None, ''):
            return value
        pincode = value.strip()
        if not pincode.isdigit() or not (4 <= len(pincode) <= 10):
            raise serializers.ValidationError("Pincode must be 4 to 10 digits.")
        return pincode

class CustomerGroupSerializer(serializers.ModelSerializer):
    created_by_name = serializers.StringRelatedField(source='created_by', read_only=True)
    customer_count = serializers.SerializerMethodField()
    
    class Meta:
        model = CustomerGroup
        fields = (
            'id', 'name', 'slug', 'description', 'special_discount',
            'is_active', 'created_at', 'updated_at', 'created_by',
            'created_by_name', 'customer_count'
        )
        read_only_fields = ('id', 'slug', 'created_at', 'updated_at', 'created_by')
    
    def get_customer_count(self, obj):
        return obj.customers.count()
