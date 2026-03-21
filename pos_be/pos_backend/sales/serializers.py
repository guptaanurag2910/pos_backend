from rest_framework import serializers
from django.db import transaction
from django.db.models import Sum
from .models import Bill, BillItem, Payment
from inventory.models import Product, StockLevel
from customers.models import Customer
from stores.models import Store
from decimal import Decimal

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

    def validate(self, attrs):
        product = attrs.get('product') or getattr(self.instance, 'product', None)
        bill = attrs.get('bill') or getattr(self.instance, 'bill', None)
        quantity = attrs.get('quantity', getattr(self.instance, 'quantity', None))

        if not product or not bill or quantity is None:
            return attrs

        available_raw = StockLevel.objects.filter(
            product=product,
            store=bill.store,
        ).aggregate(total=Sum('quantity')).get('total') or Decimal('0')
        available = Decimal(str(available_raw))
        requested = Decimal(str(quantity))

        if requested > available:
            raise serializers.ValidationError({
                'quantity': (
                    f"Insufficient stock for {product.name}. "
                    f"Available: {available}, requested: {requested}."
                )
            })

        return attrs
    
    def create(self, validated_data):
        product = validated_data.get('product')
        bill = validated_data.get('bill')
        bill_id = validated_data.get('bill_id')
        if bill is None and bill_id is not None:
            bill = Bill.objects.filter(id=bill_id).first()

        quantity = validated_data.get('quantity')
        if product and bill and quantity is not None:
            available_raw = StockLevel.objects.filter(
                product=product,
                store=bill.store,
            ).aggregate(total=Sum('quantity')).get('total') or Decimal('0')
            available = Decimal(str(available_raw))
            requested = Decimal(str(quantity))
            if requested > available:
                raise serializers.ValidationError(
                    f"Insufficient stock for {product.name}. Available: {available}, requested: {requested}."
                )

        # Get product tax rate
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
    # Tax-inclusive selling rate snapshot from frontend.
    rate = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)
    # Tax rate snapshot from frontend; falls back to product tax.
    tax_rate = serializers.DecimalField(max_digits=5, decimal_places=2, required=False)
    discount_rate = serializers.DecimalField(max_digits=5, decimal_places=2, required=False, default=0)

    def validate(self, attrs):
        product = attrs.get('product_id') or attrs.get('product')
        if product is None:
            raise serializers.ValidationError({'product_id': 'Either product_id or product is required.'})

        quantity = attrs.get('quantity')
        if quantity is None or quantity <= 0:
            raise serializers.ValidationError({'quantity': 'Quantity must be greater than zero.'})

        rate = attrs.get('rate')
        if rate is not None and rate <= 0:
            raise serializers.ValidationError({'rate': 'Rate must be greater than zero.'})

        tax_rate = attrs.get('tax_rate')
        if tax_rate is not None and (tax_rate < 0 or tax_rate > 100):
            raise serializers.ValidationError({'tax_rate': 'tax_rate must be between 0 and 100.'})

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

    def _resolve_store_for_validation(self):
        resolved_store = self.context.get('resolved_store')
        if resolved_store is not None:
            return resolved_store

        request = self.context.get('request')
        if not request:
            return None

        user_store = getattr(request.user, 'store', None)
        if user_store:
            return user_store

        store_id = request.data.get('store')
        if store_id:
            return Store.objects.filter(id=store_id, is_active=True).first()

        fallback = Store.objects.filter(is_main=True, is_active=True).first()
        if fallback:
            return fallback
        return Store.objects.filter(is_active=True).order_by('id').first()

    def validate(self, attrs):
        items = attrs.get('items') or []
        if len(items) == 0:
            raise serializers.ValidationError({'items': 'At least one item is required to create a bill.'})

        for idx, item in enumerate(items, start=1):
            quantity = item.get('quantity')
            if quantity is None or quantity <= 0:
                raise serializers.ValidationError({'items': f'Item #{idx} must have quantity greater than zero.'})

        store = self._resolve_store_for_validation()
        if store:
            requested_by_product = {}
            for item in items:
                product = item.get('product')
                qty = Decimal(str(item.get('quantity')))
                requested_by_product[product.id] = requested_by_product.get(product.id, Decimal('0')) + qty

            for product_id, requested in requested_by_product.items():
                available_raw = StockLevel.objects.filter(
                    product_id=product_id,
                    store=store,
                ).aggregate(total=Sum('quantity')).get('total') or Decimal('0')
                available = Decimal(str(available_raw))
                if requested > available:
                    product_name = Product.objects.filter(id=product_id).values_list('name', flat=True).first() or f"Product {product_id}"
                    raise serializers.ValidationError({
                        'items': (
                            f"Insufficient stock for {product_name}. "
                            f"Available: {available}, requested: {requested}."
                        )
                    })

        return attrs

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        points_to_redeem = validated_data.pop('points_to_redeem', 0)
        bill_discount = validated_data.pop('bill_discount', 0)

        with transaction.atomic():
            # Inject bill discount before creation
            validated_data['discount'] = bill_discount
            bill = Bill.objects.create(**validated_data)

            requested_by_product = {}
            for item_data in items_data:
                product = item_data['product']
                qty = Decimal(str(item_data['quantity']))
                requested_by_product[product.id] = requested_by_product.get(product.id, Decimal('0')) + qty

            for product_id, requested in requested_by_product.items():
                available_raw = StockLevel.objects.filter(
                    product_id=product_id,
                    store=bill.store,
                ).aggregate(total=Sum('quantity')).get('total') or Decimal('0')
                available = Decimal(str(available_raw))
                if requested > available:
                    product_name = Product.objects.filter(id=product_id).values_list('name', flat=True).first() or f"Product {product_id}"
                    raise serializers.ValidationError(
                        f"Insufficient stock for {product_name}. Available: {available}, requested: {requested}."
                    )

            # Create and save each BillItem so tax/total is calculated
            for item_data in items_data:
                product = item_data['product']
                quantity = item_data['quantity']
                discount_rate = item_data.get('discount_rate', 0)
                tax_rate = item_data.get('tax_rate', product.tax)

                # Frontend and product catalog rates are tax-inclusive.
                # Persist pre-tax unit price in bill item for stable, consistent totals.
                rate_inclusive = item_data.get('rate')
                if rate_inclusive is None:
                    rate_inclusive = product.discount_price if product.discount_price is not None else product.price

                tax_multiplier = Decimal('1') + (Decimal(str(tax_rate)) / Decimal('100'))
                if tax_multiplier <= 0:
                    unit_price = Decimal(str(rate_inclusive))
                else:
                    unit_price = (Decimal(str(rate_inclusive)) / tax_multiplier).quantize(Decimal('0.01'))

                item = BillItem(
                    bill=bill,
                    product=product,
                    quantity=quantity,
                    price=unit_price,
                    tax_rate=tax_rate,
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
