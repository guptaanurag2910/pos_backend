from django.db import models
from django.utils.text import slugify

class Customer(models.Model):
    name = models.CharField(max_length=255)
    phone = models.CharField(max_length=15, unique=True)
    email = models.EmailField(blank=True, null=True)
    
    address = models.TextField(blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    state = models.CharField(max_length=100, blank=True, null=True)
    pincode = models.CharField(max_length=10, blank=True, null=True)
    
    loyalty_points = models.IntegerField(default=0)
    total_purchases = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    last_purchase = models.DateField(null=True, blank=True)
    
    gst_number = models.CharField(max_length=15, blank=True, null=True)
    pan_number = models.CharField(max_length=10, blank=True, null=True)
    
    birthdate = models.DateField(null=True, blank=True)
    anniversary = models.DateField(null=True, blank=True)
    
    notes = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, related_name='created_customers')
    
    class Meta:
        ordering = ['name']
        constraints = [
            models.CheckConstraint(check=models.Q(loyalty_points__gte=0), name='customer_loyalty_points_gte_0'),
            models.CheckConstraint(check=models.Q(total_purchases__gte=0), name='customer_total_purchases_gte_0'),
        ]
    
    def __str__(self):
        return self.name or self.phone


class CustomerGroup(models.Model):
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)
    
    customers = models.ManyToManyField(Customer, related_name='groups')
    
    special_discount = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True)
    
    class Meta:
        ordering = ['name']
        constraints = [
            models.CheckConstraint(check=models.Q(special_discount__gte=0), name='customer_group_special_discount_gte_0'),
        ]
    
    def __str__(self):
        return self.name
    
    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)
