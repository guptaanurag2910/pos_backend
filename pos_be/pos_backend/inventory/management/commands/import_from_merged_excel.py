import os
import pandas as pd
import requests
from django.core.management.base import BaseCommand
from django.core.files.base import ContentFile
from django.utils.text import slugify
from django.conf import settings
from inventory.models import Category, Product  # Adjust to your actual app name


class Command(BaseCommand):
    help = 'Import products and categories from merged_product_data.xlsx (first 10 rows only)'

    def add_arguments(self, parser):
        parser.add_argument('excel_path', type=str, help='Path to merged_product_data.xlsx')

    def handle(self, *args, **kwargs):
        path = kwargs['excel_path']
        df = pd.read_excel(path).iloc[3917:]
        total = len(df)

        # Ensure media/products directory exists
        os.makedirs(os.path.join(settings.MEDIA_ROOT, 'products'), exist_ok=True)

        self.stdout.write(self.style.SUCCESS(f"📦 Starting import of {total} rows from {path}"))

        for index, row in df.iterrows():
            try:
                self.stdout.write(f"\n➡️ Processing row {index + 1}/{total} - {row['SKU Name']}")

                # Category hierarchy
                cat1 = self.get_or_create_category(row['Category'])
                cat2 = self.get_or_create_category(row['Sub-Category'], parent=cat1)
                cat3 = self.get_or_create_category(row['Sub-sub-Category'], parent=cat2)

                # Parse weight from SKU Size
                unit = str(row.get('SKU Size', 'piece'))
                weight = self.parse_weight(unit)

                # Create Product
                product, created = Product.objects.get_or_create(
                    barcode=str(row['EAN Code']),
                    defaults={
                        'name': row['SKU Name'],
                        'category': cat3,
                        'description': row.get('About the Product', ''),
                        'price': self.parse_price(row.get('MRP')),
                        'cost_price': self.parse_price(row.get('MRP')),
                        'unit': unit,
                        'weight': weight,
                        'tax': 0,
                        'is_active': True
                    }
                )

                if created:
                    self.stdout.write(self.style.SUCCESS(f"✅ Created product: {product.name}"))
                else:
                    self.stdout.write(self.style.WARNING(f"⚠️ Product already exists: {product.name}"))

                # Image download with user-agent to prevent 403
                image_url = row.get('Image Link')
                if image_url and not product.image:
                    try:
                        self.stdout.write(f"🌐 Downloading image from: {image_url}")
                        headers = {'User-Agent': 'Mozilla/5.0'}
                        img_response = requests.get(image_url, headers=headers, timeout=10)
                        if img_response.status_code == 200:
                            img_name = f"{product.barcode}.jpg"
                            product.image.save(img_name, ContentFile(img_response.content), save=True)
                            self.stdout.write(self.style.SUCCESS(f"🖼️  Image saved: {product.image.path}"))
                        else:
                            self.stderr.write(f"⚠️ Image failed with status {img_response.status_code} for {product.name}")
                    except Exception as e:
                        self.stderr.write(f"❌ Image error for {product.name}: {e}")

            except Exception as e:
                self.stderr.write(f"❌ Error processing row {index + 1}: {e}")

        self.stdout.write(self.style.SUCCESS("\n🎉 Import completed!"))

    def get_or_create_category(self, name, parent=None):
        if not name or pd.isna(name):
            return None
        obj, created = Category.objects.get_or_create(
            name=name.strip(),
            parent=parent,
            defaults={'slug': slugify(name), 'is_active': True}
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f"📁 Created category: {obj.name}"))
        return obj

    def parse_price(self, value):
        try:
            if pd.isna(value):
                return 0.0
            return float(str(value).replace('₹', '').replace(',', '').strip())
        except:
            return 0.0

    def parse_weight(self, unit):
        try:
            unit_clean = unit.lower().strip()
            if 'kg' in unit_clean:
                return float(unit_clean.replace('kg', '').strip())
            elif 'g' in unit_clean:
                return float(unit_clean.replace('g', '').strip()) / 1000
            elif 'l' in unit_clean:
                return float(unit_clean.replace('l', '').strip())
            elif 'ml' in unit_clean:
                return float(unit_clean.replace('ml', '').strip()) / 1000
        except:
            pass
        return None
