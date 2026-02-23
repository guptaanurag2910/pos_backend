from rest_framework import serializers
from .models import Store, StoreSettings

class StoreSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = StoreSettings
        fields = (
            'id', 'store', 'store_logo', 'currency_symbol', 'decimal_places',
            'date_format', 'theme', 'invoice_prefix', 'invoice_start_number',
            'invoice_footer_text', 'show_tax_in_invoice', 'enable_invoice_email',
            'allow_partial_payments', 'enable_discount', 'default_tax_rate',
            'enable_round_off', 'printer_type', 'printer_address',
            'enable_auto_print', 'enable_low_stock_alert', 'low_stock_threshold',
            'enable_customer_points', 'points_conversion_rate', 'updated_at'
        )
        read_only_fields = ('id', 'store', 'updated_at')

class StoreSerializer(serializers.ModelSerializer):
    settings = StoreSettingsSerializer(read_only=True)
    
    class Meta:
        model = Store
        fields = (
            'id', 'name', 'code', 'address', 'city', 'state', 'pincode',
            'phone', 'email', 'gst_number', 'pan_number', 'opening_time',
            'closing_time', 'is_main', 'is_active', 'created_at', 'updated_at',
            'settings'
        )
        read_only_fields = ('id', 'created_at', 'updated_at')