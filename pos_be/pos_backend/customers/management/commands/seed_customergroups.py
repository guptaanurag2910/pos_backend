import random
from django.core.management.base import BaseCommand
from faker import Faker
from customers.models import CustomerGroup, Customer
from accounts.models import User
from django.utils.text import slugify

fake = Faker()

class Command(BaseCommand):
    help = "Generate fake customer groups and assign customers to them"

    def add_arguments(self, parser):
        parser.add_argument('--count', type=int, help='Number of customer groups to create')

    def handle(self, *args, **options):
        count = options['count'] or int(input("How many customer groups to generate? "))
        customers = list(Customer.objects.all())

        if not customers:
            self.stderr.write("❌ No customers found. Please add customers first.")
            return

        creator = User.objects.filter(is_superuser=True).first()
        if not creator:
            self.stderr.write("❌ No superuser found. Cannot set created_by.")
            return

        for i in range(count):
            group_name = f"{fake.word().capitalize()} Group {i + 1}"
            description = fake.sentence(nb_words=10)
            discount = round(random.uniform(5, 25), 2)

            group = CustomerGroup.objects.create(
                name=group_name,
                slug=slugify(group_name),
                description=description,
                special_discount=discount,
                is_active=True,
                created_by=creator
            )

            # Randomly assign 5 to 15 customers to the group
            group_customers = random.sample(customers, k=min(len(customers), random.randint(5, 15)))
            group.customers.set(group_customers)

            self.stdout.write(self.style.SUCCESS(f"✅ Created group '{group.name}' with {len(group_customers)} customers."))

        self.stdout.write(self.style.SUCCESS("🎉 Done! All groups created."))

