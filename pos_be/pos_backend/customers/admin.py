from django.contrib import admin
from .models import Customer, CustomerGroup


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = (
        'name', 'phone', 'email', 'city', 'state',
        'loyalty_points', 'total_purchases', 'last_purchase',
        'created_by', 'created_at'
    )
    list_filter = ('city', 'state', 'created_at')
    search_fields = ('name', 'phone', 'email', 'gst_number', 'pan_number')
    readonly_fields = ('created_at', 'updated_at')
    raw_id_fields = ('created_by',)
    filter_horizontal = ['groups'] if 'groups' in [f.name for f in Customer._meta.many_to_many] else []

    fieldsets = (
        ('Basic Info', {
            'fields': ('name', 'phone', 'email')
        }),
        ('Address Info', {
            'fields': ('address', 'city', 'state', 'pincode')
        }),
        ('Purchase Info', {
            'fields': ('loyalty_points', 'total_purchases', 'last_purchase')
        }),
        ('IDs & Dates', {
            'fields': ('gst_number', 'pan_number', 'birthdate', 'anniversary')
        }),
        ('Other', {
            'fields': ('notes', 'groups', 'created_by', 'created_at', 'updated_at')
        }),
    )


@admin.register(CustomerGroup)
class CustomerGroupAdmin(admin.ModelAdmin):
    list_display = ('name', 'special_discount', 'is_active', 'created_by', 'created_at')
    search_fields = ('name', 'description')
    prepopulated_fields = {'slug': ('name',)}
    readonly_fields = ('created_at', 'updated_at')
    filter_horizontal = ('customers',)
    raw_id_fields = ('created_by',)
