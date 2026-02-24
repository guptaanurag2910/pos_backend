from django.db import models
from django.utils import timezone
from random import randint
from sales.models import Bill, BillItem
from inventory.models import Product
from accounts.models import User

class Return(models.Model):
    RETURN_TYPE_CHOICES = [('full', 'Full'), ('partial', 'Partial')]
    REFUND_METHOD_CHOICES = [
        ('cash', 'Cash'), ('card', 'Card'),
        ('store_credit', 'Store Credit'), ('exchange', 'Exchange')
    ]
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('completed', 'Completed'),
        ('rejected', 'Rejected')
    ]

    return_number = models.CharField(max_length=20, unique=True)
    bill = models.ForeignKey(Bill, on_delete=models.CASCADE, related_name='returns')
    return_type = models.CharField(max_length=10, choices=RETURN_TYPE_CHOICES)
    reason = models.TextField()
    subtotal = models.DecimalField(max_digits=10, decimal_places=2)
    tax_total = models.DecimalField(max_digits=10, decimal_places=2)
    refund_amount = models.DecimalField(max_digits=10, decimal_places=2)
    refund_method = models.CharField(max_length=20, choices=REFUND_METHOD_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    return_date = models.DateField(default=timezone.localdate)
    notes = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)

    customer_name = models.CharField(max_length=100, blank=True, null=True)
    customer_id = models.CharField(max_length=50, blank=True, null=True)
    processed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    processed_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ['-return_date', '-id']
        constraints = [
            models.CheckConstraint(check=models.Q(subtotal__gte=0), name='return_subtotal_gte_0'),
            models.CheckConstraint(check=models.Q(tax_total__gte=0), name='return_tax_total_gte_0'),
            models.CheckConstraint(check=models.Q(refund_amount__gte=0), name='return_refund_amount_gte_0'),
        ]

    def __str__(self):
        return self.return_number


    def save(self, *args, **kwargs):
        if not self.return_number:
            timestamp = timezone.now().strftime("%y%m%d%H%M%S")
            self.return_number = f"RET-{timestamp}{randint(0, 999):03d}"
        super().save(*args, **kwargs)

class ReturnItem(models.Model):
    CONDITION_CHOICES = [('good', 'Good'), ('damaged', 'Damaged'), ('defective', 'Defective'), ('expired', 'Expired')]

    return_ref = models.ForeignKey(Return, on_delete=models.CASCADE, related_name='items')
    bill_item = models.ForeignKey(BillItem, on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    original_quantity = models.DecimalField(max_digits=10, decimal_places=2)
    return_quantity = models.DecimalField(max_digits=10, decimal_places=2)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    tax = models.DecimalField(max_digits=5, decimal_places=2)
    reason = models.TextField(blank=True)
    condition = models.CharField(max_length=20, choices=CONDITION_CHOICES)
    refund_amount = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        constraints = [
            models.CheckConstraint(check=models.Q(original_quantity__gte=0), name='return_item_original_qty_gte_0'),
            models.CheckConstraint(check=models.Q(return_quantity__gt=0), name='return_item_return_qty_gt_0'),
            models.CheckConstraint(check=models.Q(unit_price__gte=0), name='return_item_unit_price_gte_0'),
            models.CheckConstraint(check=models.Q(refund_amount__gte=0), name='return_item_refund_amount_gte_0'),
            models.CheckConstraint(check=models.Q(return_quantity__lte=models.F('original_quantity')),
                                   name='return_item_qty_lte_original_qty'),
        ]
