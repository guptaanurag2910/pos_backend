# Store Bootstrap File (Populate Maximum Tables)

Main template:
- `/Users/anurag/Library/CloudStorage/OneDrive-CargillInc/Desktop/AAA_POS/pos/sample_data/store_bootstrap_template.xlsx`

Full sample (filled data):
- `/Users/anurag/Library/CloudStorage/OneDrive-CargillInc/Desktop/AAA_POS/pos/sample_data/store_bootstrap_sample.xlsx`

## Sheets supported by importer
Core:
- `inventory`
- `customers`
- `sales`
- `sales_items`
- `payments`

Purchase/Supplier:
- `suppliers`
- `purchase_orders`
- `purchase_order_items`
- `grn`
- `grn_items`
- `supplier_invoices`
- `supplier_invoice_items`
- `supplier_payments`

## Minimum required fields
- `inventory`: `product_name` (or `name`), `barcode`
- `customers`: `name`, `phone`
- `sales_items`: `bill_number` + product (`product_barcode` or `product_name`)
- `suppliers`: `name`, `phone`
- `purchase_orders`: `po_number` (or auto), supplier (`supplier_name` or `supplier_phone`)
- `purchase_order_items`: `po_number` + product (`product_barcode` or `product_name`)
- `grn`: `grn_number` (or auto) + supplier (or `po_number`)
- `grn_items`: `grn_number` + product
- `supplier_invoices`: `invoice_number` (or auto) + supplier
- `supplier_invoice_items`: `invoice_number` + (`product_name` or `product_barcode`)
- `supplier_payments`: supplier + `amount`

## Product image support
Set `inventory.image_filename` and place files in one of:
- `pos_be/pos_backend/media/<store-name-slug>/`
- `pos_be/pos_backend/media/<store-code>/`
- `pos_be/pos_backend/media/products/<store-name-slug>/`
- `pos_be/pos_backend/media/products/<store-code>/`

Sample icon:
- `/Users/anurag/Library/CloudStorage/OneDrive-CargillInc/Desktop/AAA_POS/pos/sample_data/icons/sample_item_icon.png`

## Missing data / edge case handling
- Missing numeric values default to `0` where safe.
- Invalid product image path -> warning, row still imports.
- Invalid `tax` in inventory -> defaults to `0` with warning.
- Invalid status values in purchase/supplier flows -> safe defaults with warning.
- In `strict=true`: invalid row fails import transaction.
- In `strict=false`: invalid rows are skipped and captured in `errors`.

## Recommended process
1. First upload with `strict=false`.
2. Fix `errors`/`warnings`.
3. Re-upload with `strict=true`.
