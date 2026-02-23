from rest_framework import serializers
from django.db import transaction
from .models import Bill, BillItem, Payment
from inventory.models import Product
from customers.models import Customer

class BillItemSerializer(serializers.ModelSerializer):
    product_name = serializers.StringRelatedField(source='product', read_only=True)
    
    class Meta:
        model = BillItem
        fields = (
            'id', 'bill', 'product', 'product_name', 'quantity', 'price',
            'tax_rate', 'tax_amount', 'discount_rate', 'discount_amount',
            'total', 'created_at'
        )
        read_only_fields = ('id', 'bill', 'tax_amount', 'total', 'created_at')
    
    def create(self, validated_data):
        # Get product tax rate
        product = validated_data.get('product')
        validated_data['tax_rate'] = product.tax
        
        # Calculate totals
        return super().create(validated_data)

class BillSerializer(serializers.ModelSerializer):
    customer_name = serializers.StringRelatedField(source='customer', read_only=True)
    store_name = serializers.StringRelatedField(source='store', read_only=True)
    cashier_name = serializers.StringRelatedField(source='cashier', read_only=True)
    
    class Meta:
        model = Bill
        fields = (
            'id', 'bill_number', 'invoice_number', 'customer', 'customer_name',
            'store', 'store_name', 'cashier', 'cashier_name', 'subtotal',
            'tax_total', 'discount', 'round_off', 'total', 'payment_status',
            'payment_method', 'status', 'notes', 'created_at', 'updated_at',
            'completed_at', 'points_earned', 'points_redeemed'
        )
        read_only_fields = (
            'id', 'bill_number', 'invoice_number', 'store', 'cashier',
            'subtotal', 'tax_total', 'total', 'payment_status', 'payment_method',
            'created_at', 'updated_at', 'completed_at', 'points_earned'
        )

class PaymentSerializer(serializers.ModelSerializer):
    bill_number = serializers.CharField(source='bill.bill_number', read_only=True)
    created_by_name = serializers.StringRelatedField(source='created_by', read_only=True)
    
    class Meta:
        model = Payment
        fields = (
            'id', 'bill', 'bill_number', 'amount', 'payment_method',
            'transaction_id', 'payment_details', 'status', 'created_by',
            'created_by_name', 'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'created_by', 'created_at', 'updated_at')

class BillItemCreateSerializer(serializers.Serializer):
    # Accept both product_id (current) and product (legacy) for compatibility.
    product_id = serializers.PrimaryKeyRelatedField(queryset=Product.objects.all(), required=False)
    product = serializers.PrimaryKeyRelatedField(queryset=Product.objects.all(), required=False)
    quantity = serializers.DecimalField(max_digits=10, decimal_places=2)
    discount_rate = serializers.DecimalField(max_digits=5, decimal_places=2, required=False, default=0)

    def validate(self, attrs):
        product = attrs.get('product_id') or attrs.get('product')
        if product is None:
            raise serializers.ValidationError({'product_id': 'Either product_id or product is required.'})

        quantity = attrs.get('quantity')
        if quantity is None or quantity <= 0:
            raise serializers.ValidationError({'quantity': 'Quantity must be greater than zero.'})

        attrs['product'] = product
        attrs.pop('product_id', None)
        return attrs

class CreateBillSerializer(serializers.ModelSerializer):
    items = BillItemCreateSerializer(many=True)
    customer_id = serializers.PrimaryKeyRelatedField(
        queryset=Customer.objects.all(),
        source='customer',
        required=False,
        allow_null=True
    )
    points_to_redeem = serializers.IntegerField(write_only=True, required=False, default=0)
    bill_discount = serializers.DecimalField(
        max_digits=10, decimal_places=2, write_only=True, required=False, default=0
    )

    class Meta:
        model = Bill
        fields = ('customer_id', 'notes', 'items', 'points_to_redeem', 'bill_discount')

    def validate(self, attrs):
        items = attrs.get('items') or []
        if len(items) == 0:
            raise serializers.ValidationError({'items': 'At least one item is required to create a bill.'})

        for idx, item in enumerate(items, start=1):
            quantity = item.get('quantity')
            if quantity is None or quantity <= 0:
                raise serializers.ValidationError({'items': f'Item #{idx} must have quantity greater than zero.'})

        return attrs

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        points_to_redeem = validated_data.pop('points_to_redeem', 0)
        bill_discount = validated_data.pop('bill_discount', 0)

        with transaction.atomic():
            # Inject bill discount before creation
            validated_data['discount'] = bill_discount
            bill = Bill.objects.create(**validated_data)

            # Create and save each BillItem so tax/total is calculated
            for item_data in items_data:
                product = item_data['product']
                quantity = item_data['quantity']
                discount_rate = item_data.get('discount_rate', 0)

                item = BillItem(
                    bill=bill,
                    product=product,
                    quantity=quantity,
                    price=product.price,
                    tax_rate=product.tax,
                    discount_rate=discount_rate
                )
                item.save()  # ✅ This triggers tax/total calculations

            # Apply loyalty points discount if applicable
            if points_to_redeem > 0 and bill.customer:
                customer = bill.customer
                if customer.loyalty_points >= points_to_redeem:
                    from stores.models import StoreSettings
                    try:
                        settings = StoreSettings.objects.get(store=bill.store)
                        conversion_rate = settings.points_conversion_rate
                    except StoreSettings.DoesNotExist:
                        conversion_rate = 0.25

                    point_discount = points_to_redeem * conversion_rate
                    bill.discount += point_discount
                    bill.points_redeemed = points_to_redeem

                    customer.loyalty_points -= points_to_redeem
                    customer.save()

            # Recalculate totals after items and all discounts are set
            bill.calculate_totals()
            bill.save()

            return bill

class BillDetailSerializer(BillSerializer):
    items = BillItemSerializer(many=True, read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)
    
    class Meta(BillSerializer.Meta):
        fields = BillSerializer.Meta.fields + ('items', 'payments')
