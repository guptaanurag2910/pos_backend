from django.core.management.base import BaseCommand
from django.utils import timezone
from decimal import Decimal
import random
from faker import Faker
from inventory.models import Product
from suppliers.models import Supplier, PurchaseOrder, PurchaseOrderItem, GoodsReceiptNote, GoodsReceiptNoteItem, SupplierPayment
from stores.models import Store
from accounts.models import User

fake = Faker()

class Command(BaseCommand):
    help = 'Populates suppliers, purchase orders, GRNs, and payments for testing'

    def handle(self, *args, **kwargs):
        user = User.objects.first()
        store = Store.objects.first()
        products = list(Product.objects.all()[:10])

        if not user or not store or not products:
            self.stdout.write(self.style.ERROR("🚫 Missing required data: user, store, or products."))
            return

        for _ in range(5):
            supplier = Supplier.objects.create(
                name=fake.company(),
                contact_person=fake.name(),
                phone=fake.phone_number()[:15],
                email=fake.email(),
                address=fake.address(),
                city=fake.city(),
                state=fake.state(),
                pincode=fake.postcode()[:10],
                gst_number=fake.bothify(text='??######??#'),
                pan_number=fake.bothify(text='?????####?'),
                credit_period=random.choice([15, 30, 45]),
                credit_limit=Decimal(random.uniform(50000, 200000)),
                current_balance=Decimal(random.uniform(0, 50000)),
                notes=fake.sentence(),
                created_by=user
            )

            # Purchase Order
            po = PurchaseOrder.objects.create(
                po_number=fake.unique.bothify(text='PO#####'),
                supplier=supplier,
                store=store,
                order_date=timezone.now(),
                expected_delivery_date=timezone.now() + timezone.timedelta(days=7),
                status='sent',
                payment_status='pending',
                shipping_charges=Decimal('500.00'),
                created_by=user,
            )

            for _ in range(random.randint(2, 5)):
                product = random.choice(products)
                quantity = random.randint(1, 10)
                unit_price = Decimal(random.uniform(50, 500))
                discount = Decimal(random.uniform(0, 10))
                tax = Decimal(random.uniform(5, 18))

                PurchaseOrderItem.objects.create(
                    purchase_order=po,
                    product=product,
                    quantity_ordered=quantity,
                    unit_price=unit_price,
                    discount_percentage=discount,
                    tax_rate=tax,
                )

            po.calculate_totals()

            # GRN
            grn = GoodsReceiptNote.objects.create(
                grn_number=fake.unique.bothify(text='GRN#####'),
                purchase_order=po,
                supplier=supplier,
                store=store,
                receipt_date=timezone.now(),
                invoice_number=fake.bothify(text='INV#####'),
                invoice_date=timezone.now(),
                status='completed',
                shipping_charges=Decimal('300.00'),
                created_by=user,
            )

            for item in po.items.all():
                GoodsReceiptNoteItem.objects.create(
                    grn=grn,
                    product=item.product,
                    quantity=item.quantity_ordered,
                    unit_price=item.unit_price,
                    tax_rate=item.tax_rate,
                    discount_percentage=item.discount_percentage,
                )

            grn.calculate_totals()

            # Payment
            SupplierPayment.objects.create(
                supplier=supplier,
                purchase_order=po,
                amount=grn.total,
                payment_method='upi',
                reference_number=fake.uuid4(),
                payment_date=timezone.now(),
                status='completed',
                created_by=user,
            )

        self.stdout.write(self.style.SUCCESS('✅ Dummy supplier-related data populated successfully.'))
