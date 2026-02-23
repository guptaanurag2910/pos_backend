from django.db import models
from django.utils.text import slugify
from django.db.models import Sum, F

# Represents a product category (e.g., Beverages, Snacks)
class Category(models.Model):
    name = models.CharField(max_length=100)  # Name of the category (e.g., "Cold Drinks")
    slug = models.SlugField(max_length=100, unique=True)  # URL-friendly version of the name (auto-generated)
    parent = models.ForeignKey(
        'self', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='children'
    )  # Supports nested categories (e.g., "Soda" under "Beverages")
    description = models.TextField(blank=True, null=True)  # Optional long text description of the category
    is_active = models.BooleanField(default=True)  # Enables/disables the category from frontend/backend

    class Meta:
        verbose_name_plural = 'Categories'
        ordering = ['name']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)  # Generate slug from name if not manually set
        super().save(*args, **kwargs)


# Represents an individual product sold in the store
class Product(models.Model):
    TAX_CHOICES = (
        (0, '0%'),
        (5, '5%'),
        (12, '12%'),
        (18, '18%'),
        (28, '28%'),
    )

    name = models.CharField(max_length=255)  # Product name (e.g., "Pepsi 500ml")
    barcode = models.CharField(max_length=20, unique=True)  # Unique barcode/QR for scanning (e.g., 8901234567890)
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, related_name='products')  # Linked category
    description = models.TextField(blank=True, null=True)  # Optional description (e.g., brand, flavor)

    price = models.DecimalField(max_digits=10, decimal_places=2)  # Selling price (MRP)
    cost_price = models.DecimalField(max_digits=10, decimal_places=2)  # Purchase cost from supplier
    discount_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)  # Optional discounted price

    tax = models.IntegerField(choices=TAX_CHOICES, default=0)  # GST percentage applicable
    hsn_code = models.CharField(max_length=20, blank=True, null=True)  # HSN code for GST reporting

    is_active = models.BooleanField(default=True)  # Show/hide product in listings
    is_featured = models.BooleanField(default=False)  # Mark product as featured (e.g., homepage promo)
    is_service = models.BooleanField(default=False)  # If true, this is a service not stockable (e.g., delivery)

    unit = models.CharField(max_length=50, default='piece')  # Measurement unit (e.g., piece, liter, kg)
    weight = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)  # Net weight (e.g., 0.5 for 500g)

    image = models.ImageField(upload_to='products/', null=True, blank=True)  # Upload product image (for POS/catalog)

    created_at = models.DateTimeField(auto_now_add=True)  # Auto-set on creation
    updated_at = models.DateTimeField(auto_now=True)  # Auto-set on every update

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


# Every time a product is added/removed from stock, a StockRecord is created
class StockRecord(models.Model):
    RECORD_TYPE_CHOICES = (
        ('purchase', 'Purchase'),         # When stock is purchased
        ('sale', 'Sale'),                 # When product is sold
        ('return', 'Return'),             # Returned to supplier or by customer
        ('adjustment', 'Adjustment'),     # Manual stock correction
        ('transfer_in', 'Transfer In'),   # Incoming from another store
        ('transfer_out', 'Transfer Out'), # Outgoing to another store
    )

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='stock_records')  # Affected product
    store = models.ForeignKey('stores.Store', on_delete=models.CASCADE, related_name='stock_records')  # Store where it happened
    quantity = models.DecimalField(max_digits=10, decimal_places=2)  # Quantity added or removed

    record_type = models.CharField(max_length=20, choices=RECORD_TYPE_CHOICES)  # Type of stock movement

    reference_id = models.CharField(max_length=50, null=True, blank=True)  # Link to bill, PO, return slip, etc.
    batch_number = models.CharField(max_length=50, null=True, blank=True)  # Optional batch tracking
    expiry_date = models.DateField(null=True, blank=True)  # Optional expiry (e.g., for perishable goods)

    notes = models.TextField(blank=True, null=True)  # Optional explanation (e.g., damaged items, vendor info)
    created_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, related_name='stock_records')  # Staff responsible
    created_at = models.DateTimeField(auto_now_add=True)  # Timestamp

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.product.name} - {self.record_type} - {self.quantity}"


# Current real-time quantity for a product in a store
class StockLevel(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='stock_levels')  # Product being tracked
    store = models.ForeignKey('stores.Store', on_delete=models.CASCADE, related_name='stock_levels')  # Store location

    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=0)  # Current stock level
    min_stock = models.DecimalField(max_digits=10, decimal_places=2, default=0)  # Threshold for low stock alert
    max_stock = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)  # Optional limit to avoid overstock

    batch_number = models.CharField(max_length=50, null=True, blank=True)  # Batch-specific stock (if tracked)
    expiry_date = models.DateField(null=True, blank=True)  # Expiry for that batch

    updated_at = models.DateTimeField(auto_now=True)  # Updated when stock changes

    class Meta:
        unique_together = ('product', 'store', 'batch_number')  # Unique per batch per store
        ordering = ['product__name']

    def __str__(self):
        return f"{self.product.name} - {self.store.name} - {self.quantity}"

    @property
    def is_low_stock(self):
        return self.quantity <= self.min_stock  # Helper to check if restocking is needed


# Tracks movement of stock between stores (multi-store chain support)
class StockTransfer(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),           # Transfer created but not yet processed
        ('in_transit', 'In Transit'),     # Goods are en route
        ('completed', 'Completed'),       # Transfer completed and received
        ('cancelled', 'Cancelled'),       # Cancelled/aborted transfer
    )

    from_store = models.ForeignKey('stores.Store', on_delete=models.CASCADE, related_name='outgoing_transfers')  # Source
    to_store = models.ForeignKey('stores.Store', on_delete=models.CASCADE, related_name='incoming_transfers')  # Destination

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')  # Current state of transfer
    notes = models.TextField(blank=True, null=True)  # Optional notes (e.g., delivery person name, reason)

    created_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, related_name='created_transfers')  # Who initiated
    created_at = models.DateTimeField(auto_now_add=True)  # When transfer was created

    completed_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='completed_transfers')  # Who confirmed delivery
    completed_at = models.DateTimeField(null=True, blank=True)  # When transfer was completed

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Transfer #{self.id} - {self.from_store.name} to {self.to_store.name} ({self.status})"


# Each item/product in a StockTransfer
class StockTransferItem(models.Model):
    transfer = models.ForeignKey(StockTransfer, on_delete=models.CASCADE, related_name='items')  # Parent transfer
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='transfer_items')  # Product being transferred
    quantity = models.DecimalField(max_digits=10, decimal_places=2)  # Quantity to be transferred

    batch_number = models.CharField(max_length=50, null=True, blank=True)  # Optional batch info
    expiry_date = models.DateField(null=True, blank=True)  # Optional expiry (per batch)

    created_at = models.DateTimeField(auto_now_add=True)  # Record creation timestamp

    class Meta:
        ordering = ['product__name']

    def __str__(self):
        return f"{self.product.name} - {self.quantity}"


class InventoryUpload(models.Model):
    file = models.FileField(upload_to='uploads/inventory/')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Inventory Upload {self.id} - {self.file.name}"
