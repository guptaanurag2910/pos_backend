from rest_framework import serializers
from .models import Store, StoreSettings


class StoreBootstrapImportSerializer(serializers.Serializer):
    file = serializers.FileField()
    strict = serializers.BooleanField(default=True)


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
            'phone', 'email', 'recovery_email', 'gst_number', 'pan_number', 'opening_time',
            'closing_time', 'is_main', 'is_active', 'created_at', 'updated_at',
            'settings'
        )
        read_only_fields = ('id', 'created_at', 'updated_at')

    def validate_code(self, value):
        code = value.strip().upper()
        if not code.replace('_', '').replace('-', '').isalnum():
            raise serializers.ValidationError("Code must be alphanumeric (allowing - and _).")
        return code

    def validate_phone(self, value):
        phone = ''.join(ch for ch in value if ch.isdigit())
        if len(phone) < 7 or len(phone) > 15:
            raise serializers.ValidationError("Phone must have 7 to 15 digits.")
        return phone

    def validate_pincode(self, value):
        pincode = value.strip()
        if not pincode.isdigit() or not (4 <= len(pincode) <= 10):
            raise serializers.ValidationError("Pincode must be 4 to 10 digits.")
        return pincode

    def validate_recovery_email(self, value):
        if not value:
            return value
        normalized = value.strip().lower()
        qs = Store.objects.filter(recovery_email__iexact=normalized)
        if self.instance:
            qs = qs.exclude(id=self.instance.id)
        if qs.exists():
            raise serializers.ValidationError("Recovery email is already used by another store.")
        return normalized

    def validate(self, attrs):
        recovery_email = attrs.get('recovery_email')
        instance = getattr(self, 'instance', None)
        if instance is None and not recovery_email:
            raise serializers.ValidationError({"recovery_email": "Recovery email is required."})
        if instance is not None and 'recovery_email' in attrs and not attrs.get('recovery_email'):
            raise serializers.ValidationError({"recovery_email": "Recovery email cannot be empty."})

        is_main = attrs.get('is_main')
        if is_main:
            qs = Store.objects.filter(is_main=True)
            if instance:
                qs = qs.exclude(id=instance.id)
            if qs.exists():
                raise serializers.ValidationError({"is_main": "Another main store already exists."})
        return attrs
