from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('return', '0002_alter_return_options_return_is_active_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='return',
            name='return_date',
            field=models.DateField(default=django.utils.timezone.localdate),
        ),
    ]

