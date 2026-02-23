from django.db import models
from django.utils import timezone
from django.db.models import Sum
from decimal import Decimal
from django.utils.timezone import now


def today():
    return now().date()

class Supplier(models.Model):
    name = models.CharField(max_length=255)
    contact_person = models.CharField(max_length=255, blank=True, null=True)
    phone = models.CharField(max_length=15)
    email = models.EmailField(blank=True, null=True)

    address = models.TextField(blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    state = models.CharField(max_length=100, blank=True, null=True)
    pincode = models.CharField(max_length=10, blank=True, null=True)

    gst_number = models.CharField(max_length=15, blank=True, null=True)
    pan_number = models.CharField(max_length=10, blank=True, null=True)

    credit_period = models.IntegerField(default=30)  # Days
    credit_limit = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    current_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    notes = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class PurchaseOrder(models.Model):
    STATUS_CHOICES = (
        ('draft', 'Draft'),
        ('sent', 'Sent to Supplier'),
        ('partially_received', 'Partially Received'),
        ('received', 'Fully Received'),
        ('cancelled', 'Cancelled'),
    )

    PAYMENT_STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('partially_paid', 'Partially Paid'),
        ('paid', 'Paid'),
    )

    po_number = models.CharField(max_length=40, unique=True)
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name='purchase_orders')
    store = models.ForeignKey('stores.Store', on_delete=models.CASCADE, related_name='purchase_orders')

    order_date = models.DateField(default=timezone.now)
    expected_delivery_date = models.DateField(null=True, blank=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default='pending')

    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    shipping_charges = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    notes = models.TextField(blank=True, null=True)
    terms = models.TextField(blank=True, null=True)

    created_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, related_name='created_purchase_orders')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.po_number

    def calculate_totals(self):
        """Calculate subtotal, tax, and total for the purchase order"""
        items = self.items.all()

        if not items:
            self.subtotal = 0
            self.tax_total = 0
            self.total = 0
            return

        raw_subtotal = sum(item.unit_price * item.quantity_ordered for item in items)
        tax_total = sum(item.tax_amount for item in items)

        self.subtotal = raw_subtotal
        self.tax_total = tax_total
        self.total = raw_subtotal + tax_total + self.shipping_charges
        self.save()

        # self.subtotal = sum(item.total for item in items)
        # self.tax_total = sum(item.tax_amount for item in items)
        # self.total = self.subtotal + self.tax_total + self.shipping_charges
        # self.save()


class PurchaseOrderItem(models.Model):
    purchase_order = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey('inventory.Product', on_delete=models.CASCADE, related_name='purchase_order_items')

    quantity_ordered = models.DecimalField(max_digits=10, decimal_places=2)
    quantity_received = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    tax_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    discount_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    expected_delivery_date = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ['product__name']

    def __str__(self):
        return f"{self.product.name} - {self.quantity_ordered} units"

    def save(self, *args, **kwargs):
        # Ensure Decimal conversions
        quantity_ordered = Decimal(str(self.quantity_ordered))
        unit_price = Decimal(str(self.unit_price))
        discount_percentage = Decimal(str(self.discount_percentage))
        tax_rate = Decimal(str(self.tax_rate))

        base_amount = unit_price * quantity_ordered
        self.discount_amount = base_amount * (discount_percentage / Decimal('100'))
        amount_after_discount = base_amount - self.discount_amount
        self.tax_amount = amount_after_discount * (tax_rate / Decimal('100'))
        self.total = amount_after_discount + self.tax_amount

        super().save(*args, **kwargs)


class GoodsReceiptNote(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('completed', 'Completed'),
    )

    grn_number = models.CharField(max_length=40, unique=True)
    purchase_order = models.ForeignKey(PurchaseOrder, on_delete=models.SET_NULL, null=True, blank=True, related_name='grns')
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name='grns')
    store = models.ForeignKey('stores.Store', on_delete=models.CASCADE, related_name='grns')

    receipt_date = models.DateField(default=today)
    invoice_number = models.CharField(max_length=50, blank=True, null=True)
    invoice_date = models.DateField(null=True, blank=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')

    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    shipping_charges = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    notes = models.TextField(blank=True, null=True)

    created_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.grn_number

    def calculate_totals(self):
        print("@"*100)
        items = self.items.all()

        if not items:
            self.subtotal = 0
            self.tax_total = 0
            self.discount_total = 0
            self.total = 0
            return

        raw_subtotal = sum(item.unit_price * item.quantity for item in items)
        discount_total = sum(item.discount_amount for item in items)
        tax_total = sum(item.tax_amount for item in items)
        print(raw_subtotal, discount_total, tax_total, self.shipping_charges)

        self.subtotal = raw_subtotal
        self.discount_total = discount_total
        self.tax_total = tax_total
        self.total = raw_subtotal - discount_total + tax_total + self.shipping_charges
        self.save()


class GoodsReceiptNoteItem(models.Model):
    grn = models.ForeignKey(GoodsReceiptNote, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey('inventory.Product', on_delete=models.CASCADE, related_name='grn_items')

    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)

    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    tax_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    discount_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    batch_number = models.CharField(max_length=50, blank=True, null=True)
    expiry_date = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ['product__name']

    def __str__(self):
        return f"{self.product.name} - {self.quantity} units"

    def save(self, *args, **kwargs):
        # Ensure all values are properly converted to Decimal
        print("b" * 100)
        unit_price = Decimal(str(self.unit_price))
        quantity = Decimal(str(self.quantity))
        discount_percentage = Decimal(str(self.discount_percentage))
        tax_rate = Decimal(str(self.tax_rate))

        base_amount = unit_price * quantity
        self.discount_amount = base_amount * (discount_percentage / Decimal('100'))
        amount_after_discount = base_amount - self.discount_amount
        self.tax_amount = amount_after_discount * (tax_rate / Decimal('100'))
        self.total = amount_after_discount + self.tax_amount

        super().save(*args, **kwargs)


class SupplierInvoice(models.Model):
    STATUS_CHOICES = (
        ('draft', 'Draft'),
        ('verified', 'Verified'),
        ('approved', 'Approved'),
        ('paid', 'Paid'),
    )

    invoice_number = models.CharField(max_length=50, unique=True)
    supplier_invoice_number = models.CharField(max_length=100)
    supplier_name = models.CharField(max_length=255)

    po_number = models.CharField(max_length=100)
    grn_number = models.CharField(max_length=100, blank=True, null=True)

    invoice_date = models.DateField(default=timezone.now)
    due_date = models.DateField()

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    payment_terms = models.CharField(max_length=50, default='Net 30')

    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    shipping_charges = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    grand_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    notes = models.TextField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Supplier Invoice - {self.invoice_number}"


class SupplierInvoiceItem(models.Model):
    invoice = models.ForeignKey(SupplierInvoice, on_delete=models.CASCADE, related_name='items')

    product_id = models.CharField(max_length=100)
    product_name = models.CharField(max_length=255)

    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)

    discount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    discount_type = models.CharField(max_length=20, choices=[('percentage', 'Percentage'), ('amount', 'Amount')],
                                     default='percentage')

    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    def __str__(self):
        return self.product_name


class SupplierPayment(models.Model):
    PAYMENT_METHOD_CHOICES = (
        ('cash', 'Cash'),
        ('bank_transfer', 'Bank Transfer'),
        ('check', 'Check'),
        ('credit', 'Credit'),
        ('upi', 'UPI'),
    )

    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    )

    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name='payments')
    purchase_order = models.ForeignKey(PurchaseOrder, on_delete=models.SET_NULL, null=True, blank=True, related_name='payments')

    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES)

    reference_number = models.CharField(max_length=50, blank=True, null=True)
    payment_date = models.DateField(default=today)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    notes = models.TextField(blank=True, null=True)

    created_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-payment_date']

    def __str__(self):
        return f"Payment to {self.supplier.name} - {self.amount}"

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)

        if is_new and self.status == 'completed':
            # Update supplier balance
            self.supplier.current_balance += self.amount
            self.supplier.save()

            # Update purchase order payment status if applicable
            if self.purchase_order:
                po = self.purchase_order
                total_paid = SupplierPayment.objects.filter(
                    purchase_order=po,
                    status='completed'
                ).aggregate(total=Sum('amount'))['total'] or 0

                if total_paid >= po.total:
                    po.payment_status = 'paid'
                elif total_paid > 0:
                    po.payment_status = 'partially_paid'
                po.save()