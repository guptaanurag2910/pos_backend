from django.contrib import admin
from .models import Return, ReturnItem

class ReturnItemInline(admin.TabularInline):
    model = ReturnItem
    extra = 0

@admin.register(Return)
class ReturnAdmin(admin.ModelAdmin):
    list_display = ('return_number', 'bill', 'return_type', 'refund_method', 'status', 'return_date')
    search_fields = ('return_number', 'bill__bill_number', 'customer_name')
    list_filter = ('status', 'refund_method', 'return_type', 'return_date')
    inlines = [ReturnItemInline]
