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
        constraints = [
            models.CheckConstraint(check=models.Q(credit_period__gte=0), name='supplier_credit_period_gte_0'),
            models.CheckConstraint(check=models.Q(credit_limit__gte=0), name='supplier_credit_limit_gte_0'),
        ]

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
        constraints = [
            models.CheckConstraint(check=models.Q(shipping_charges__gte=0), name='po_shipping_charges_gte_0'),
            models.CheckConstraint(check=models.Q(subtotal__gte=0), name='po_subtotal_gte_0'),
            models.CheckConstraint(check=models.Q(tax_total__gte=0), name='po_tax_total_gte_0'),
            models.CheckConstraint(check=models.Q(total__gte=0), name='po_total_gte_0'),
        ]

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
        constraints = [
            models.CheckConstraint(check=models.Q(quantity_ordered__gte=0), name='po_item_qty_ordered_gte_0'),
            models.CheckConstraint(check=models.Q(quantity_received__gte=0), name='po_item_qty_received_gte_0'),
            models.CheckConstraint(check=models.Q(unit_price__gte=0), name='po_item_unit_price_gte_0'),
            models.CheckConstraint(check=models.Q(tax_rate__gte=0), name='po_item_tax_rate_gte_0'),
            models.CheckConstraint(check=models.Q(total__gte=0), name='po_item_total_gte_0'),
        ]

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
    is_active = models.BooleanField(default=True)

    created_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.CheckConstraint(check=models.Q(subtotal__gte=0), name='grn_subtotal_gte_0'),
            models.CheckConstraint(check=models.Q(discount_total__gte=0), name='grn_discount_total_gte_0'),
            models.CheckConstraint(check=models.Q(tax_total__gte=0), name='grn_tax_total_gte_0'),
            models.CheckConstraint(check=models.Q(shipping_charges__gte=0), name='grn_shipping_charges_gte_0'),
            models.CheckConstraint(check=models.Q(total__gte=0), name='grn_total_gte_0'),
        ]

    def __str__(self):
        return self.grn_number

    def calculate_totals(self):
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
        constraints = [
            models.CheckConstraint(check=models.Q(quantity__gte=0), name='grn_item_qty_gte_0'),
            models.CheckConstraint(check=models.Q(unit_price__gte=0), name='grn_item_unit_price_gte_0'),
            models.CheckConstraint(check=models.Q(tax_rate__gte=0), name='grn_item_tax_rate_gte_0'),
            models.CheckConstraint(check=models.Q(total__gte=0), name='grn_item_total_gte_0'),
        ]

    def __str__(self):
        return f"{self.product.name} - {self.quantity} units"

    def save(self, *args, **kwargs):
        # Ensure all values are properly converted to Decimal
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
        ('partially_paid', 'Partially Paid'),
        ('paid', 'Paid'),
    )

    invoice_number = models.CharField(max_length=50, unique=True)
    supplier_invoice_number = models.CharField(max_length=100)
    supplier_name = models.CharField(max_length=255, blank=True, null=True)
    supplier = models.ForeignKey(Supplier, on_delete=models.SET_NULL, null=True, blank=True, related_name='invoices')

    po_number = models.CharField(max_length=100, blank=True, null=True)
    purchase_order = models.ForeignKey(PurchaseOrder, on_delete=models.SET_NULL, null=True, blank=True,
                                       related_name='supplier_invoices')
    grn_number = models.CharField(max_length=100, blank=True, null=True)
    grn = models.ForeignKey(GoodsReceiptNote, on_delete=models.SET_NULL, null=True, blank=True,
                            related_name='supplier_invoices')
    store = models.ForeignKey('stores.Store', on_delete=models.SET_NULL, null=True, blank=True,
                              related_name='supplier_invoices')

    invoice_date = models.DateField(default=timezone.now)
    due_date = models.DateField()

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    payment_terms = models.CharField(max_length=50, default='Net 30')

    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    shipping_charges = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    grand_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    amount_paid = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    notes = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, blank=True,
                                   related_name='created_supplier_invoices')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.CheckConstraint(check=models.Q(subtotal__gte=0), name='supplier_invoice_subtotal_gte_0'),
            models.CheckConstraint(check=models.Q(discount_total__gte=0), name='supplier_invoice_discount_total_gte_0'),
            models.CheckConstraint(check=models.Q(tax_total__gte=0), name='supplier_invoice_tax_total_gte_0'),
            models.CheckConstraint(check=models.Q(shipping_charges__gte=0), name='supplier_invoice_shipping_gte_0'),
            models.CheckConstraint(check=models.Q(grand_total__gte=0), name='supplier_invoice_grand_total_gte_0'),
            models.CheckConstraint(check=models.Q(amount_paid__gte=0), name='supplier_invoice_amount_paid_gte_0'),
        ]

    def __str__(self):
        return f"Supplier Invoice - {self.invoice_number}"

    @property
    def due_amount(self):
        return max(self.grand_total - self.amount_paid, Decimal('0'))

    def calculate_totals(self):
        items = self.items.all()
        if not items.exists():
            self.subtotal = Decimal('0.00')
            self.discount_total = Decimal('0.00')
            self.tax_total = Decimal('0.00')
            self.grand_total = Decimal(str(self.shipping_charges or 0))
            return

        subtotal = Decimal('0.00')
        discount_total = Decimal('0.00')
        tax_total = Decimal('0.00')
        grand_total = Decimal('0.00')

        for item in items:
            line_subtotal = Decimal(str(item.quantity)) * Decimal(str(item.unit_price))
            subtotal += line_subtotal
            raw_discount = Decimal(str(item.discount or 0))
            if item.discount_type == 'amount':
                line_discount = min(raw_discount, line_subtotal)
            else:
                line_discount = (line_subtotal * (raw_discount / Decimal('100'))).quantize(Decimal('0.01'))
            discount_total += line_discount
            tax_total += Decimal(str(item.tax_amount))
            grand_total += Decimal(str(item.total))

        self.subtotal = subtotal.quantize(Decimal('0.01'))
        self.discount_total = discount_total.quantize(Decimal('0.01'))
        self.tax_total = tax_total.quantize(Decimal('0.01'))
        self.grand_total = (grand_total + Decimal(str(self.shipping_charges or 0))).quantize(Decimal('0.01'))


class SupplierInvoiceItem(models.Model):
    invoice = models.ForeignKey(SupplierInvoice, on_delete=models.CASCADE, related_name='items')
    product_ref = models.ForeignKey('inventory.Product', on_delete=models.SET_NULL, null=True, blank=True,
                                    related_name='supplier_invoice_items')
    product_code = models.CharField(max_length=100, blank=True, null=True)
    product_name = models.CharField(max_length=255)

    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)

    discount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    discount_type = models.CharField(max_length=20, choices=[('percentage', 'Percentage'), ('amount', 'Amount')],
                                     default='percentage')

    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    tax_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        constraints = [
            models.CheckConstraint(check=models.Q(quantity__gte=0), name='supplier_invoice_item_qty_gte_0'),
            models.CheckConstraint(check=models.Q(unit_price__gte=0), name='supplier_invoice_item_unit_price_gte_0'),
            models.CheckConstraint(check=models.Q(tax_rate__gte=0), name='supplier_invoice_item_tax_rate_gte_0'),
            models.CheckConstraint(check=models.Q(total__gte=0), name='supplier_invoice_item_total_gte_0'),
        ]

    def __str__(self):
        return self.product_name

    def save(self, *args, **kwargs):
        quantity = Decimal(str(self.quantity or 0))
        unit_price = Decimal(str(self.unit_price or 0))
        tax_rate = Decimal(str(self.tax_rate or 0))
        discount = Decimal(str(self.discount or 0))

        base = (quantity * unit_price).quantize(Decimal('0.01'))

        if self.discount_type == 'amount':
            discount_amount = min(discount, base)
        else:
            discount_amount = (base * (discount / Decimal('100'))).quantize(Decimal('0.01'))

        taxable = max(base - discount_amount, Decimal('0.00'))
        tax_amount = (taxable * (tax_rate / Decimal('100'))).quantize(Decimal('0.01'))
        total = (taxable + tax_amount).quantize(Decimal('0.01'))

        self.tax_amount = tax_amount
        self.total = total

        super().save(*args, **kwargs)


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
    supplier_invoice = models.ForeignKey(SupplierInvoice, on_delete=models.SET_NULL, null=True, blank=True,
                                         related_name='payments')

    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES)

    reference_number = models.CharField(max_length=50, blank=True, null=True)
    payment_date = models.DateField(default=today)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    notes = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)

    created_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-payment_date']
        constraints = [
            models.CheckConstraint(check=models.Q(amount__gt=0), name='supplier_payment_amount_gt_0'),
        ]

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

            if self.supplier_invoice:
                invoice = self.supplier_invoice
                total_paid_for_invoice = SupplierPayment.objects.filter(
                    supplier_invoice=invoice,
                    status='completed'
                ).aggregate(total=Sum('amount'))['total'] or 0

                invoice.amount_paid = total_paid_for_invoice
                if total_paid_for_invoice >= invoice.grand_total:
                    invoice.status = 'paid'
                elif total_paid_for_invoice > 0:
                    invoice.status = 'partially_paid'
                invoice.save(update_fields=['amount_paid', 'status', 'updated_at'])
