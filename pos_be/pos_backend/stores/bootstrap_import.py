from datetime import datetime
from decimal import Decimal

import pandas as pd
from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify

from customers.models import Customer
from inventory.models import Category, Product, StockLevel
from sales.models import Bill, BillItem, Payment


class StoreBootstrapImporter:
    """
    Imports store bootstrap data from a single Excel workbook.

    Supported sheet names (case-insensitive):
    - inventory
    - customers
    - sales
    - sales_items (optional)
    - payments (optional)
    """

    def __init__(self, store, user, strict=True):
        self.store = store
        self.user = user
        self.strict = strict
        self.stats = {
            'inventory': {'processed': 0, 'created': 0, 'updated': 0, 'failed': 0},
            'customers': {'processed': 0, 'created': 0, 'updated': 0, 'failed': 0},
            'sales': {'processed': 0, 'created': 0, 'updated': 0, 'failed': 0},
            'sales_items': {'processed': 0, 'created': 0, 'updated': 0, 'failed': 0},
            'payments': {'processed': 0, 'created': 0, 'updated': 0, 'failed': 0},
        }
        self.errors = []

    @staticmethod
    def _norm_cols(df):
        df.columns = [str(c).strip().lower().replace(' ', '_') for c in df.columns]
        return df

    @staticmethod
    def _clean(v):
        if pd.isna(v):
            return None
        if isinstance(v, str):
            v = v.strip()
            return v if v else None
        return v

    @staticmethod
    def _as_decimal(v, default='0'):
        if v is None or pd.isna(v):
            return Decimal(default)
        return Decimal(str(v))

    @staticmethod
    def _as_bool(v, default=False):
        if v is None or pd.isna(v):
            return default
        return str(v).strip().lower() in {'1', 'true', 'yes', 'y'}

    @staticmethod
    def _as_date(v):
        if v is None or pd.isna(v):
            return None
        if isinstance(v, datetime):
            return v.date()
        return pd.to_datetime(v).date()

    def _fail_or_continue(self, section, row_idx, exc):
        self.stats[section]['failed'] += 1
        self.errors.append({'section': section, 'row': int(row_idx) + 2, 'error': str(exc)})
        if self.strict:
            raise

    def _get_sheet(self, book, name):
        for sheet_name in book.sheet_names:
            if sheet_name.strip().lower() == name:
                return self._norm_cols(pd.read_excel(book, sheet_name=sheet_name))
        return None

    def import_inventory(self, df):
        if df is None:
            return

        for idx, row in df.iterrows():
            self.stats['inventory']['processed'] += 1
            try:
                name = self._clean(row.get('product_name') or row.get('name'))
                barcode = self._clean(row.get('barcode'))
                if not name or not barcode:
                    raise ValueError('inventory requires product_name/name and barcode')

                category_name = self._clean(row.get('category'))
                sub_category_name = self._clean(row.get('sub_category'))
                category = None
                if category_name:
                    category, _ = Category.objects.get_or_create(
                        name=category_name,
                        parent=None,
                        defaults={'slug': slugify(category_name), 'is_active': True}
                    )
                if sub_category_name:
                    category, _ = Category.objects.get_or_create(
                        name=sub_category_name,
                        parent=category,
                        defaults={'slug': slugify(sub_category_name), 'is_active': True}
                    )

                product_defaults = {
                    'name': name,
                    'category': category,
                    'description': self._clean(row.get('description')),
                    'price': self._as_decimal(row.get('price') or row.get('mrp')),
                    'cost_price': self._as_decimal(row.get('cost_price') or row.get('cost')),
                    'discount_price': self._as_decimal(row.get('discount_price')) if self._clean(row.get('discount_price')) is not None else None,
                    'tax': int(row.get('tax') or 0),
                    'hsn_code': self._clean(row.get('hsn_code')),
                    'unit': self._clean(row.get('unit')) or 'piece',
                    'weight': self._as_decimal(row.get('weight')) if self._clean(row.get('weight')) is not None else None,
                    'is_active': self._as_bool(row.get('is_active'), default=True),
                    'is_featured': self._as_bool(row.get('is_featured')),
                    'is_service': self._as_bool(row.get('is_service')),
                }

                product, created = Product.objects.update_or_create(
                    barcode=str(barcode),
                    defaults=product_defaults,
                )

                batch_number = self._clean(row.get('batch_number'))
                expiry_date = self._as_date(row.get('expiry_date'))

                stock_defaults = {
                    'quantity': self._as_decimal(row.get('quantity')),
                    'min_stock': self._as_decimal(row.get('min_stock')),
                    'max_stock': self._as_decimal(row.get('max_stock')) if self._clean(row.get('max_stock')) is not None else None,
                    'expiry_date': expiry_date,
                }

                stock_obj, stock_created = StockLevel.objects.update_or_create(
                    product=product,
                    store=self.store,
                    batch_number=batch_number,
                    defaults=stock_defaults,
                )

                if created or stock_created:
                    self.stats['inventory']['created'] += 1
                else:
                    self.stats['inventory']['updated'] += 1

            except Exception as exc:  # noqa: BLE001
                self._fail_or_continue('inventory', idx, exc)

    def import_customers(self, df):
        if df is None:
            return

        for idx, row in df.iterrows():
            self.stats['customers']['processed'] += 1
            try:
                phone_raw = self._clean(row.get('phone'))
                name = self._clean(row.get('name'))
                if not phone_raw or not name:
                    raise ValueError('customers requires name and phone')

                phone = ''.join(ch for ch in str(phone_raw) if ch.isdigit())
                if not phone:
                    raise ValueError('invalid phone')

                defaults = {
                    'name': name,
                    'email': self._clean(row.get('email')),
                    'address': self._clean(row.get('address')),
                    'city': self._clean(row.get('city')),
                    'state': self._clean(row.get('state')),
                    'pincode': self._clean(row.get('pincode')),
                    'loyalty_points': int(row.get('loyalty_points') or 0),
                    'total_purchases': self._as_decimal(row.get('total_purchases')),
                    'last_purchase': self._as_date(row.get('last_purchase')),
                    'gst_number': self._clean(row.get('gst_number')),
                    'pan_number': self._clean(row.get('pan_number')),
                    'birthdate': self._as_date(row.get('birthdate')),
                    'anniversary': self._as_date(row.get('anniversary')),
                    'notes': self._clean(row.get('notes')),
                    'created_by': self.user,
                }

                _, created = Customer.objects.update_or_create(
                    phone=phone,
                    defaults=defaults,
                )

                if created:
                    self.stats['customers']['created'] += 1
                else:
                    self.stats['customers']['updated'] += 1

            except Exception as exc:  # noqa: BLE001
                self._fail_or_continue('customers', idx, exc)

    def _get_customer_for_sale(self, row):
        customer_phone = self._clean(row.get('customer_phone'))
        customer_id = self._clean(row.get('customer_id'))
        if customer_id:
            try:
                return Customer.objects.get(id=customer_id)
            except Customer.DoesNotExist:
                return None
        if customer_phone:
            phone = ''.join(ch for ch in str(customer_phone) if ch.isdigit())
            return Customer.objects.filter(phone=phone).first()
        return None

    def _generate_bill_number(self):
        date_part = timezone.now().strftime('%Y%m%d')
        last_bill = Bill.objects.filter(store=self.store).order_by('-id').first()
        next_seq = 1
        if last_bill and last_bill.bill_number:
            try:
                next_seq = int(str(last_bill.bill_number).split('-')[-1]) + 1
            except Exception:  # noqa: BLE001
                next_seq = (Bill.objects.filter(store=self.store).count() + 1)
        return f"{self.store.code}-{date_part}-{next_seq:03d}"

    def import_sales(self, sales_df, sales_items_df=None, payments_df=None):
        if sales_df is None:
            return

        items_by_bill = {}
        if sales_items_df is not None:
            for idx, row in sales_items_df.iterrows():
                key = self._clean(row.get('bill_number') or row.get('invoice_number') or row.get('external_bill_id'))
                if not key:
                    continue
                items_by_bill.setdefault(str(key), []).append((idx, row))

        payments_by_bill = {}
        if payments_df is not None:
            for idx, row in payments_df.iterrows():
                key = self._clean(row.get('bill_number') or row.get('invoice_number') or row.get('external_bill_id'))
                if not key:
                    continue
                payments_by_bill.setdefault(str(key), []).append((idx, row))

        for idx, row in sales_df.iterrows():
            self.stats['sales']['processed'] += 1
            try:
                bill_number = self._clean(row.get('bill_number') or row.get('invoice_number') or row.get('external_bill_id'))
                if not bill_number:
                    bill_number = self._generate_bill_number()

                bill_defaults = {
                    'invoice_number': self._clean(row.get('invoice_number')),
                    'customer': self._get_customer_for_sale(row),
                    'store': self.store,
                    'cashier': self.user,
                    'subtotal': self._as_decimal(row.get('subtotal')),
                    'tax_total': self._as_decimal(row.get('tax_total')),
                    'discount': self._as_decimal(row.get('discount')),
                    'round_off': self._as_decimal(row.get('round_off')),
                    'total': self._as_decimal(row.get('total')),
                    'payment_status': self._clean(row.get('payment_status')) or 'paid',
                    'payment_method': self._clean(row.get('payment_method')),
                    'status': self._clean(row.get('status')) or 'completed',
                    'notes': self._clean(row.get('notes')),
                    'completed_at': pd.to_datetime(row.get('completed_at')).to_pydatetime() if self._clean(row.get('completed_at')) else timezone.now(),
                }

                bill, created = Bill.objects.update_or_create(
                    bill_number=str(bill_number),
                    defaults=bill_defaults,
                )

                if created:
                    self.stats['sales']['created'] += 1
                else:
                    self.stats['sales']['updated'] += 1

                line_items = items_by_bill.get(str(bill_number), [])
                if line_items:
                    BillItem.objects.filter(bill=bill).delete()

                for item_idx, item_row in line_items:
                    self.stats['sales_items']['processed'] += 1
                    try:
                        barcode = self._clean(item_row.get('product_barcode') or item_row.get('barcode'))
                        product_name = self._clean(item_row.get('product_name') or item_row.get('name'))
                        product = None
                        if barcode:
                            product = Product.objects.filter(barcode=str(barcode)).first()
                        if not product and product_name:
                            product = Product.objects.filter(name=product_name).first()
                        if not product:
                            raise ValueError('sales_items product not found by barcode/name')

                        BillItem.objects.create(
                            bill=bill,
                            product=product,
                            quantity=self._as_decimal(item_row.get('quantity')),
                            price=self._as_decimal(item_row.get('price') or item_row.get('unit_price') or product.price),
                            tax_rate=self._as_decimal(item_row.get('tax_rate') or product.tax),
                            discount_rate=self._as_decimal(item_row.get('discount_rate')),
                            total=self._as_decimal(item_row.get('total')),
                        )
                        self.stats['sales_items']['created'] += 1
                    except Exception as exc:  # noqa: BLE001
                        self._fail_or_continue('sales_items', item_idx, exc)

                payment_rows = payments_by_bill.get(str(bill_number), [])
                if payment_rows:
                    Payment.objects.filter(bill=bill).delete()

                for pay_idx, pay_row in payment_rows:
                    self.stats['payments']['processed'] += 1
                    try:
                        Payment.objects.create(
                            bill=bill,
                            amount=self._as_decimal(pay_row.get('amount') or bill.total),
                            payment_method=self._clean(pay_row.get('payment_method')) or (bill.payment_method or 'cash'),
                            transaction_id=self._clean(pay_row.get('transaction_id')),
                            payment_details=None,
                            status=self._clean(pay_row.get('status')) or 'completed',
                            created_by=self.user,
                        )
                        self.stats['payments']['created'] += 1
                    except Exception as exc:  # noqa: BLE001
                        self._fail_or_continue('payments', pay_idx, exc)

                if line_items and self._clean(row.get('recalculate_totals')) in {None, True, 'true', '1', 1}:
                    bill.calculate_totals()
                    bill.save(update_fields=['subtotal', 'tax_total', 'round_off', 'total', 'updated_at'])

            except Exception as exc:  # noqa: BLE001
                self._fail_or_continue('sales', idx, exc)

    def run(self, excel_file):
        book = pd.ExcelFile(excel_file)
        inventory_df = self._get_sheet(book, 'inventory')
        customers_df = self._get_sheet(book, 'customers')
        sales_df = self._get_sheet(book, 'sales')
        sales_items_df = self._get_sheet(book, 'sales_items')
        payments_df = self._get_sheet(book, 'payments')

        if not any([inventory_df is not None, customers_df is not None, sales_df is not None]):
            raise ValueError('No supported sheets found. Required at least one of: inventory, customers, sales')

        with transaction.atomic():
            self.import_inventory(inventory_df)
            self.import_customers(customers_df)
            self.import_sales(sales_df, sales_items_df=sales_items_df, payments_df=payments_df)

            if self.strict and self.errors:
                raise ValueError('Import failed in strict mode. Fix sheet data and retry.')

        return {
            'store_id': self.store.id,
            'strict_mode': self.strict,
            'stats': self.stats,
            'errors': self.errors,
            'sheets_found': {
                'inventory': inventory_df is not None,
                'customers': customers_df is not None,
                'sales': sales_df is not None,
                'sales_items': sales_items_df is not None,
                'payments': payments_df is not None,
            },
        }
