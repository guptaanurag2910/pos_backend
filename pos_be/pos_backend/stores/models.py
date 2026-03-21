from django.db import models
from django.db.models import Q

class Store(models.Model):
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=20, unique=True)
    address = models.TextField()
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    pincode = models.CharField(max_length=10)
    phone = models.CharField(max_length=15)
    email = models.EmailField(null=True, blank=True)
    recovery_email = models.EmailField(unique=True, null=True, blank=True)
    
    gst_number = models.CharField(max_length=15, null=True, blank=True)
    pan_number = models.CharField(max_length=10, null=True, blank=True)
    
    opening_time = models.TimeField(null=True, blank=True)
    closing_time = models.TimeField(null=True, blank=True)
    
    is_main = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['name']
        constraints = [
            models.UniqueConstraint(
                fields=['is_main'],
                condition=Q(is_main=True),
                name='single_main_store'
            ),
        ]
    
    def __str__(self):
        return self.name


class StoreSettings(models.Model):
    THEME_CHOICES = (
        ('light', 'Light'),
        ('dark', 'Dark'),
        ('system', 'System Default'),
    )
    
    store = models.OneToOneField(Store, on_delete=models.CASCADE, related_name='settings')
    
    # General settings
    store_logo = models.ImageField(upload_to='store_logos/', null=True, blank=True)
    currency_symbol = models.CharField(max_length=5, default='₹')
    decimal_places = models.IntegerField(default=2)
    date_format = models.CharField(max_length=20, default='DD/MM/YYYY')
    theme = models.CharField(max_length=10, choices=THEME_CHOICES, default='light')
    
    # Invoice settings
    invoice_prefix = models.CharField(max_length=10, default='INV')
    invoice_start_number = models.IntegerField(default=1)
    invoice_footer_text = models.TextField(null=True, blank=True)
    show_tax_in_invoice = models.BooleanField(default=True)
    enable_invoice_email = models.BooleanField(default=False)
    
    # Billing settings
    allow_partial_payments = models.BooleanField(default=True)
    enable_discount = models.BooleanField(default=True)
    default_tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    enable_round_off = models.BooleanField(default=True)
    
    # Printer settings
    printer_type = models.CharField(max_length=20, default='80mm')
    printer_address = models.CharField(max_length=100, null=True, blank=True)
    enable_auto_print = models.BooleanField(default=True)
    
    # Other settings
    enable_low_stock_alert = models.BooleanField(default=True)
    low_stock_threshold = models.IntegerField(default=10)
    enable_customer_points = models.BooleanField(default=True)
    points_conversion_rate = models.DecimalField(max_digits=10, decimal_places=2, default=1.0)
    
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True)
    
    def __str__(self):
        return f"Settings for {self.store.name}"
