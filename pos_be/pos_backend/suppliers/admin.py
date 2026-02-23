from django.contrib import admin
from .models import (
    Supplier, PurchaseOrder, PurchaseOrderItem,
    GoodsReceiptNote, GoodsReceiptNoteItem,
    SupplierPayment
)
from django.db import models


# Inlines
class PurchaseOrderItemInline(admin.TabularInline):
    model = PurchaseOrderItem
    extra = 0
    raw_id_fields = ['product']
    readonly_fields = ['tax_amount', 'discount_amount', 'total']


class GoodsReceiptNoteItemInline(admin.TabularInline):
    model = GoodsReceiptNoteItem
    extra = 0
    raw_id_fields = ['product']
    readonly_fields = ['tax_amount', 'discount_amount', 'total']


# Supplier Admin
@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = [field.name for field in Supplier._meta.fields]
    search_fields = [field.name for field in Supplier._meta.fields if isinstance(field, (models.CharField, models.TextField, models.EmailField))]
    raw_id_fields = ['created_by']
    readonly_fields = ['created_at', 'updated_at']


# Purchase Order Admin
@admin.register(PurchaseOrder)
class PurchaseOrderAdmin(admin.ModelAdmin):
    list_display = [field.name for field in PurchaseOrder._meta.fields]
    search_fields = [field.name for field in PurchaseOrder._meta.fields if isinstance(field, (models.CharField, models.TextField))]
    raw_id_fields = ['supplier', 'store', 'created_by']
    readonly_fields = ['created_at', 'updated_at', 'subtotal', 'tax_total', 'total']
    inlines = [PurchaseOrderItemInline]


# Purchase Order Item Admin
@admin.register(PurchaseOrderItem)
class PurchaseOrderItemAdmin(admin.ModelAdmin):
    list_display = [field.name for field in PurchaseOrderItem._meta.fields]
    search_fields = [field.name for field in PurchaseOrderItem._meta.fields if isinstance(field, (models.CharField, models.TextField))]
    raw_id_fields = ['purchase_order', 'product']
    readonly_fields = ['tax_amount', 'discount_amount', 'total']


# Goods Receipt Note Admin
@admin.register(GoodsReceiptNote)
class GoodsReceiptNoteAdmin(admin.ModelAdmin):
    list_display = [field.name for field in GoodsReceiptNote._meta.fields]
    search_fields = [field.name for field in GoodsReceiptNote._meta.fields if isinstance(field, (models.CharField, models.TextField))]
    raw_id_fields = ['purchase_order', 'supplier', 'store', 'created_by']
    readonly_fields = ['created_at', 'updated_at', 'subtotal', 'tax_total', 'total']
    inlines = [GoodsReceiptNoteItemInline]


# GRN Item Admin
@admin.register(GoodsReceiptNoteItem)
class GoodsReceiptNoteItemAdmin(admin.ModelAdmin):
    list_display = [field.name for field in GoodsReceiptNoteItem._meta.fields]
    search_fields = [field.name for field in GoodsReceiptNoteItem._meta.fields if isinstance(field, (models.CharField, models.TextField))]
    raw_id_fields = ['grn', 'product']
    readonly_fields = ['tax_amount', 'discount_amount', 'total']


# Supplier Payment Admin
@admin.register(SupplierPayment)
class SupplierPaymentAdmin(admin.ModelAdmin):
    list_display = [field.name for field in SupplierPayment._meta.fields]
    search_fields = [field.name for field in SupplierPayment._meta.fields if isinstance(field, (models.CharField, models.TextField))]
    raw_id_fields = ['supplier', 'purchase_order', 'created_by']
    readonly_fields = ['created_at', 'updated_at']
