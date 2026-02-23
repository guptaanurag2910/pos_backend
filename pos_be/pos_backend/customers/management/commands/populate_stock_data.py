from django.core.management.base import BaseCommand
from django.utils import timezone
import random
from decimal import Decimal
from inventory.models import Product, StockRecord, StockLevel, StockTransfer, StockTransferItem
from stores.models import Store
from accounts.models import User

class Command(BaseCommand):
    help = 'Populate stock records, levels, and transfers with mock data'

    def handle(self, *args, **kwargs):
        products = list(Product.objects.filter(is_active=True))
        stores = list(Store.objects.all())
        users = list(User.objects.filter(is_active=True))

        if not products or not stores or not users:
            self.stdout.write(self.style.ERROR("Ensure products, stores, and users are populated."))
            return

        # Create StockLevel and StockRecord for each product in each store
        for product in products:
            for store in stores:
                quantity = Decimal(random.randint(10, 100))

                # Create StockLevel
                stock_level, created = StockLevel.objects.get_or_create(
                    product=product,
                    store=store,
                    batch_number=None,
                    defaults={
                        'quantity': quantity,
                        'min_stock': Decimal(5),
                        'max_stock': Decimal(200),
                    }
                )

                # Create StockRecord (as purchase)
                StockRecord.objects.create(
                    product=product,
                    store=store,
                    quantity=quantity,
                    record_type='purchase',
                    reference_id=f"PO-{random.randint(1000, 9999)}",
                    batch_number=None,
                    expiry_date=None,
                    notes='Initial stock',
                    created_by=random.choice(users),
                )

        self.stdout.write(self.style.SUCCESS("Stock levels and records created."))

        # Create a few stock transfers between stores
        if len(stores) < 2:
            self.stdout.write(self.style.WARNING("Need at least 2 stores to create transfers."))
            return

        for _ in range(5):
            from_store, to_store = random.sample(stores, 2)
            created_by = random.choice(users)

            transfer = StockTransfer.objects.create(
                from_store=from_store,
                to_store=to_store,
                status='completed',
                notes='Auto-generated transfer',
                created_by=created_by,
                created_at=timezone.now(),
                completed_by=created_by,
                completed_at=timezone.now(),
            )

            # Add 2-4 random items to transfer
            items = random.sample(products, min(4, len(products)))
            for product in items:
                quantity = Decimal(random.randint(1, 10))

                StockTransferItem.objects.create(
                    transfer=transfer,
                    product=product,
                    quantity=quantity,
                    batch_number=None,
                    expiry_date=None,
                )

                # Add stock record for incoming and outgoing
                StockRecord.objects.create(
                    product=product,
                    store=from_store,
                    quantity=quantity,
                    record_type='transfer_out',
                    reference_id=f"TR-{transfer.id}",
                    created_by=created_by,
                )

                StockRecord.objects.create(
                    product=product,
                    store=to_store,
                    quantity=quantity,
                    record_type='transfer_in',
                    reference_id=f"TR-{transfer.id}",
                    created_by=created_by,
                )

                # Update stock levels
                StockLevel.objects.filter(product=product, store=from_store).update(
                    quantity=models.F('quantity') - quantity
                )
                stock_level, created = StockLevel.objects.get_or_create(
                    product=product,
                    store=to_store,
                    batch_number=None,
                    defaults={'quantity': 0}
                )
                stock_level.quantity += quantity
                stock_level.save()

        self.stdout.write(self.style.SUCCESS("Stock transfers and items created."))
