from django.contrib import admin
from .models import Store, StoreSettings
from django.db import models


class StoreSettingsInline(admin.StackedInline):
    model = StoreSettings
    can_delete = False
    raw_id_fields = ['updated_by']
    readonly_fields = ['updated_at']
    fieldsets = (
        ('General Settings', {
            'fields': (
                'store_logo', 'currency_symbol', 'decimal_places',
                'date_format', 'theme'
            )
        }),
        ('Invoice Settings', {
            'fields': (
                'invoice_prefix', 'invoice_start_number',
                'invoice_footer_text', 'show_tax_in_invoice',
                'enable_invoice_email'
            )
        }),
        ('Billing Settings', {
            'fields': (
                'allow_partial_payments', 'enable_discount',
                'default_tax_rate', 'enable_round_off'
            )
        }),
        ('Printer Settings', {
            'fields': (
                'printer_type', 'printer_address', 'enable_auto_print'
            )
        }),
        ('Other Settings', {
            'fields': (
                'enable_low_stock_alert', 'low_stock_threshold',
                'enable_customer_points', 'points_conversion_rate',
                'updated_at', 'updated_by'
            )
        }),
    )


@admin.register(Store)
class StoreAdmin(admin.ModelAdmin):
    list_display = [field.name for field in Store._meta.fields]
    search_fields = [field.name for field in Store._meta.fields if isinstance(field, (models.CharField, models.TextField, models.EmailField))]
    readonly_fields = ['created_at', 'updated_at']
    inlines = [StoreSettingsInline]


@admin.register(StoreSettings)
class StoreSettingsAdmin(admin.ModelAdmin):
    list_display = [field.name for field in StoreSettings._meta.fields]
    search_fields = [field.name for field in StoreSettings._meta.fields if isinstance(field, (models.CharField, models.TextField))]
    readonly_fields = ['updated_at']
    raw_id_fields = ['store', 'updated_by']
