import csv
import os
from datetime import timedelta
from random import randint, choice
from django.core.management.base import BaseCommand
from django.utils import timezone
from faker import Faker
from customers.models import Customer  # Adjust if model is elsewhere
from accounts.models import User

fake = Faker('en_IN')


class Command(BaseCommand):
    help = "Generate fake customers and import into the database"

    def add_arguments(self, parser):
        parser.add_argument(
            '--count', type=int, help='Number of customers to generate'
        )

    def handle(self, *args, **options):
        count = options['count'] or int(input("How many customer records to generate? "))
        csv_path = os.path.join('media', 'fake_customers.csv')

        os.makedirs('media', exist_ok=True)

        self.stdout.write(f"📄 Generating {count} fake customers to CSV...")

        with open(csv_path, 'w', newline='') as csvfile:
            writer = csv.writer(csvfile)
            writer.writerow([
                'name', 'phone', 'email', 'address', 'city', 'state', 'pincode',
                'loyalty_points', 'total_purchases', 'last_purchase',
                'gst_number', 'pan_number', 'birthdate', 'anniversary'
            ])
            for _ in range(count):
                writer.writerow([
                    fake.name(),
                    fake.phone_number(),
                    fake.email(),
                    fake.address().replace('\n', ' '),
                    fake.city(),
                    fake.state(),
                    fake.postcode(),
                    randint(0, 500),
                    round(fake.pyfloat(left_digits=4, right_digits=2, positive=True), 2),
                    fake.date_between(start_date='-2y', end_date='today'),
                    fake.bothify(text='??#########Z'),
                    fake.bothify(text='?????#####'),
                    fake.date_of_birth(minimum_age=18, maximum_age=65),
                    fake.date_between(start_date='-10y', end_date='today'),
                ])

        self.stdout.write(self.style.SUCCESS(f"✅ CSV created: {csv_path}"))

        self.stdout.write(f"📥 Importing into Customer model...")

        # Use first superuser as creator
        creator = User.objects.filter(is_superuser=True).first()

        with open(csv_path, newline='') as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                Customer.objects.update_or_create(
                    phone=row['phone'],
                    defaults={
                        'name': row['name'],
                        'email': row['email'],
                        'address': row['address'],
                        'city': row['city'],
                        'state': row['state'],
                        'pincode': row['pincode'],
                        'loyalty_points': int(row['loyalty_points']),
                        'total_purchases': float(row['total_purchases']),
                        'last_purchase': row['last_purchase'],
                        'gst_number': row['gst_number'],
                        'pan_number': row['pan_number'],
                        'birthdate': row['birthdate'],
                        'anniversary': row['anniversary'],
                        'created_by': creator
                    }
                )

        self.stdout.write(self.style.SUCCESS("🎉 Done! All fake customers inserted."))

