from rest_framework import serializers
from django.db.models import F, Sum, Q
from .models import (
    Supplier, PurchaseOrder, PurchaseOrderItem,
    GoodsReceiptNote, GoodsReceiptNoteItem, SupplierPayment,
    SupplierInvoice, SupplierInvoiceItem
)

class SupplierSerializer(serializers.ModelSerializer):
    created_by_name = serializers.StringRelatedField(source='created_by', read_only=True)
    
    class Meta:
        model = Supplier
        fields = (
            'id', 'name', 'contact_person', 'phone', 'email', 'address',
            'city', 'state', 'pincode', 'gst_number', 'pan_number',
            'credit_period', 'credit_limit', 'current_balance',
            'notes', 'is_active', 'created_at', 'updated_at',
            'created_by', 'created_by_name'
        )
        read_only_fields = ('id', 'created_at', 'updated_at', 'created_by', 'current_balance')

class PurchaseOrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.StringRelatedField(source='product', read_only=True)
    
    class Meta:
        model = PurchaseOrderItem
        fields = (
            'id', 'purchase_order', 'product', 'product_name', 'quantity_ordered',
            'quantity_received', 'unit_price', 'tax_rate', 'tax_amount',
            'discount_percentage', 'discount_amount', 'total', 'expected_delivery_date'
        )
        read_only_fields = ('id', 'purchase_order', 'tax_amount', 'discount_amount', 'total', 'quantity_received')

class PurchaseOrderSerializer(serializers.ModelSerializer):
    supplier_name = serializers.StringRelatedField(source='supplier', read_only=True)
    store_name = serializers.StringRelatedField(source='store', read_only=True)
    created_by_name = serializers.StringRelatedField(source='created_by', read_only=True)
    items = PurchaseOrderItemSerializer(many=True, write_only=True, required=False)  # Added
    items_count = serializers.SerializerMethodField()
    received_items = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseOrder
        fields = (
            'id', 'po_number', 'supplier', 'supplier_name', 'store', 'store_name',
            'order_date', 'expected_delivery_date', 'status', 'payment_status',
            'subtotal', 'tax_total', 'shipping_charges', 'total', 'notes', 'terms',
            'created_by', 'created_by_name', 'created_at', 'updated_at', 'items',
            'items_count', 'received_items'
        )
        read_only_fields = (
            'id', 'po_number', 'store', 'created_by', 'created_at', 'updated_at',
            'subtotal', 'tax_total', 'total', 'items_count', 'received_items'
        )

    def get_items_count(self, obj):
        return obj.items.count()

    def get_received_items(self, obj):
        return obj.items.filter(quantity_received__gte=F('quantity_ordered')).count()

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        purchase_order = PurchaseOrder.objects.create(**validated_data)

        for item_data in items_data:
            PurchaseOrderItem.objects.create(purchase_order=purchase_order, **item_data)

        return purchase_order

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', [])

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        existing_items = {item.id: item for item in instance.items.all()}
        sent_ids = [item.get('id') for item in items_data if item.get('id')]

        for item_id in existing_items:
            if item_id not in sent_ids:
                existing_items[item_id].delete()

        for item_data in items_data:
            item_id = item_data.pop('id', None)
            if item_id and item_id in existing_items:
                for key, value in item_data.items():
                    setattr(existing_items[item_id], key, value)
                existing_items[item_id].save()
            else:
                PurchaseOrderItem.objects.create(purchase_order=instance, **item_data)

        instance.calculate_totals()

        return instance

class PurchaseOrderDetailSerializer(PurchaseOrderSerializer):
    items = PurchaseOrderItemSerializer(many=True, read_only=True)
    
    class Meta(PurchaseOrderSerializer.Meta):
        fields = PurchaseOrderSerializer.Meta.fields + ('items',)

class GoodsReceiptNoteItemSerializer(serializers.ModelSerializer):
    product_name = serializers.StringRelatedField(source='product', read_only=True)
    
    class Meta:
        model = GoodsReceiptNoteItem
        fields = (
            'id', 'grn', 'product', 'product_name', 'quantity', 'unit_price',
            'tax_rate', 'tax_amount', 'discount_percentage', 'discount_amount',
            'total', 'batch_number', 'expiry_date'
        )
        read_only_fields = ('id', 'grn', 'tax_amount', 'discount_amount', 'total')

class GoodsReceiptNoteSerializer(serializers.ModelSerializer):
    supplier_name = serializers.StringRelatedField(source='supplier', read_only=True)
    store_name = serializers.StringRelatedField(source='store', read_only=True)
    created_by_name = serializers.StringRelatedField(source='created_by', read_only=True)
    po_number = serializers.StringRelatedField(source='purchase_order.po_number', read_only=True)
    items_count = serializers.SerializerMethodField()
    received_items = serializers.SerializerMethodField()
    discrepancies = serializers.SerializerMethodField()
    
    class Meta:
        model = GoodsReceiptNote
        fields = (
            'id', 'grn_number', 'purchase_order', 'po_number', 'supplier', 'supplier_name',
            'store', 'store_name', 'receipt_date', 'invoice_number', 'invoice_date',
            'status', 'subtotal', 'discount_total', 'tax_total', 'shipping_charges', 'total', 'notes',
            'is_active',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
            'items_count', 'received_items', 'discrepancies'
        )
        read_only_fields = ('id', 'grn_number', 'store', 'created_by', 'created_at', 'updated_at',
            'subtotal', 'discount_total', 'tax_total', 'total', 'is_active',
                            'items_count', 'received_items', 'discrepancies')

    def get_items_count(self, obj):
        return obj.items.count()

    def get_received_items(self, obj):
        return obj.items.filter(quantity__gt=0).count()

    def get_discrepancies(self, obj):
        return obj.items.filter(
            Q(quantity__lte=0) | Q(batch_number__isnull=True) | Q(batch_number='')
        ).count()

class GoodsReceiptNoteDetailSerializer(GoodsReceiptNoteSerializer):
    items = GoodsReceiptNoteItemSerializer(many=True, read_only=True)
    
    class Meta(GoodsReceiptNoteSerializer.Meta):
        fields = GoodsReceiptNoteSerializer.Meta.fields + ('items',)


class SupplierInvoiceItemSerializer(serializers.ModelSerializer):
    product_name_resolved = serializers.CharField(source='product_ref.name', read_only=True)
    product_id = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = SupplierInvoiceItem
        fields = (
            'id', 'invoice', 'product_ref', 'product_name_resolved', 'product_id', 'product_code', 'product_name',
            'quantity', 'unit_price', 'discount', 'discount_type', 'tax_rate', 'tax_amount', 'total'
        )
        read_only_fields = ('id', 'invoice')

    def validate(self, attrs):
        legacy_product_id = attrs.pop('product_id', None)
        if legacy_product_id and not attrs.get('product_code'):
            attrs['product_code'] = legacy_product_id
        return super().validate(attrs)

class SupplierInvoiceSerializer(serializers.ModelSerializer):
    items = SupplierInvoiceItemSerializer(many=True, required=False)
    supplier_name_resolved = serializers.CharField(source='supplier.name', read_only=True)
    po_number_resolved = serializers.CharField(source='purchase_order.po_number', read_only=True)
    grn_number_resolved = serializers.CharField(source='grn.grn_number', read_only=True)
    due_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = SupplierInvoice
        fields = (
            'id', 'invoice_number', 'supplier_invoice_number', 'supplier_name', 'supplier', 'supplier_name_resolved',
            'po_number', 'purchase_order', 'po_number_resolved', 'grn_number', 'grn', 'grn_number_resolved',
            'store', 'invoice_date', 'due_date', 'status', 'payment_terms',
            'subtotal', 'discount_total', 'tax_total', 'shipping_charges', 'grand_total',
            'amount_paid', 'due_amount', 'notes', 'is_active', 'created_by', 'created_at', 'updated_at', 'items'
        )
        read_only_fields = ('id', 'created_by', 'created_at', 'updated_at', 'amount_paid')
        extra_kwargs = {
            'invoice_number': {'required': False},
        }

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        invoice = SupplierInvoice.objects.create(**validated_data)
        for item_data in items_data:
            SupplierInvoiceItem.objects.create(invoice=invoice, **item_data)
        return invoice

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if items_data is not None:
            SupplierInvoiceItem.objects.filter(invoice=instance).delete()
            for item_data in items_data:
                SupplierInvoiceItem.objects.create(invoice=instance, **item_data)
        return instance

class SupplierPaymentSerializer(serializers.ModelSerializer):
    supplier_name = serializers.StringRelatedField(source='supplier', read_only=True)
    po_number = serializers.StringRelatedField(source='purchase_order.po_number', read_only=True)
    supplier_invoice_number = serializers.StringRelatedField(source='supplier_invoice.invoice_number', read_only=True)
    created_by_name = serializers.StringRelatedField(source='created_by', read_only=True)
    
    class Meta:
        model = SupplierPayment
        fields = (
            'id', 'supplier', 'supplier_name', 'purchase_order', 'po_number',
            'supplier_invoice', 'supplier_invoice_number',
            'amount', 'payment_method', 'reference_number', 'payment_date',
            'status', 'notes', 'is_active', 'created_by', 'created_by_name', 'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'created_by', 'created_at', 'updated_at')
