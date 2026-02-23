from datetime import datetime, timedelta
from decimal import Decimal
from io import BytesIO
from pathlib import Path
from posixpath import dirname as posix_dirname
from posixpath import join as posix_join, normpath as posix_normpath
from zipfile import ZipFile
from xml.etree import ElementTree as ET

import pandas as pd
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify

from customers.models import Customer
from inventory.models import Category, Product, StockLevel
from sales.models import Bill, BillItem, Payment
from suppliers.models import (
    GoodsReceiptNote,
    GoodsReceiptNoteItem,
    PurchaseOrder,
    PurchaseOrderItem,
    Supplier,
    SupplierInvoice,
    SupplierInvoiceItem,
    SupplierPayment,
)


class StoreBootstrapImporter:
    """
    Imports store bootstrap data from a single Excel workbook.

    Supported sheet names (case-insensitive):
    - inventory
    - customers
    - sales
    - sales_items (optional)
    - payments (optional)
    - suppliers (optional)
    - purchase_orders (optional)
    - purchase_order_items (optional)
    - grn (optional)
    - grn_items (optional)
    - supplier_invoices (optional)
    - supplier_invoice_items (optional)
    - supplier_payments (optional)
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
            'suppliers': {'processed': 0, 'created': 0, 'updated': 0, 'failed': 0},
            'purchase_orders': {'processed': 0, 'created': 0, 'updated': 0, 'failed': 0},
            'purchase_order_items': {'processed': 0, 'created': 0, 'updated': 0, 'failed': 0},
            'grn': {'processed': 0, 'created': 0, 'updated': 0, 'failed': 0},
            'grn_items': {'processed': 0, 'created': 0, 'updated': 0, 'failed': 0},
            'supplier_invoices': {'processed': 0, 'created': 0, 'updated': 0, 'failed': 0},
            'supplier_invoice_items': {'processed': 0, 'created': 0, 'updated': 0, 'failed': 0},
            'supplier_payments': {'processed': 0, 'created': 0, 'updated': 0, 'failed': 0},
        }
        self.errors = []
        self.warnings = []
        self.inventory_images_by_row = {}

    NS_MAIN = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    NS_REL = {'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
    NS_PKG_REL = {'pr': 'http://schemas.openxmlformats.org/package/2006/relationships'}
    NS_DRAWING = {'xdr': 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing'}
    NS_DRAWING_REL = {'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'}

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
    def _as_int(v, default=0):
        if v is None or pd.isna(v):
            return default
        try:
            return int(Decimal(str(v)))
        except Exception:  # noqa: BLE001
            return default

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

    @staticmethod
    def _as_datetime(v):
        if v is None or pd.isna(v):
            return None
        if isinstance(v, datetime):
            return v
        return pd.to_datetime(v).to_pydatetime()

    def _fail_or_continue(self, section, row_idx, exc):
        self.stats[section]['failed'] += 1
        self.errors.append({'section': section, 'row': int(row_idx) + 2, 'error': str(exc)})
        if self.strict:
            raise

    def _warn(self, section, row_idx, message):
        self.warnings.append({'section': section, 'row': int(row_idx) + 2, 'warning': str(message)})

    @staticmethod
    def _resolve_zip_target(base_path, target):
        if not target:
            return None
        base_dir = posix_dirname(base_path)
        normalized = posix_normpath(posix_join(base_dir, target)).lstrip('./')
        return normalized

    def _extract_sheet_images_by_row(self, excel_bytes, sheet_name):
        """
        Parse OOXML relationships and drawing anchors to map embedded images
        to Excel row numbers for a given sheet name.
        Returns: {excel_row_number: {'ext': 'png', 'bytes': b'...'}}
        """
        images_by_row = {}
        try:
            with ZipFile(BytesIO(excel_bytes)) as zf:
                workbook_root = ET.fromstring(zf.read('xl/workbook.xml'))
                rels_root = ET.fromstring(zf.read('xl/_rels/workbook.xml.rels'))

                rel_map = {
                    rel.attrib.get('Id'): rel.attrib.get('Target')
                    for rel in rels_root.findall('.//pr:Relationship', self.NS_PKG_REL)
                }

                worksheet_path = None
                for sheet in workbook_root.findall('.//m:sheet', self.NS_MAIN):
                    if (sheet.attrib.get('name') or '').strip().lower() == sheet_name.lower():
                        sheet_rid = sheet.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
                        target = rel_map.get(sheet_rid)
                        if target:
                            worksheet_path = self._resolve_zip_target('xl/workbook.xml', target)
                        break

                if not worksheet_path or worksheet_path not in zf.namelist():
                    return images_by_row

                worksheet_root = ET.fromstring(zf.read(worksheet_path))
                drawing_el = worksheet_root.find('.//m:drawing', {**self.NS_MAIN, **self.NS_REL})
                if drawing_el is None:
                    return images_by_row

                drawing_rid = drawing_el.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
                ws_rels_path = f"{posix_dirname(worksheet_path)}/_rels/{Path(worksheet_path).name}.rels"
                if ws_rels_path not in zf.namelist():
                    return images_by_row

                ws_rels_root = ET.fromstring(zf.read(ws_rels_path))
                ws_rel_map = {
                    rel.attrib.get('Id'): rel.attrib.get('Target')
                    for rel in ws_rels_root.findall('.//pr:Relationship', self.NS_PKG_REL)
                }
                drawing_target = ws_rel_map.get(drawing_rid)
                drawing_path = self._resolve_zip_target(ws_rels_path, drawing_target)
                if not drawing_path or drawing_path not in zf.namelist():
                    return images_by_row

                drawing_root = ET.fromstring(zf.read(drawing_path))
                drawing_rels_path = f"{posix_dirname(drawing_path)}/_rels/{Path(drawing_path).name}.rels"
                if drawing_rels_path not in zf.namelist():
                    return images_by_row

                drawing_rels_root = ET.fromstring(zf.read(drawing_rels_path))
                drawing_rel_map = {
                    rel.attrib.get('Id'): rel.attrib.get('Target')
                    for rel in drawing_rels_root.findall('.//pr:Relationship', self.NS_PKG_REL)
                }

                anchors = list(drawing_root.findall('.//xdr:oneCellAnchor', self.NS_DRAWING))
                anchors += list(drawing_root.findall('.//xdr:twoCellAnchor', self.NS_DRAWING))
                for anchor in anchors:
                    row_node = anchor.find('.//xdr:from/xdr:row', self.NS_DRAWING)
                    if row_node is None or row_node.text is None:
                        continue
                    # xdr row is 0-based; Excel row is 1-based
                    excel_row = int(row_node.text) + 1

                    blip = anchor.find('.//a:blip', {**self.NS_DRAWING, **self.NS_DRAWING_REL, **self.NS_REL})
                    if blip is None:
                        continue
                    embed_rid = blip.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed')
                    image_target = drawing_rel_map.get(embed_rid)
                    image_path = self._resolve_zip_target(drawing_rels_path, image_target)
                    if not image_path or image_path not in zf.namelist():
                        continue

                    image_bytes = zf.read(image_path)
                    ext = Path(image_path).suffix.lower().lstrip('.') or 'png'
                    images_by_row[excel_row] = {'ext': ext, 'bytes': image_bytes}

        except Exception as exc:  # noqa: BLE001
            self.warnings.append({
                'section': 'inventory',
                'row': 1,
                'warning': f'Could not parse embedded images from sheet "{sheet_name}": {exc}'
            })
        return images_by_row

    def _resolve_product_image(self, image_ref):
        image_name = self._clean(image_ref)
        if not image_name:
            return None

        media_root = Path(settings.MEDIA_ROOT)
        store_slug = slugify(self.store.name) or self.store.code.lower()
        store_code = (self.store.code or '').lower()
        image_name = str(image_name).replace('\\', '/').lstrip('/')

        # Accept both media/<store_key>/... and media/products/<store_key>/...
        candidate_relative_paths = [
            f"products/{store_slug}/{image_name}",
            f"products/{store_code}/{image_name}",
            f"{store_slug}/{image_name}",
            f"{store_code}/{image_name}",
            image_name,
        ]

        for rel in candidate_relative_paths:
            if (media_root / rel).exists():
                return rel
        return None

    def _save_embedded_inventory_image(self, product, row_idx):
        # idx starts at 0 for first data row, header is row 1 -> excel row = idx + 2
        excel_row = int(row_idx) + 2
        image_payload = self.inventory_images_by_row.get(excel_row)
        if not image_payload:
            return None

        store_slug = slugify(self.store.name) or (self.store.code or 'store').lower()
        ext = image_payload.get('ext') or 'png'
        filename = f"{slugify(product.name) or product.barcode}-{product.barcode}.{ext}"
        relative_path = f"products/{store_slug}/{filename}"
        absolute_path = Path(settings.MEDIA_ROOT) / relative_path
        absolute_path.parent.mkdir(parents=True, exist_ok=True)
        absolute_path.write_bytes(image_payload['bytes'])
        return relative_path

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
                    'price': self._as_decimal(row.get('price') or row.get('mrp') or row.get('cost_price') or row.get('cost')),
                    'cost_price': self._as_decimal(row.get('cost_price') or row.get('cost') or row.get('price') or row.get('mrp')),
                    'discount_price': self._as_decimal(row.get('discount_price')) if self._clean(row.get('discount_price')) is not None else None,
                    'tax': self._as_int(row.get('tax'), default=0),
                    'hsn_code': self._clean(row.get('hsn_code')),
                    'unit': self._clean(row.get('unit')) or 'piece',
                    'weight': self._as_decimal(row.get('weight')) if self._clean(row.get('weight')) is not None else None,
                    'is_active': self._as_bool(row.get('is_active'), default=True),
                    'is_featured': self._as_bool(row.get('is_featured')),
                    'is_service': self._as_bool(row.get('is_service')),
                }
                if product_defaults['tax'] not in {0, 5, 12, 18, 28}:
                    self._warn('inventory', idx, f"Unsupported tax '{product_defaults['tax']}', defaulted to 0")
                    product_defaults['tax'] = 0

                image_ref = self._clean(
                    row.get('image_filename') or row.get('image_file') or row.get('image_path') or row.get('image')
                )
                if image_ref:
                    resolved_image = self._resolve_product_image(image_ref)
                    if resolved_image:
                        product_defaults['image'] = resolved_image
                    else:
                        self._warn(
                            'inventory',
                            idx,
                            f"Image '{image_ref}' not found in media folder; product imported without image"
                        )

                product, created = Product.objects.update_or_create(
                    barcode=str(barcode),
                    defaults=product_defaults,
                )

                # Prefer embedded cell image (if present), fallback to image filename path.
                embedded_image_rel = self._save_embedded_inventory_image(product, idx)
                if embedded_image_rel:
                    product.image = embedded_image_rel
                    product.save(update_fields=['image', 'updated_at'])

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
                    'loyalty_points': self._as_int(row.get('loyalty_points'), default=0),
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

    def _generate_ref_number(self, prefix):
        date_part = timezone.now().strftime('%Y%m%d')
        return f"{prefix}-{self.store.code}-{date_part}-{timezone.now().strftime('%H%M%S')}"

    def _find_product(self, row):
        barcode = self._clean(row.get('product_barcode') or row.get('barcode'))
        product_name = self._clean(row.get('product_name') or row.get('name'))
        product = None
        if barcode:
            product = Product.objects.filter(barcode=str(barcode)).first()
        if not product and product_name:
            product = Product.objects.filter(name=product_name).first()
        return product

    def _find_supplier(self, row):
        supplier_name = self._clean(row.get('supplier_name') or row.get('name'))
        supplier_phone = self._clean(row.get('supplier_phone') or row.get('phone'))
        supplier = None
        if supplier_phone:
            phone = ''.join(ch for ch in str(supplier_phone) if ch.isdigit())
            supplier = Supplier.objects.filter(phone=phone).first()
        if not supplier and supplier_name:
            supplier = Supplier.objects.filter(name=supplier_name).first()
        return supplier

    def import_suppliers(self, df):
        if df is None:
            return

        for idx, row in df.iterrows():
            self.stats['suppliers']['processed'] += 1
            try:
                name = self._clean(row.get('name') or row.get('supplier_name'))
                phone_raw = self._clean(row.get('phone') or row.get('supplier_phone'))
                if not name or not phone_raw:
                    raise ValueError('suppliers requires name and phone')

                phone = ''.join(ch for ch in str(phone_raw) if ch.isdigit())
                if not phone:
                    raise ValueError('invalid supplier phone')

                defaults = {
                    'contact_person': self._clean(row.get('contact_person')),
                    'email': self._clean(row.get('email')),
                    'address': self._clean(row.get('address')),
                    'city': self._clean(row.get('city')),
                    'state': self._clean(row.get('state')),
                    'pincode': self._clean(row.get('pincode')),
                    'gst_number': self._clean(row.get('gst_number')),
                    'pan_number': self._clean(row.get('pan_number')),
                    'credit_period': self._as_int(row.get('credit_period'), default=30),
                    'credit_limit': self._as_decimal(row.get('credit_limit')),
                    'current_balance': self._as_decimal(row.get('current_balance')),
                    'notes': self._clean(row.get('notes')),
                    'is_active': self._as_bool(row.get('is_active'), default=True),
                    'created_by': self.user,
                }

                _, created = Supplier.objects.update_or_create(
                    name=name,
                    phone=phone,
                    defaults=defaults,
                )
                if created:
                    self.stats['suppliers']['created'] += 1
                else:
                    self.stats['suppliers']['updated'] += 1

            except Exception as exc:  # noqa: BLE001
                self._fail_or_continue('suppliers', idx, exc)

    def import_purchase_orders(self, df):
        if df is None:
            return

        valid_statuses = {choice[0] for choice in PurchaseOrder.STATUS_CHOICES}
        valid_payment_statuses = {choice[0] for choice in PurchaseOrder.PAYMENT_STATUS_CHOICES}

        for idx, row in df.iterrows():
            self.stats['purchase_orders']['processed'] += 1
            try:
                po_number = self._clean(row.get('po_number')) or self._generate_ref_number('PO')
                supplier = self._find_supplier(row)
                if not supplier:
                    raise ValueError('purchase_orders requires valid supplier_name/supplier_phone')

                status = self._clean(row.get('status')) or 'draft'
                if status not in valid_statuses:
                    self._warn('purchase_orders', idx, f"Invalid status '{status}', defaulted to 'draft'")
                    status = 'draft'

                payment_status = self._clean(row.get('payment_status')) or 'pending'
                if payment_status not in valid_payment_statuses:
                    self._warn('purchase_orders', idx, f"Invalid payment_status '{payment_status}', defaulted to 'pending'")
                    payment_status = 'pending'

                defaults = {
                    'supplier': supplier,
                    'store': self.store,
                    'order_date': self._as_date(row.get('order_date')) or timezone.now().date(),
                    'expected_delivery_date': self._as_date(row.get('expected_delivery_date')),
                    'status': status,
                    'payment_status': payment_status,
                    'shipping_charges': self._as_decimal(row.get('shipping_charges')),
                    'notes': self._clean(row.get('notes')),
                    'terms': self._clean(row.get('terms')),
                    'created_by': self.user,
                }

                _, created = PurchaseOrder.objects.update_or_create(
                    po_number=po_number,
                    defaults=defaults,
                )
                if created:
                    self.stats['purchase_orders']['created'] += 1
                else:
                    self.stats['purchase_orders']['updated'] += 1

            except Exception as exc:  # noqa: BLE001
                self._fail_or_continue('purchase_orders', idx, exc)

    def import_purchase_order_items(self, df):
        if df is None:
            return

        touched_pos = set()
        for idx, row in df.iterrows():
            self.stats['purchase_order_items']['processed'] += 1
            try:
                po_number = self._clean(row.get('po_number'))
                if not po_number:
                    raise ValueError('purchase_order_items requires po_number')

                po = PurchaseOrder.objects.filter(po_number=po_number).first()
                if not po:
                    raise ValueError(f'purchase order not found: {po_number}')

                product = self._find_product(row)
                if not product:
                    raise ValueError('purchase_order_items product not found by barcode/name')

                defaults = {
                    'quantity_ordered': self._as_decimal(row.get('quantity_ordered') or row.get('quantity')),
                    'quantity_received': self._as_decimal(row.get('quantity_received')),
                    'unit_price': self._as_decimal(row.get('unit_price') or row.get('price') or product.cost_price),
                    'tax_rate': self._as_decimal(row.get('tax_rate') or 0),
                    'discount_percentage': self._as_decimal(row.get('discount_percentage')),
                    'expected_delivery_date': self._as_date(row.get('expected_delivery_date')),
                }

                _, created = PurchaseOrderItem.objects.update_or_create(
                    purchase_order=po,
                    product=product,
                    defaults=defaults,
                )
                touched_pos.add(po.id)
                if created:
                    self.stats['purchase_order_items']['created'] += 1
                else:
                    self.stats['purchase_order_items']['updated'] += 1

            except Exception as exc:  # noqa: BLE001
                self._fail_or_continue('purchase_order_items', idx, exc)

        for po_id in touched_pos:
            po = PurchaseOrder.objects.filter(id=po_id).first()
            if po:
                po.calculate_totals()

    def import_grns(self, df):
        if df is None:
            return

        valid_statuses = {choice[0] for choice in GoodsReceiptNote.STATUS_CHOICES}

        for idx, row in df.iterrows():
            self.stats['grn']['processed'] += 1
            try:
                grn_number = self._clean(row.get('grn_number')) or self._generate_ref_number('GRN')
                po_number = self._clean(row.get('po_number'))
                po = PurchaseOrder.objects.filter(po_number=po_number).first() if po_number else None
                supplier = self._find_supplier(row) or (po.supplier if po else None)
                if not supplier:
                    raise ValueError('grn requires valid supplier_name/supplier_phone or po_number')

                status = self._clean(row.get('status')) or 'pending'
                if status not in valid_statuses:
                    self._warn('grn', idx, f"Invalid status '{status}', defaulted to 'pending'")
                    status = 'pending'

                defaults = {
                    'purchase_order': po,
                    'supplier': supplier,
                    'store': self.store,
                    'receipt_date': self._as_date(row.get('receipt_date')) or timezone.now().date(),
                    'invoice_number': self._clean(row.get('invoice_number')),
                    'invoice_date': self._as_date(row.get('invoice_date')),
                    'status': status,
                    'shipping_charges': self._as_decimal(row.get('shipping_charges')),
                    'notes': self._clean(row.get('notes')),
                    'created_by': self.user,
                }

                _, created = GoodsReceiptNote.objects.update_or_create(
                    grn_number=grn_number,
                    defaults=defaults,
                )
                if created:
                    self.stats['grn']['created'] += 1
                else:
                    self.stats['grn']['updated'] += 1

            except Exception as exc:  # noqa: BLE001
                self._fail_or_continue('grn', idx, exc)

    def import_grn_items(self, df):
        if df is None:
            return

        touched_grns = set()
        for idx, row in df.iterrows():
            self.stats['grn_items']['processed'] += 1
            try:
                grn_number = self._clean(row.get('grn_number'))
                if not grn_number:
                    raise ValueError('grn_items requires grn_number')
                grn = GoodsReceiptNote.objects.filter(grn_number=grn_number).first()
                if not grn:
                    raise ValueError(f'grn not found: {grn_number}')

                product = self._find_product(row)
                if not product:
                    raise ValueError('grn_items product not found by barcode/name')

                batch_number = self._clean(row.get('batch_number'))
                defaults = {
                    'quantity': self._as_decimal(row.get('quantity')),
                    'unit_price': self._as_decimal(row.get('unit_price') or row.get('price') or product.cost_price),
                    'tax_rate': self._as_decimal(row.get('tax_rate')),
                    'discount_percentage': self._as_decimal(row.get('discount_percentage')),
                    'batch_number': batch_number,
                    'expiry_date': self._as_date(row.get('expiry_date')),
                }

                _, created = GoodsReceiptNoteItem.objects.update_or_create(
                    grn=grn,
                    product=product,
                    batch_number=batch_number,
                    defaults=defaults,
                )
                touched_grns.add(grn.id)
                if created:
                    self.stats['grn_items']['created'] += 1
                else:
                    self.stats['grn_items']['updated'] += 1

            except Exception as exc:  # noqa: BLE001
                self._fail_or_continue('grn_items', idx, exc)

        for grn_id in touched_grns:
            grn = GoodsReceiptNote.objects.filter(id=grn_id).first()
            if not grn:
                continue
            grn.calculate_totals()
            if grn.purchase_order:
                grn.purchase_order.calculate_totals()

    def import_supplier_invoices(self, df):
        if df is None:
            return

        valid_statuses = {choice[0] for choice in SupplierInvoice.STATUS_CHOICES}

        for idx, row in df.iterrows():
            self.stats['supplier_invoices']['processed'] += 1
            try:
                invoice_number = self._clean(row.get('invoice_number')) or self._generate_ref_number('SI')
                supplier = self._find_supplier(row)
                if not supplier:
                    raise ValueError('supplier_invoices requires valid supplier_name/supplier_phone')

                po_number = self._clean(row.get('po_number'))
                grn_number = self._clean(row.get('grn_number'))
                po = PurchaseOrder.objects.filter(po_number=po_number).first() if po_number else None
                grn = GoodsReceiptNote.objects.filter(grn_number=grn_number).first() if grn_number else None
                invoice_date = self._as_date(row.get('invoice_date')) or timezone.now().date()
                due_date = self._as_date(row.get('due_date')) or (invoice_date + timedelta(days=30))
                status = self._clean(row.get('status')) or 'draft'
                if status not in valid_statuses:
                    self._warn('supplier_invoices', idx, f"Invalid status '{status}', defaulted to 'draft'")
                    status = 'draft'

                defaults = {
                    'supplier_invoice_number': self._clean(row.get('supplier_invoice_number')) or invoice_number,
                    'supplier_name': self._clean(row.get('supplier_name')) or supplier.name,
                    'supplier': supplier,
                    'po_number': po_number,
                    'purchase_order': po,
                    'grn_number': grn_number,
                    'grn': grn,
                    'store': self.store,
                    'invoice_date': invoice_date,
                    'due_date': due_date,
                    'status': status,
                    'payment_terms': self._clean(row.get('payment_terms')) or 'Net 30',
                    'subtotal': self._as_decimal(row.get('subtotal')),
                    'discount_total': self._as_decimal(row.get('discount_total')),
                    'tax_total': self._as_decimal(row.get('tax_total')),
                    'shipping_charges': self._as_decimal(row.get('shipping_charges')),
                    'grand_total': self._as_decimal(row.get('grand_total')),
                    'notes': self._clean(row.get('notes')),
                    'created_by': self.user,
                }

                _, created = SupplierInvoice.objects.update_or_create(
                    invoice_number=invoice_number,
                    defaults=defaults,
                )
                if created:
                    self.stats['supplier_invoices']['created'] += 1
                else:
                    self.stats['supplier_invoices']['updated'] += 1

            except Exception as exc:  # noqa: BLE001
                self._fail_or_continue('supplier_invoices', idx, exc)

    def import_supplier_invoice_items(self, df):
        if df is None:
            return

        touched_invoices = set()
        for idx, row in df.iterrows():
            self.stats['supplier_invoice_items']['processed'] += 1
            try:
                invoice_number = self._clean(row.get('invoice_number'))
                if not invoice_number:
                    raise ValueError('supplier_invoice_items requires invoice_number')
                invoice = SupplierInvoice.objects.filter(invoice_number=invoice_number).first()
                if not invoice:
                    raise ValueError(f'supplier invoice not found: {invoice_number}')

                product = self._find_product(row)
                product_code = self._clean(row.get('product_code') or row.get('product_barcode') or (product.barcode if product else None))
                product_name = self._clean(row.get('product_name') or (product.name if product else None))
                if not product_name:
                    raise ValueError('supplier_invoice_items requires product_name or resolvable product barcode')

                defaults = {
                    'product_ref': product,
                    'product_name': product_name,
                    'quantity': self._as_decimal(row.get('quantity')),
                    'unit_price': self._as_decimal(row.get('unit_price') or row.get('price') or (product.cost_price if product else 0)),
                    'discount': self._as_decimal(row.get('discount')),
                    'discount_type': self._clean(row.get('discount_type')) or 'percentage',
                    'tax_rate': self._as_decimal(row.get('tax_rate')),
                }

                _, created = SupplierInvoiceItem.objects.update_or_create(
                    invoice=invoice,
                    product_code=product_code,
                    product_name=product_name,
                    defaults=defaults,
                )
                touched_invoices.add(invoice.id)
                if created:
                    self.stats['supplier_invoice_items']['created'] += 1
                else:
                    self.stats['supplier_invoice_items']['updated'] += 1

            except Exception as exc:  # noqa: BLE001
                self._fail_or_continue('supplier_invoice_items', idx, exc)

        for invoice_id in touched_invoices:
            invoice = SupplierInvoice.objects.filter(id=invoice_id).first()
            if not invoice:
                continue
            items = invoice.items.all()
            subtotal = sum((item.unit_price * item.quantity) for item in items)
            discount_total = Decimal('0')
            tax_total = Decimal('0')
            for item in items:
                base = item.unit_price * item.quantity
                item_discount = item.discount if item.discount_type == 'amount' else base * (item.discount / Decimal('100'))
                taxable = base - item_discount
                item_tax = taxable * (item.tax_rate / Decimal('100'))
                item.tax_amount = item_tax
                item.total = taxable + item_tax
                item.save(update_fields=['tax_amount', 'total'])
                discount_total += item_discount
                tax_total += item_tax

            invoice.subtotal = subtotal
            invoice.discount_total = discount_total
            invoice.tax_total = tax_total
            invoice.grand_total = subtotal - discount_total + tax_total + invoice.shipping_charges
            invoice.save(update_fields=['subtotal', 'discount_total', 'tax_total', 'grand_total', 'updated_at'])

    def import_supplier_payments(self, df):
        if df is None:
            return

        valid_methods = {choice[0] for choice in SupplierPayment.PAYMENT_METHOD_CHOICES}
        valid_statuses = {choice[0] for choice in SupplierPayment.STATUS_CHOICES}

        for idx, row in df.iterrows():
            self.stats['supplier_payments']['processed'] += 1
            try:
                supplier = self._find_supplier(row)
                if not supplier:
                    raise ValueError('supplier_payments requires valid supplier_name/supplier_phone')

                po_number = self._clean(row.get('po_number'))
                invoice_number = self._clean(row.get('invoice_number'))
                po = PurchaseOrder.objects.filter(po_number=po_number).first() if po_number else None
                invoice = SupplierInvoice.objects.filter(invoice_number=invoice_number).first() if invoice_number else None
                payment_method = self._clean(row.get('payment_method')) or 'cash'
                if payment_method not in valid_methods:
                    self._warn('supplier_payments', idx, f"Invalid payment_method '{payment_method}', defaulted to 'cash'")
                    payment_method = 'cash'
                payment_status = self._clean(row.get('status')) or 'completed'
                if payment_status not in valid_statuses:
                    self._warn('supplier_payments', idx, f"Invalid status '{payment_status}', defaulted to 'completed'")
                    payment_status = 'completed'

                reference_number = self._clean(row.get('reference_number')) or self._clean(row.get('transaction_id'))
                payment_date = self._as_date(row.get('payment_date')) or timezone.now().date()
                amount = self._as_decimal(row.get('amount'))
                if amount <= 0:
                    raise ValueError('supplier_payments amount must be > 0')

                defaults = {
                    'supplier': supplier,
                    'purchase_order': po,
                    'supplier_invoice': invoice,
                    'payment_method': payment_method,
                    'status': payment_status,
                    'notes': self._clean(row.get('notes')),
                    'created_by': self.user,
                }

                _, created = SupplierPayment.objects.update_or_create(
                    supplier=supplier,
                    amount=amount,
                    payment_date=payment_date,
                    reference_number=reference_number,
                    defaults=defaults,
                )
                if created:
                    self.stats['supplier_payments']['created'] += 1
                else:
                    self.stats['supplier_payments']['updated'] += 1

            except Exception as exc:  # noqa: BLE001
                self._fail_or_continue('supplier_payments', idx, exc)

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
                    'completed_at': self._as_datetime(row.get('completed_at')) or timezone.now(),
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
        excel_bytes = excel_file.read()
        book = pd.ExcelFile(BytesIO(excel_bytes))
        inventory_df = self._get_sheet(book, 'inventory')
        customers_df = self._get_sheet(book, 'customers')
        sales_df = self._get_sheet(book, 'sales')
        sales_items_df = self._get_sheet(book, 'sales_items')
        payments_df = self._get_sheet(book, 'payments')
        suppliers_df = self._get_sheet(book, 'suppliers')
        purchase_orders_df = self._get_sheet(book, 'purchase_orders')
        purchase_order_items_df = self._get_sheet(book, 'purchase_order_items')
        grn_df = self._get_sheet(book, 'grn')
        grn_items_df = self._get_sheet(book, 'grn_items')
        supplier_invoices_df = self._get_sheet(book, 'supplier_invoices')
        supplier_invoice_items_df = self._get_sheet(book, 'supplier_invoice_items')
        supplier_payments_df = self._get_sheet(book, 'supplier_payments')
        self.inventory_images_by_row = self._extract_sheet_images_by_row(excel_bytes, 'inventory')

        if not any([
            inventory_df is not None,
            customers_df is not None,
            sales_df is not None,
            suppliers_df is not None,
            purchase_orders_df is not None,
            grn_df is not None,
            supplier_invoices_df is not None,
        ]):
            raise ValueError(
                'No supported sheets found. Required at least one of: '
                'inventory, customers, sales, suppliers, purchase_orders, grn, supplier_invoices'
            )

        with transaction.atomic():
            self.import_inventory(inventory_df)
            self.import_customers(customers_df)
            self.import_sales(sales_df, sales_items_df=sales_items_df, payments_df=payments_df)
            self.import_suppliers(suppliers_df)
            self.import_purchase_orders(purchase_orders_df)
            self.import_purchase_order_items(purchase_order_items_df)
            self.import_grns(grn_df)
            self.import_grn_items(grn_items_df)
            self.import_supplier_invoices(supplier_invoices_df)
            self.import_supplier_invoice_items(supplier_invoice_items_df)
            self.import_supplier_payments(supplier_payments_df)

            if self.strict and self.errors:
                raise ValueError('Import failed in strict mode. Fix sheet data and retry.')

        return {
            'store_id': self.store.id,
            'strict_mode': self.strict,
            'stats': self.stats,
            'errors': self.errors,
            'warnings': self.warnings,
            'sheets_found': {
                'inventory': inventory_df is not None,
                'customers': customers_df is not None,
                'sales': sales_df is not None,
                'sales_items': sales_items_df is not None,
                'payments': payments_df is not None,
                'suppliers': suppliers_df is not None,
                'purchase_orders': purchase_orders_df is not None,
                'purchase_order_items': purchase_order_items_df is not None,
                'grn': grn_df is not None,
                'grn_items': grn_items_df is not None,
                'supplier_invoices': supplier_invoices_df is not None,
                'supplier_invoice_items': supplier_invoice_items_df is not None,
                'supplier_payments': supplier_payments_df is not None,
            },
        }
