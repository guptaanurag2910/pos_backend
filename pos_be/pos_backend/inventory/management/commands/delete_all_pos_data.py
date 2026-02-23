from django.core.management.base import BaseCommand
from django.db import transaction

from inventory.models import Category, Product
from stores.models import Store, StoreSettings
from customers.models import Customer, CustomerGroup
from suppliers.models import Supplier, PurchaseOrder, PurchaseOrderItem
from sales.models import Bill, BillItem, Payment
from accounts.models import User  # Optional: only delete test users if needed

class Command(BaseCommand):
    help = "⚠️ Delete ALL POS-related data (inventory, sales, suppliers, stores, customers)"

    def handle(self, *args, **kwargs):
        confirm = input("⚠️ Are you sure you want to DELETE ALL POS-related data? Type 'yes' to continue: ").strip().lower()
        if confirm != 'yes':
            self.stdout.write(self.style.ERROR("❌ Operation cancelled."))
            return

        try:
            with transaction.atomic():
                self.stdout.write("🧹 Deleting data in safe order...")

                Payment.objects.all().delete()
                BillItem.objects.all().delete()
                Bill.objects.all().delete()

                PurchaseOrderItem.objects.all().delete()
                PurchaseOrder.objects.all().delete()

                CustomerGroup.objects.all().delete()
                Customer.objects.all().delete()

                Supplier.objects.all().delete()

                Product.objects.all().delete()
                Category.objects.all().delete()

                StoreSettings.objects.all().delete()
                Store.objects.all().delete()

                # Optionally delete only fake test users (uncomment if needed)
                # User.objects.exclude(is_superuser=True).delete()

                self.stdout.write(self.style.SUCCESS("✅ All POS-related data deleted successfully!"))
        except Exception as e:
            self.stderr.write(self.style.ERROR(f"❌ Failed to delete data: {e}"))
