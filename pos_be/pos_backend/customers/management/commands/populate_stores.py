from django.core.management.base import BaseCommand
from django.utils import timezone
import random
from faker import Faker
from stores.models import Store, StoreSettings
from accounts.models import User

fake = Faker('en_IN')

class Command(BaseCommand):
    help = 'Populates Store and StoreSettings with mock data'

    def add_arguments(self, parser):
        parser.add_argument('--stores', type=int, default=5, help='Number of stores to create')
        parser.add_argument('--users', type=int, default=3, help='Number of users to associate')

    def handle(self, *args, **options):
        num_stores = options['stores']
        num_users = options['users']

        users = list(User.objects.filter(is_active=True)[:num_users])
        if not users:
            self.stdout.write(self.style.ERROR("No active users found. Please create some users first."))
            return

        for i in range(num_stores):
            name = f"{fake.city()} Mart"
            store = Store.objects.create(
                name=name,
                code=f"STR{1000 + i}",
                address=fake.address(),
                city=fake.city(),
                state=fake.state(),
                pincode=fake.postcode(),
                phone=fake.phone_number(),
                email=fake.email(),
                gst_number=fake.bothify(text='??############'),
                pan_number=fake.bothify(text='?????####?'),
                opening_time=fake.time(),
                closing_time=fake.time(),
                is_main=(i == 0),
                is_active=True,
            )

            StoreSettings.objects.create(
                store=store,
                currency_symbol='₹',
                decimal_places=2,
                date_format='DD/MM/YYYY',
                theme=random.choice(['light', 'dark', 'system']),
                invoice_prefix='INV',
                invoice_start_number=random.randint(1, 100),
                invoice_footer_text='Thank you for shopping with us!',
                show_tax_in_invoice=True,
                enable_invoice_email=random.choice([True, False]),
                allow_partial_payments=True,
                enable_discount=True,
                default_tax_rate=random.choice([0, 5, 12, 18]),
                enable_round_off=True,
                printer_type='80mm',
                printer_address=None,
                enable_auto_print=True,
                enable_low_stock_alert=True,
                low_stock_threshold=10,
                enable_customer_points=True,
                points_conversion_rate=random.uniform(0.5, 2.0),
                updated_by=random.choice(users),
            )

            self.stdout.write(self.style.SUCCESS(f"Created store: {store.name} with settings."))

        self.stdout.write(self.style.SUCCESS(f"\n✅ Successfully created {num_stores} stores with settings."))
        self.stdout.write(self.style.SUCCESS(f"👤 {len(users)} users referenced as setting up user."))
