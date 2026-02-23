import random
from decimal import Decimal, ROUND_HALF_UP

from django.core.management.base import BaseCommand
from inventory.models import Product  # adjust app name as needed


class Command(BaseCommand):
    help = 'Fills missing discount_price, tax, and hsn_code for all products'

    def handle(self, *args, **kwargs):
        updated_count = 0

        for product in Product.objects.all():
            updated = False

            # Fill discount_price: 10% to 30% off
            if not product.discount_price:
                discount_percentage = random.randint(10, 30)
                discount_amount = product.price * Decimal(discount_percentage / 100)
                product.discount_price = (product.price - discount_amount).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                updated = True

            # Fill tax if missing or 0
            if not product.tax:
                product.tax = random.choice([5, 12, 18, 28])
                updated = True

            # Fill HSN code if empty
            if not product.hsn_code:
                product.hsn_code = str(random.randint(100100, 999999))
                updated = True

            if updated:
                product.save()
                updated_count += 1
                self.stdout.write(f"Updated: {product.name} (ID: {product.id})")

        self.stdout.write(self.style.SUCCESS(f"✅ Updated {updated_count} product(s)"))
