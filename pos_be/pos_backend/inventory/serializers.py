from rest_framework import serializers
from django.db.models import Sum
from django.utils.text import slugify
from .models import (
    Category, Product, StockRecord, StockLevel,
    StockTransfer, StockTransferItem, InventoryUpload
)

class CategorySerializer(serializers.ModelSerializer):
    def validate(self, attrs):
        name = attrs.get('name')
        if not name:
            return attrs

        slug = slugify(name)
        qs = Category.objects.filter(slug=slug)
        if self.instance:
            qs = qs.exclude(id=self.instance.id)
        if qs.exists():
            raise serializers.ValidationError({'name': 'Category with this name/slug already exists.'})
        return attrs

    class Meta:
        model = Category
        fields = ('id', 'name', 'slug', 'parent', 'description', 'is_active')
        read_only_fields = ('id', 'slug')


class ProductStockLevelSerializer(serializers.ModelSerializer):
    store_name = serializers.StringRelatedField(source='store', read_only=True)

    class Meta:
        model = StockLevel
        fields = [
            'store', 'store_name', 'quantity', 'min_stock', 'max_stock',
            'batch_number', 'expiry_date', 'updated_at'
        ]

class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.StringRelatedField(source='category', read_only=True)
    current_stock = serializers.SerializerMethodField()
    stock_details = serializers.SerializerMethodField()  # 🔥 New field

    class Meta:
        model = Product
        fields = (
            'id', 'name', 'barcode', 'category', 'category_name', 'description',
            'price', 'cost_price', 'discount_price', 'tax', 'hsn_code',
            'is_active', 'is_featured', 'is_service', 'unit', 'weight',
            'image', 'created_at', 'updated_at',
            'current_stock', 'stock_details'  # Include the new field here
        )
        read_only_fields = ('id', 'created_at', 'updated_at')

    def get_current_stock(self, obj):
        # Priority 1: Use annotation if present
        if hasattr(obj, 'current_stock') and obj.current_stock is not None:
            return obj.current_stock

        # Priority 2: Fallback to DB query per user's store
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            user_store = getattr(request.user, 'store', None)
            if user_store:
                return StockLevel.objects.filter(product=obj, store=user_store).aggregate(
                    total=Sum('quantity')
                )['total'] or 0

        # Fallback if no user/store context
        return StockLevel.objects.filter(product=obj).aggregate(
            total=Sum('quantity')
        )['total'] or 0

    def get_stock_details(self, obj):
        stock_qs = StockLevel.objects.filter(product=obj).select_related('store')
        return ProductStockLevelSerializer(stock_qs, many=True).data

class StockRecordSerializer(serializers.ModelSerializer):
    product_name = serializers.StringRelatedField(source='product', read_only=True)
    store_name = serializers.StringRelatedField(source='store', read_only=True)
    created_by_name = serializers.StringRelatedField(source='created_by', read_only=True)
    
    class Meta:
        model = StockRecord
        fields = (
            'id', 'product', 'product_name', 'store', 'store_name',
            'quantity', 'record_type', 'reference_id', 'batch_number',
            'expiry_date', 'notes', 'created_by', 'created_by_name', 'created_at'
        )
        read_only_fields = ('id', 'created_at')

class StockLevelSerializer(serializers.ModelSerializer):
    product_name = serializers.StringRelatedField(source='product', read_only=True)
    store_name = serializers.StringRelatedField(source='store', read_only=True)
    is_low_stock = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = StockLevel
        fields = (
            'id', 'product', 'product_name', 'store', 'store_name',
            'quantity', 'min_stock', 'max_stock', 'batch_number',
            'expiry_date', 'updated_at', 'is_low_stock'
        )
        read_only_fields = ('id', 'updated_at', 'is_low_stock')

class StockTransferItemSerializer(serializers.ModelSerializer):
    product_name = serializers.StringRelatedField(source='product', read_only=True)
    
    class Meta:
        model = StockTransferItem
        fields = (
            'id', 'transfer', 'product', 'product_name', 'quantity',
            'batch_number', 'expiry_date', 'created_at'
        )
        read_only_fields = ('id', 'transfer', 'created_at')

class StockTransferSerializer(serializers.ModelSerializer):
    items = StockTransferItemSerializer(many=True, read_only=True)
    from_store_name = serializers.StringRelatedField(source='from_store', read_only=True)
    to_store_name = serializers.StringRelatedField(source='to_store', read_only=True)
    created_by_name = serializers.StringRelatedField(source='created_by', read_only=True)
    completed_by_name = serializers.StringRelatedField(source='completed_by', read_only=True)
    
    class Meta:
        model = StockTransfer
        fields = (
            'id', 'from_store', 'from_store_name', 'to_store', 'to_store_name',
            'status', 'notes', 'items', 'created_by', 'created_by_name',
            'created_at', 'completed_by', 'completed_by_name', 'completed_at'
        )
        read_only_fields = ('id', 'created_by', 'created_at', 'completed_by', 'completed_at')


class InventoryUploadSerializer(serializers.ModelSerializer):
    class Meta:
        model = InventoryUpload
        fields = ('id', 'file', 'uploaded_at')
        read_only_fields = ('id', 'uploaded_at')
