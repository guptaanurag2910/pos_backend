from django.db import models
from django.utils import timezone
from django.db.models import Sum, F
from decimal import Decimal


# Represents a bill (sale) generated at a store
class Bill(models.Model):
    # Payment status tracking
    PAYMENT_STATUS_CHOICES = (
        ('pending', 'Pending'),  # No payment done yet
        ('partial', 'Partially Paid'),  # Some amount received
        ('paid', 'Paid in full'),
        ('refunded', 'Refunded'),  # Order returned/refunded
    )

    # Method of payment used
    PAYMENT_METHOD_CHOICES = (
        ('cash', 'Cash'),
        ('card', 'Card'),
        ('upi', 'UPI'),
        ('wallet', 'Wallet'),
        ('sodexo', 'Sodexo'),
        ('multiple', 'Multiple'),  # Combo (e.g., part UPI, part cash)
    )

    # Status of the bill
    BILL_STATUS_CHOICES = (
        ('draft', 'Draft'),  # Not finalized yet
        ('completed', 'Completed'),  # Sale completed
        ('cancelled', 'Cancelled'),  # Void/cancelled bill
        ('on_hold', 'On Hold'),  # Temporarily paused
    )

    bill_number = models.CharField(max_length=20, unique=True)  # Unique identifier for internal use
    invoice_number = models.CharField(max_length=20, unique=True, null=True, blank=True)  # External invoice number

    customer = models.ForeignKey('customers.Customer', on_delete=models.SET_NULL, null=True, blank=True,
                                 related_name='bills')  # Linked customer if any
    store = models.ForeignKey('stores.Store', on_delete=models.CASCADE, related_name='bills')  # Store where billed
    cashier = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True,
                                related_name='bills')  # Staff member handling the sale

    subtotal = models.DecimalField(max_digits=10, decimal_places=2, default=0)  # Total before tax and discount
    tax_total = models.DecimalField(max_digits=10, decimal_places=2, default=0)  # Total tax applied
    discount = models.DecimalField(max_digits=10, decimal_places=2, default=0)  # Total discount given
    round_off = models.DecimalField(max_digits=5, decimal_places=2, default=0)  # Manual/auto round-off adjustment
    total = models.DecimalField(max_digits=10, decimal_places=2, default=0)  # Final bill total (payable)

    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES,
                                      default='pending')  # Payment completion status
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES, null=True,
                                      blank=True)  # How customer paid

    status = models.CharField(max_length=20, choices=BILL_STATUS_CHOICES, default='draft')  # Lifecycle of the bill
    notes = models.TextField(blank=True, null=True)  # Optional remarks or instructions

    created_at = models.DateTimeField(auto_now_add=True)  # When bill was created
    updated_at = models.DateTimeField(auto_now=True)  # When bill was last modified
    completed_at = models.DateTimeField(null=True, blank=True)  # When sale was completed

    # Loyalty points system
    points_earned = models.PositiveIntegerField(default=0)  # Points earned from this bill
    points_redeemed = models.PositiveIntegerField(default=0)  # Points used on this bill

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.bill_number

    def calculate_totals(self):
        """Calculate subtotal, tax, discount and total based on bill items"""
        items = self.items.all()
        if not items:
            self.subtotal = 0
            self.tax_total = 0
            self.total = 0
            return

        # Sum line item values
        self.subtotal = sum(item.total for item in items)
        self.tax_total = sum(item.tax_amount for item in items)
        discounted_total = self.subtotal + self.tax_total - self.discount

        # Round off to nearest rupee
        if discounted_total % 1 < 0.5:
            self.round_off = -discounted_total % 1
        else:
            self.round_off = 1 - discounted_total % 1

        self.total = discounted_total + self.round_off

    def complete(self, payment_method=None):
        """Finalize bill, update loyalty and inventory"""
        if self.status == 'completed':
            return False

        from inventory.models import StockRecord, StockLevel

        # Pre-check stock before mutating anything
        for item in self.items.select_related('product').all():
            available_qty = StockLevel.objects.filter(
                product=item.product,
                store=self.store
            ).aggregate(total=Sum('quantity')).get('total') or Decimal('0')

            if available_qty < item.quantity:
                raise ValueError(
                    f"Insufficient stock for {item.product.name}. "
                    f"Required {item.quantity}, available {available_qty}."
                )

        self.status = 'completed'
        self.completed_at = timezone.now()
        if payment_method:
            self.payment_method = payment_method
            self.payment_status = 'paid'

        # Loyalty reward logic
        if self.customer:
            self.points_earned = int(self.total / 10)
            self.customer.loyalty_points += self.points_earned
            self.customer.total_purchases += self.total
            self.customer.last_purchase = timezone.now()
            self.customer.save()

        self.save()

        # Inventory adjustments (consume stock across all batches for the store)
        for item in self.items.select_related('product').all():
            remaining = Decimal(str(item.quantity))
            stock_levels = StockLevel.objects.filter(
                product=item.product,
                store=self.store
            ).order_by(
                models.F('expiry_date').asc(nulls_last=True),
                'updated_at',
                'id'
            )

            for stock_level in stock_levels:
                if remaining <= 0:
                    break

                level_qty = Decimal(str(stock_level.quantity))
                if level_qty <= 0:
                    continue

                deduction = min(level_qty, remaining)
                stock_level.quantity = level_qty - deduction
                stock_level.save(update_fields=['quantity', 'updated_at'])
                remaining -= deduction

            if remaining > 0:
                raise ValueError(f"Unable to allocate stock for {item.product.name} during completion.")

            # Log sale movement
            StockRecord.objects.create(
                product=item.product,
                store=self.store,
                quantity=-item.quantity,
                record_type='sale',
                reference_id=self.bill_number,
                created_by=self.cashier
            )

        return True


# Each line item in a bill (i.e., a product purchase)
class BillItem(models.Model):
    bill = models.ForeignKey(Bill, on_delete=models.CASCADE, related_name='items')  # Parent bill
    product = models.ForeignKey('inventory.Product', on_delete=models.CASCADE,
                                related_name='bill_items')  # Purchased product

    quantity = models.DecimalField(max_digits=10, decimal_places=2)  # How many units bought
    price = models.DecimalField(max_digits=10, decimal_places=2)  # Unit price at sale time

    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)  # GST % applied
    tax_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)  # Absolute tax value

    discount_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)  # Discount % applied
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)  # Discount value in Rs.

    total = models.DecimalField(max_digits=10,
                                decimal_places=2)  # Final line item value = (price * qty) + tax - discount

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['product__name']

    def __str__(self):
        return f"{self.product.name} x {self.quantity}"

    def save(self, *args, **kwargs):
        quantity = Decimal(self.quantity)
        tax_rate = Decimal(self.tax_rate)
        discount_rate = Decimal(self.discount_rate)

        self.tax_amount = self.price * quantity * (tax_rate / Decimal('100'))
        self.discount_amount = self.price * quantity * (discount_rate / Decimal('100'))
        self.total = (self.price * quantity) + self.tax_amount - self.discount_amount

        super().save(*args, **kwargs)


# Represents payment made towards a bill (supports multiple payments)
class Payment(models.Model):
    PAYMENT_METHOD_CHOICES = (
        ('cash', 'Cash'),
        ('card', 'Card'),
        ('upi', 'UPI'),
        ('wallet', 'Wallet'),
        ('sodexo', 'Sodexo'),
        ('store_credit', 'Store Credit'),
        ('exchange', 'Exchange'),
    )

    PAYMENT_STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('refunded', 'Refunded'),
    )

    bill = models.ForeignKey(Bill, on_delete=models.CASCADE, related_name='payments')  # The bill being paid
    amount = models.DecimalField(max_digits=10, decimal_places=2)  # Amount paid
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES)  # Mode of payment

    transaction_id = models.CharField(max_length=100, null=True, blank=True)  # Reference ID from gateway/UPI/card
    payment_details = models.JSONField(null=True, blank=True)  # Optional structured info (e.g., last 4 digits of card)

    status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES,
                              default='pending')  # Status of the transaction

    created_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True)  # Who collected the payment
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.bill.bill_number} - {self.payment_method} - {self.amount}"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)

        # Refresh bill's payment status based on all payments
        bill = self.bill
        total_paid = Payment.objects.filter(
            bill=bill, status='completed'
        ).aggregate(total=Sum('amount')).get('total', 0) or 0

        if total_paid == 0:
            bill.payment_status = 'pending'
        elif total_paid < bill.total:
            bill.payment_status = 'partial'
        else:
            bill.payment_status = 'paid'

        # If only one completed method, store it directly, else mark as multiple
        if bill.payment_status == 'paid':
            methods = Payment.objects.filter(bill=bill, status='completed') \
                .values_list('payment_method', flat=True)
            unique_methods = set(methods)

            if len(unique_methods) == 1:
                bill.payment_method = list(unique_methods)[0]
            else:
                bill.payment_method = 'multiple'

        bill.save()
