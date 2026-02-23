from django.contrib import admin
from django.db import models
from .models import (
    Category, Product, StockRecord,
    StockLevel, StockTransfer, StockTransferItem, InventoryUpload
)
from .utils import import_inventory_xlsx


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = [field.name for field in Category._meta.fields]
    search_fields = [field.name for field in Category._meta.fields if isinstance(field, (models.CharField, models.TextField))]
    prepopulated_fields = {'slug': ('name',)}


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = [field.name for field in Product._meta.fields if field.name != 'description']
    search_fields = [field.name for field in Product._meta.fields if isinstance(field, (models.CharField, models.TextField))]
    raw_id_fields = ['category']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(StockRecord)
class StockRecordAdmin(admin.ModelAdmin):
    list_display = [field.name for field in StockRecord._meta.fields]
    search_fields = [field.name for field in StockRecord._meta.fields if isinstance(field, (models.CharField, models.TextField))]
    raw_id_fields = ['product', 'store', 'created_by']
    readonly_fields = ['created_at']


@admin.register(StockLevel)
class StockLevelAdmin(admin.ModelAdmin):
    list_display = [field.name for field in StockLevel._meta.fields]
    search_fields = [field.name for field in StockLevel._meta.fields if isinstance(field, (models.CharField, models.TextField))]
    raw_id_fields = ['product', 'store']
    readonly_fields = ['updated_at']


class StockTransferItemInline(admin.TabularInline):
    model = StockTransferItem
    extra = 0
    raw_id_fields = ['product']


@admin.register(StockTransfer)
class StockTransferAdmin(admin.ModelAdmin):
    list_display = [field.name for field in StockTransfer._meta.fields]
    search_fields = [field.name for field in StockTransfer._meta.fields if isinstance(field, (models.CharField, models.TextField))]
    raw_id_fields = ['from_store', 'to_store', 'created_by', 'completed_by']
    readonly_fields = ['created_at', 'completed_at']
    inlines = [StockTransferItemInline]


@admin.register(StockTransferItem)
class StockTransferItemAdmin(admin.ModelAdmin):
    list_display = [field.name for field in StockTransferItem._meta.fields]
    search_fields = [field.name for field in StockTransferItem._meta.fields if isinstance(field, (models.CharField, models.TextField))]
    raw_id_fields = ['transfer', 'product']


@admin.register(InventoryUpload)
class InventoryUploadAdmin(admin.ModelAdmin):
    list_display = ['id', 'file', 'uploaded_at']
    actions = ['run_import']

    def run_import(self, request, queryset):
        for obj in queryset:
            try:
                import_inventory_xlsx(obj.file.path)
                self.message_user(request, f"✅ Imported: {obj.file.name}", level=messages.SUCCESS)
            except Exception as e:
                self.message_user(request, f"❌ Error importing {obj.file.name}: {e}", level=messages.ERROR)

    run_import.short_description = "📥 Run Inventory Import for selected files"
