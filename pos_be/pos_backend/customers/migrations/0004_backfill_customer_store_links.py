from django.db import migrations


def backfill_customer_store_links(apps, schema_editor):
    CustomerStoreLink = apps.get_model('customers', 'CustomerStoreLink')
    Bill = apps.get_model('sales', 'Bill')
    Customer = apps.get_model('customers', 'Customer')

    # Link from actual purchases (authoritative source for store-customer relationship)
    for bill in Bill.objects.exclude(customer__isnull=True).exclude(store__isnull=True).only('customer_id', 'store_id', 'cashier_id'):
        CustomerStoreLink.objects.update_or_create(
            customer_id=bill.customer_id,
            store_id=bill.store_id,
            defaults={
                'is_active': True,
                'created_by_id': bill.cashier_id,
            }
        )

    # Fallback link using customer creator's store when no bill link exists yet
    for customer in Customer.objects.exclude(created_by__isnull=True).exclude(created_by__store__isnull=True).only('id', 'created_by_id'):
        if CustomerStoreLink.objects.filter(customer_id=customer.id).exists():
            continue
        creator = customer.created_by
        CustomerStoreLink.objects.update_or_create(
            customer_id=customer.id,
            store_id=creator.store_id,
            defaults={
                'is_active': True,
                'created_by_id': customer.created_by_id,
            }
        )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('sales', '0003_alter_payment_payment_method'),
        ('customers', '0003_customerstorelink'),
    ]

    operations = [
        migrations.RunPython(backfill_customer_store_links, noop_reverse),
    ]
