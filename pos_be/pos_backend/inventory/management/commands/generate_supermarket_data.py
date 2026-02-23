from django.core.management.base import BaseCommand
from faker import Faker
from decimal import Decimal
import random
from django.utils import timezone

from inventory.models import Category, Product
from stores.models import Store, StoreSettings
from customers.models import Customer, CustomerGroup
from suppliers.models import Supplier, PurchaseOrder, PurchaseOrderItem
from sales.models import Bill, BillItem, Payment
from accounts.models import User  # Update if you use a custom user model

fake = Faker('hi_IN')

CATEGORIES = {
    "Groceries": ["Aashirvaad Atta", "Fortune Oil", "Tata Salt", "Daawat Basmati Rice"],
    "Beverages": ["Bisleri Water", "Coca-Cola", "Tropicana Juice", "Red Bull"],
    "Snacks": ["Lays Chips", "Parle-G", "Kurkure", "Haldiram Bhujia"],
    "Dairy": ["Amul Milk", "Amul Butter", "Mother Dairy Dahi", "Nestle Yogurt"],
    "Personal Care": ["Dove Soap", "Colgate Paste", "Clinic Plus Shampoo", "Dettol Liquid"]
}

SUPPLIERS = [
    "Hindustan Unilever", "ITC", "Nestle India", "PepsiCo India", "Britannia", "Parle Products", "Dabur"
]

def random_price(base=20, spread=200):
    return Decimal(random.randint(base, base + spread))

def get_or_create_user():
    return User.objects.first() or User.objects.create(username='admin')

class Command(BaseCommand):
    help = "Generate realistic Indian supermarket POS data (only new entries)"

    def handle(self, *args, **kwargs):
        user = get_or_create_user()
        self.stdout.write("📦 Generating supermarket data...")

        # Store and settings
        store, _ = Store.objects.get_or_create(
            code="SMN001",
            defaults={
                "name": "SuperMart Nanded",
                "address": fake.address(),
                "city": "Nanded",
                "state": "Maharashtra",
                "pincode": fake.postcode(),
                "phone": fake.phone_number(),
                "email": fake.email()
            }
        )
        StoreSettings.objects.get_or_create(store=store)

        # Customers
        for _ in range(50):
            Customer.objects.create(
                name=fake.name(),
                phone=fake.phone_number(),
                email=fake.email(),
                address=fake.address(),
                city=fake.city(),
                state=fake.state(),
                pincode=fake.postcode(),
                created_by=user
            )

        # Customer group
        group, _ = CustomerGroup.objects.get_or_create(
            slug="loyalty-members",
            defaults={
                "name": "Loyalty Members",
                "description": "Repeat customers with benefits",
                "special_discount": Decimal("5.00"),
                "created_by": user
            }
        )
        group.customers.set(Customer.objects.all())

        # Suppliers
        supplier_objs = []
        for name in SUPPLIERS:
            s, _ = Supplier.objects.get_or_create(
                name=name,
                defaults={
                    "phone": fake.phone_number(),
                    "email": fake.company_email(),
                    "address": fake.address(),
                    "city": fake.city(),
                    "state": fake.state(),
                    "pincode": fake.postcode(),
                    "created_by": user
                }
            )
            supplier_objs.append(s)

        # Categories and products
        product_objs = []
        for category_name, product_names in CATEGORIES.items():
            cat, _ = Category.objects.get_or_create(name=category_name, slug=category_name.lower().replace(" ", "-"))
            for prod_name in product_names:
                p = Product.objects.create(
                    name=prod_name,
                    barcode=fake.unique.ean(length=13),
                    category=cat,
                    price=random_price(),
                    cost_price=random_price(10, 100),
                    tax=random.choice([5, 12, 18]),
                    unit='pcs',
                    is_active=True
                )
                product_objs.append(p)

        # Purchase Orders
        for _ in range(10):
            while True:
                po_number = fake.lexify(text="PO####")
                if not PurchaseOrder.objects.filter(po_number=po_number).exists():
                    break

            po = PurchaseOrder.objects.create(
                po_number=po_number,
                supplier=random.choice(supplier_objs),
                store=store,
                created_by=user,
                status='sent'
            )
            total = Decimal('0.00')
            for _ in range(random.randint(3, 6)):
                product = random.choice(product_objs)
                qty = Decimal(random.randint(10, 100))
                unit_price = product.cost_price
                discount_pct = Decimal(random.choice([0, 5, 10]))
                base = unit_price * qty
                discount_amt = base * (discount_pct / Decimal('100'))
                taxed_amt = (base - discount_amt) * (Decimal(product.tax) / Decimal('100'))
                final = base - discount_amt + taxed_amt

                PurchaseOrderItem.objects.create(
                    purchase_order=po,
                    product=product,
                    quantity_ordered=qty,
                    unit_price=unit_price,
                    tax_rate=Decimal(product.tax),
                    tax_amount=taxed_amt,
                    discount_percentage=discount_pct,
                    discount_amount=discount_amt,
                    total=final
                )
                total += final
            po.total = total
            po.save()

        # Bills
        customers = list(Customer.objects.all())
        for _ in range(30):
            while True:
                bill_number = fake.lexify(text="BILL####")
                if not Bill.objects.filter(bill_number=bill_number).exists():
                    break

            bill = Bill.objects.create(
                bill_number=bill_number,
                store=store,
                customer=random.choice(customers),
                cashier=user,
                status='completed',
                payment_status='paid',
                total=0,
                created_at=timezone.now()
            )
            total = Decimal('0.00')
            for _ in range(random.randint(2, 4)):
                product = random.choice(product_objs)
                qty = Decimal(random.randint(1, 5))
                price = product.price
                discount_pct = Decimal(random.choice([0, 5]))
                base = price * qty
                discount_amt = base * (discount_pct / Decimal('100'))
                tax_amt = (base - discount_amt) * (Decimal(product.tax) / Decimal('100'))
                final = base - discount_amt + tax_amt

                BillItem.objects.create(
                    bill=bill,
                    product=product,
                    quantity=qty,
                    price=price,
                    tax_rate=Decimal(product.tax),
                    tax_amount=tax_amt,
                    discount_rate=discount_pct,
                    discount_amount=discount_amt,
                    total=final
                )
                total += final
            bill.total = total
            bill.save()

            Payment.objects.create(
                bill=bill,
                amount=total,
                payment_method=random.choice(['cash', 'upi', 'card']),
                status='completed',
                created_by=user
            )

        self.stdout.write(self.style.SUCCESS("✅ Mock POS data generated successfully!"))
