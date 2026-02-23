from django.contrib import admin
from .models import Bill, BillItem, Payment
from django.db import models


# Inline for Bill Items
class BillItemInline(admin.TabularInline):
    model = BillItem
    extra = 0
    raw_id_fields = ['product']
    readonly_fields = ['total', 'tax_amount', 'discount_amount']
    fields = [field.name for field in BillItem._meta.fields if field.name != 'id']


# Inline for Payments
class PaymentInline(admin.TabularInline):
    model = Payment
    extra = 0
    raw_id_fields = ['created_by']
    readonly_fields = ['created_at', 'updated_at']
    fields = [field.name for field in Payment._meta.fields if field.name != 'id']


@admin.register(Bill)
class BillAdmin(admin.ModelAdmin):
    list_display = [field.name for field in Bill._meta.fields]
    search_fields = [field.name for field in Bill._meta.fields if isinstance(field, (models.CharField, models.TextField))]
    readonly_fields = ['created_at', 'updated_at', 'completed_at', 'subtotal', 'tax_total', 'round_off', 'total', 'points_earned']
    raw_id_fields = ['customer', 'store', 'cashier']
    inlines = [BillItemInline, PaymentInline]


@admin.register(BillItem)
class BillItemAdmin(admin.ModelAdmin):
    list_display = [field.name for field in BillItem._meta.fields]
    search_fields = [field.name for field in BillItem._meta.fields if isinstance(field, (models.CharField, models.TextField))]
    readonly_fields = ['total', 'tax_amount', 'discount_amount', 'created_at']
    raw_id_fields = ['bill', 'product']


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = [field.name for field in Payment._meta.fields]
    search_fields = [field.name for field in Payment._meta.fields if isinstance(field, (models.CharField, models.TextField))]
    readonly_fields = ['created_at', 'updated_at']
    raw_id_fields = ['bill', 'created_by']
