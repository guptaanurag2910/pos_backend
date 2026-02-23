from django.core.management.base import BaseCommand
from django.utils import timezone
import random
from decimal import Decimal

from customers.models import Customer
from stores.models import Store
from accounts.models import User
from inventory.models import Product
from sales.models import Bill, BillItem, Payment  # Adjust if your app names are different


class Command(BaseCommand):
    help = 'Populate bills, items, and payments with dummy data'

    def handle(self, *args, **options):
        customers = list(Customer.objects.all())
        stores = list(Store.objects.all())
        cashiers = list(User.objects.filter(role='cashier'))
        products = list(Product.objects.filter(is_active=True))

        if not (customers and stores and cashiers and products):
            self.stdout.write(self.style.ERROR(
                "Ensure customers, stores, users with role='cashier', and products exist."
            ))
            return

        for i in range(10):  # Generate 10 bills
            store = random.choice(stores)
            customer = random.choice(customers)
            cashier = random.choice(cashiers)

            bill = Bill.objects.create(
                bill_number=f"BILL{i+1000}",
                invoice_number=f"INV{i+1000}",
                customer=customer,
                store=store,
                cashier=cashier,
                status='draft',
                payment_status='pending',
            )

            subtotal = Decimal('0')
            tax_total = Decimal('0')
            discount_total = Decimal('0')

            for _ in range(random.randint(1, 5)):  # 1–5 items
                product = random.choice(products)
                quantity = Decimal(random.randint(1, 3))

                # Use discounted price if set
                price = product.discount_price if product.discount_price else product.price
                tax_rate = Decimal(product.tax)
                discount_rate = Decimal(random.choice([0, 5, 10]))

                item = BillItem.objects.create(
                    bill=bill,
                    product=product,
                    quantity=quantity,
                    price=price,
                    tax_rate=tax_rate,
                    discount_rate=discount_rate,
                )

                subtotal += price * quantity
                tax_total += item.tax_amount
                discount_total += item.discount_amount

            bill.subtotal = subtotal
            bill.tax_total = tax_total
            bill.discount = discount_total

            discounted_total = subtotal + tax_total - discount_total
            if discounted_total % 1 < 0.5:
                round_off = -discounted_total % 1
            else:
                round_off = 1 - discounted_total % 1

            bill.round_off = round_off
            bill.total = discounted_total + round_off

            bill.complete(payment_method=random.choice(['cash', 'card', 'upi', 'wallet', 'sodexo']))

            Payment.objects.create(
                bill=bill,
                amount=bill.total,
                payment_method=bill.payment_method,
                status='completed',
                created_by=cashier,
                transaction_id=f"TXN{random.randint(100000, 999999)}",
                payment_details={"info": "Auto-generated mock payment"}
            )

            self.stdout.write(self.style.SUCCESS(f"Created Bill {bill.bill_number} with total ₹{bill.total}"))

