from rest_framework import serializers
from .models import Customer, CustomerGroup

class CustomerSerializer(serializers.ModelSerializer):
    created_by_name = serializers.StringRelatedField(source='created_by', read_only=True)
    
    class Meta:
        model = Customer
        fields = (
            'id', 'name', 'phone', 'email', 'address', 'city', 'state', 'pincode',
            'loyalty_points', 'total_purchases', 'last_purchase', 'gst_number',
            'pan_number', 'birthdate', 'anniversary', 'notes', 'created_at',
            'updated_at', 'created_by', 'created_by_name'
        )
        read_only_fields = ('id', 'created_at', 'updated_at', 'created_by', 'total_purchases', 'last_purchase')

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