# utils/import_inventory.py
import pandas as pd
from django.utils.text import slugify
from .models import Category, Product, StockLevel
from stores.models import Store


def import_inventory_xlsx(file_path):
    df = pd.read_excel(file_path)

    for index, row in df.iterrows():
        # Handle categories
        parent = None
        for level in ['category', 'sub_category', 'sub_sub_category']:
            if pd.notna(row[level]):
                category, created = Category.objects.get_or_create(
                    name=row[level].strip(),
                    parent=parent,
                    defaults={
                        'slug': slugify(row[level].strip()),
                        'description': row.get('category_description', ''),
                        'is_active': str(row.get('category_is_active', 'TRUE')).upper() == 'TRUE'
                    }
                )
                parent = category
        category = parent

        # Handle product
        product, _ = Product.objects.get_or_create(
            barcode=str(row['barcode']).strip(),
            defaults={
                'name': row['product_name'],
                'category': category,
                'description': row.get('product_description', ''),
                'slug': slugify(row['product_slug_name']),
                'price': row['mrp'],
                'cost_price': row['cost_price'],
                'discount_price': row.get('rate', None),
                'tax': int(row.get('tax', 0)),
                'hsn_code': str(row.get('hsn_code', '')) if pd.notna(row.get('hsn_code')) else '',
                'unit': row.get('unit', 'piece'),
                'weight': row.get('weight', None),
                'is_active': True,
                'is_featured': str(row.get('is_featured', 'FALSE')).upper() == 'TRUE',
                'is_service': str(row.get('is_service', 'FALSE')).upper() == 'TRUE',
                'image': row.get('image_url', None),
            }
        )

        # Handle stock level
        try:
            store = Store.objects.get(code=row['store_code'])
        except Store.DoesNotExist:
            continue

        expiry = pd.to_datetime(row['expiry_date']).date() if pd.notna(row['expiry_date']) else None

        StockLevel.objects.update_or_create(
            product=product,
            store=store,
            batch_number=row.get('batch_number', None),
            defaults={
                'quantity': row.get('quantity', 0),
                'min_stock': row.get('min_stock', 0),
                'max_stock': row.get('max_stock', None),
                'expiry_date': expiry,
            }
        )
