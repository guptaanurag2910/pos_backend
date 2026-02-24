from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('suppliers', '0006_alter_supplierinvoice_options_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='goodsreceiptnote',
            name='is_active',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='supplierinvoice',
            name='is_active',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='supplierpayment',
            name='is_active',
            field=models.BooleanField(default=True),
        ),
    ]

