# Module Notes

## 1. Data Model

### Store

Key fields:
- identity: `name`, `code` (unique)
- location/contact: `address`, `city`, `state`, `pincode`, `phone`, `email`
- compliance: `gst_number`, `pan_number`
- ops flags: `is_main`, `is_active`
- timings: `opening_time`, `closing_time`

### StoreSettings
One-to-one settings table for each store (`store -> Store`).

Key fields:
- general: `store_logo`, `currency_symbol`, `decimal_places`, `date_format`, `theme`
- invoice: `invoice_prefix`, `invoice_start_number`, `invoice_footer_text`, `show_tax_in_invoice`, `enable_invoice_email`
- billing: `allow_partial_payments`, `enable_discount`, `default_tax_rate`, `enable_round_off`
- printer: `printer_type`, `printer_address`, `enable_auto_print`
- ops: `enable_low_stock_alert`, `low_stock_threshold`, `enable_customer_points`, `points_conversion_rate`
- audit: `updated_at`, `updated_by`

## 2. API Routing and Use

Base route: `/api/stores/`

- `GET /api/stores/`
  - Use: list stores user can access.

- `POST /api/stores/`
  - Use: create a new store (admin); default `StoreSettings` auto-created.

- `GET /api/stores/{id}/`
  - Use: get one store details.

- `PUT/PATCH /api/stores/{id}/`
  - Use: update store master details.

- `DELETE /api/stores/{id}/`
  - Use: delete store.

- `GET /api/stores/{id}/settings/`
  - Use: fetch store settings.

- `PUT/PATCH /api/stores/{id}/settings/`
  - Use: update store settings (billing/invoice/printer/alerts/points).

- `POST /api/stores/{id}/bootstrap-import/`
  - Use: upload one Excel file to bootstrap a new store with historical setup data.
  - Input form-data:
    - `file` (`.xlsx`) required
    - `strict` (boolean, default `true`)
  - Supported sheets (case-insensitive):
    - `inventory`
    - `customers`
    - `sales`
    - `sales_items` (optional)
    - `payments` (optional)
  - Output:
    - per-sheet processed/created/updated/failed counts
    - row-level errors with section and row number

## 3. Are These APIs Sufficient?
For current POS needs: yes, mostly sufficient.

Already covered:
- full store CRUD
- full settings read/update
- role/store-based access filtering

Recommended additions for production:
1. `POST /api/stores/{id}/activate/` and `/deactivate/` (safer than delete)
2. `POST /api/stores/{id}/set_main/` (enforce single main store)
3. `GET /api/stores/active/` (active-only list)
4. stronger validations (phone/pincode/code format, unique main store rule)

#####################################################################################################################

## Reports Module (Production Update)

### API Base
- `/api/reports/`

### Implemented APIs

- `GET /api/reports/dashboard/`
  - Unified analytics payload for dashboard tabs.
  - Supports `start_date`, `end_date`, `time_range`, `store`.
  - Includes:
    - `salesSummary`
    - `inventorySummary`
    - `recentSales`
    - `topProducts`
    - `salesTrend`, `categoryPerformance`, `hourlyTraffic`
    - `inventoryStatus`, `stockAlerts`
    - `customerSummary`, `topCustomers`
    - `performance`, `trendMetrics`

- `GET /api/reports/dashboard/analytics/`
  - Alias of dashboard API for explicit analytics routing.

- `GET /api/reports/sales/`
  - Sales over time, payment split, top products.
  - Params: `start_date`, `end_date`, `group_by=day|week|month`, `store`, `export=true|false`.

- `GET /api/reports/inventory/`
  - Stock status with 30-day sales velocity and days remaining.
  - Params: `store`, `category`, `low_stock`, `export=true|false`.

- `GET /api/reports/customers/`
  - Active/new customer summary, purchase behavior, top customers, loyalty metrics.
  - Params: `start_date`, `end_date`, `store`, `export=true|false`.

- `GET /api/reports/tax/`
  - Taxable value and tax collection grouped by tax rate.
  - Params: `start_date`, `end_date`, `store`, `export=true|false`.

### Production Hardening Included
- Date-range validation and safe defaults.
- Store-scoped access for non-admin users.
- CSV export support for all report APIs.
- Profit margin and inventory-value calculations.
- Fixed report query bugs (bill/store scoping and product aggregations).

Current reports module status: production-ready for analytics dashboard and export reporting.

#####################################################################################################################

## Accounts Module

### 1. Data Model

#### User
Custom auth user model for POS login and role access.

Key fields:
- identity: `email` (unique login), `name`
- role/access: `role` (`admin`, `manager`, `cashier`)
- store mapping: `store` (FK to `Store`, nullable)
- auth status: `is_active`, `is_staff`, `last_login`, `date_joined`

#### UserSession
Tracks user login/logout sessions.

Key fields:
- `user` (FK), `session_key`
- `login_time`, `logout_time`, `is_active`
- client info: `ip_address`, `device_info`

#### AuditLog
Tracks system actions by users.

Key fields:
- `user` (FK, nullable), `action`
- object tracking: `model_name`, `object_id`, `object_repr`
- request context: `ip_address`, `details` (JSON)
- timestamp: `action_time`

### 2. API Routing and Use

Base route: `/api/auth/`

- `POST /api/auth/token/`
  - Use: login with email/password, returns JWT + user info; creates session + audit log.

- `POST /api/auth/token/refresh/`
  - Use: refresh access token using refresh token.

- `POST /api/auth/logout/`
  - Use: blacklist refresh token; marks session logged out; writes logout audit log.

- `GET /api/auth/users/`
  - Use: list users (admin all, manager own store, cashier self).

- `POST /api/auth/users/`
  - Use: create user (admin only).

- `GET /api/auth/users/{id}/`
  - Use: get user details.

- `PUT/PATCH /api/auth/users/{id}/`
  - Use: update user details (owner/admin rules).

- `DELETE /api/auth/users/{id}/`
  - Use: soft delete user (`is_active=False`), not hard delete.

- `GET /api/auth/users/me/`
  - Use: fetch current logged-in user profile.

- `POST /api/auth/users/{id}/change_password/`
  - Use: change password (requires `old_password` + `new_password`).

- `GET /api/auth/sessions/`
  - Use: view login session history.

- `GET /api/auth/audit-logs/`
  - Use: view filtered activity logs.


#####################################################################################################################


## Inventory Module

### 1. Data Model

#### Category
Product category master with hierarchy.

Key fields:
- identity: `name`, `slug` (auto-generated, unique)
- hierarchy: `parent` (self-FK, nullable)
- status/notes: `description`, `is_active`

#### Product
Product master for POS and inventory.

Key fields:
- identity: `name`, `barcode` (unique), `category`
- pricing/tax: `price`, `cost_price`, `discount_price`, `tax`, `hsn_code`
- behavior flags: `is_active`, `is_featured`, `is_service`
- attributes: `unit`, `weight`, `image`
- audit: `created_at`, `updated_at`

#### StockRecord
Movement ledger for stock transactions.

Key fields:
- refs: `product`, `store`, `created_by`
- movement: `quantity`, `record_type` (`purchase/sale/return/adjustment/transfer_in/transfer_out`)
- linkage: `reference_id`, `batch_number`, `expiry_date`, `notes`, `created_at`

#### StockLevel
Current available stock by product/store/batch.

Key fields:
- refs: `product`, `store`
- levels: `quantity`, `min_stock`, `max_stock`
- tracking: `batch_number`, `expiry_date`, `updated_at`
- constraints: unique (`product`, `store`, `batch_number`), `quantity >= 0`, `min_stock >= 0`

#### StockTransfer
Header for inter-store transfer.

Key fields:
- refs: `from_store`, `to_store`
- lifecycle: `status` (`pending/approved/in_transit/completed/cancelled`)
- audit: `created_by`, `created_at`, `completed_by`, `completed_at`, `notes`

#### StockTransferItem
Items inside a stock transfer.

Key fields:
- refs: `transfer`, `product`
- movement: `quantity`, `batch_number`, `expiry_date`, `created_at`

#### InventoryUpload
File upload model for inventory import.

Key fields:
- `file`, `uploaded_at`

### 2. API Routing and Use

Base route: `/api/inventory/`

- `categories/` (CRUD)
  - Use: maintain category hierarchy and active/inactive categories.

- `products/` (CRUD)
  - Use: maintain product catalog and pricing/tax metadata.

- `GET /api/inventory/products/{id}/stock_levels/`
  - Use: view stock level per store/batch for one product.

- `GET /api/inventory/products/{id}/stock_history/`
  - Use: view movement history of one product.

- `POST /api/inventory/products/{id}/adjust_stock/`
  - Use: manual stock increase/decrease with reason.

- `GET /api/inventory/stock-records/`
  - Use: browse/filter stock movement ledger.

- `GET /api/inventory/stock-levels/`
  - Use: browse/filter current stock levels.

- `GET /api/inventory/stock-levels/low_stock/`
  - Use: fetch items at/below minimum stock.

- `stock-transfers/` (CRUD)
  - Use: create/manage transfer between stores.

- `POST /api/inventory/stock-transfers/{id}/update_status/`
  - Use: move transfer through lifecycle; `completed` updates stock and creates movement records.

- `stock-transfers/{transfer_pk}/items/` (CRUD)
  - Use: manage line items for a transfer.

### 3. Are These APIs Sufficient?
For current POS needs: yes, strong coverage.

Already covered:
- category and product masters
- stock ledger + stock balances
- manual adjustments
- low stock reporting
- inter-store transfer workflow with status transitions

Recommended additions for production:
1. stock reconciliation endpoint (count sheet vs system stock)
2. bulk adjustment/import endpoints with validation report
3. transfer approval step before completion
4. stronger negative-stock guard in transfer completion logic

#####################################################################################################################


## Inventory Module (Update)

Implemented additional APIs and workflow improvements:

- `POST /api/inventory/products/bulk_adjust_stock/`
  - Use: apply bulk stock adjustments in one request.

- `POST /api/inventory/stock-levels/reconcile/`
  - Use: reconcile counted stock vs system stock and optionally apply adjustments.

- `POST /api/inventory/stock-transfers/{id}/approve/`
  - Use: explicit transfer approval step before dispatch/completion.

- `POST /api/inventory/stock-transfers/{id}/update_status/`
  - Improved with transition validation and safer completion checks.

- `GET/POST /api/inventory/uploads/`
- `GET /api/inventory/uploads/{id}/`
  - Use: upload inventory files and process stock updates from CSV.

Additional fixes:
- fixed `ProductSerializer` stock sum import issue
- added transfer item modification guards for completed/cancelled transfers
- added transition validation and negative stock guard before transfer completion

Current inventory module status: implemented and complete for operational POS flow.

Migration compatibility note:
- If migration error appears with `CheckConstraint(condition=...)`, replace it with `CheckConstraint(check=...)`.

#####################################################################################################################
## Sales Module

### 1. Data Model

#### Bill
Sales header table for each POS transaction.

Key fields:
- identity: `bill_number` (unique), `invoice_number` (nullable)
- refs: `customer`, `store`, `cashier`
- totals: `subtotal`, `tax_total`, `discount`, `round_off`, `total`
- payment state: `payment_status`, `payment_method`
- lifecycle: `status` (`draft`, `on_hold`, `completed`, `cancelled`)
- loyalty: `points_earned`, `points_redeemed`
- timestamps: `created_at`, `updated_at`, `completed_at`

#### BillItem
Line items under a bill.

Key fields:
- refs: `bill`, `product`
- line values: `quantity`, `price`, `tax_rate`, `tax_amount`, `discount_rate`, `discount_amount`, `total`
- `created_at`

#### Payment
Payments against bills (supports partial and refunds via negative payment rows).

Key fields:
- refs: `bill`, `created_by`
- payment details: `amount`, `payment_method`, `transaction_id`, `payment_details`
- state: `status` (`pending`, `completed`, `failed`, `refunded`)
- timestamps: `created_at`, `updated_at`

### 2. API Routing and Use

Base route: `/api/sales/`

- `bills/` (CRUD)
  - Use: create/manage sales bills.

- `POST /api/sales/bills/{id}/complete/`
  - Use: finalize bill, update inventory, loyalty, and optional payment record.

- `POST /api/sales/bills/{id}/cancel/`
  - Use: cancel draft/on-hold bill.

- `POST /api/sales/bills/{id}/hold/`
  - Use: move draft bill to on-hold.

- `POST /api/sales/bills/{id}/resume/`
  - Use: move on-hold bill back to draft.

- `bills/{bill_pk}/items/` (CRUD)
  - Use: add/update/remove bill line items while bill is editable.

- `payments/` (CRUD)
  - Use: record/list bill payments.

- `POST /api/sales/payments/{id}/refund/`
  - Use: refund completed payment and create refund payment entry.

### 3. Are These APIs Sufficient?
For current POS checkout flow: yes, mostly sufficient.

Already covered:
- full bill lifecycle (draft/hold/resume/complete/cancel)
- line item management
- payment capture and refund
- inventory and loyalty integration at bill completion

Recommended additions for production:
1. explicit invoice number generation/finalization endpoint
2. split-payment validation endpoint (pre-check before complete)
3. constraints to prevent negative stock during completion
4. receipt print/reprint endpoint with audit log

#####################################################################################################################

## Sales Module (Production Hardening Update)

Implemented production-focused enhancements:

- Invoice numbering on completion
  - Bill completion now auto-generates `invoice_number` using store code + invoice prefix sequence.

- Split payment pre-validation API
  - `POST /api/sales/bills/{id}/validate_payment_split/`
  - validates methods/amounts and checks total match against bill total.

- Receipt/reprint API with audit logging
  - `GET /api/sales/bills/{id}/receipt/` (view receipt payload)
  - `POST /api/sales/bills/{id}/receipt/` (reprint event + audit log)

- Negative stock safety at bill completion
  - pre-checks stock availability for all bill items before completion
  - consumes stock across available store batches
  - raises validation error if stock is insufficient

- Payment input hardening
  - `POST /api/sales/payments/` now rejects non-positive payment amounts.

Current sales module status: production-ready for core POS billing flow.

#####################################################################################################################

## Stores Module (Production Hardening Update)

Implemented production-focused enhancements:

- New store lifecycle endpoints:
  - `GET /api/stores/active/`
  - `POST /api/stores/{id}/activate/`
  - `POST /api/stores/{id}/deactivate/`
  - `POST /api/stores/{id}/set_main/`

- Safer delete behavior:
  - `DELETE /api/stores/{id}/` now performs soft-delete (`is_active=false`).

- Validation hardening:
  - store code normalization/validation
  - phone and pincode format validation

- Main store constraint:
  - DB-level single main store enforcement (`single_main_store`).

Current stores module status: production-ready for multi-store operations.

#####################################################################################################################

## Accounts Module (Production Hardening Update)

Implemented production-focused enhancements:

- Login throttling:
  - `POST /api/auth/token/` now uses request throttling to reduce brute-force risk.

- Admin password reset endpoint:
  - `POST /api/auth/users/{id}/reset_password/`

- Session security endpoint:
  - `POST /api/auth/users/{id}/force_logout_sessions/`
  - blacklists active refresh tokens where possible and deactivates sessions.

Current accounts module status: production-ready for core role/session control.

#####################################################################################################################

## Customers Module (Production Hardening Update)

Implemented production-focused enhancements:

- Soft delete support:
  - added `is_active` on `Customer`
  - `DELETE /api/customers/{id}/` now soft-deletes customer.

- Active/inactive visibility control:
  - `GET /api/customers/?include_inactive=true` to include inactive records.

- Merge API for de-duplication:
  - `POST /api/customers/merge/`
  - merges duplicate customers into primary customer, reassigns bills, updates points and groups.

- Data integrity constraints:
  - customer loyalty points >= 0
  - customer total purchases >= 0
  - customer group special discount >= 0

- Validation hardening:
  - phone and pincode format validation.

Current customers module status: production-ready for CRM basics and merge flow.

#####################################################################################################################

## Return Module

### 1. Data Model

#### Return
Return header against a bill.

Key fields:
- identity: `return_number` (unique)
- refs: `bill`, `processed_by`
- return details: `return_type`, `reason`, `subtotal`, `tax_total`, `refund_amount`, `refund_method`
- lifecycle: `status` (`pending`, `approved`, `completed`, `rejected`)
- customer snapshot: `customer_name`, `customer_id`
- timestamps: `return_date`, `processed_at`

#### ReturnItem
Line item under a return.

Key fields:
- refs: `return_ref`, `bill_item`, `product`
- quantities/pricing: `original_quantity`, `return_quantity`, `unit_price`, `tax`, `refund_amount`
- quality/reason: `condition`, `reason`

### 2. API Routing and Use

Base route: `/api/return/`

- `GET/POST /api/return/`
  - Use: list returns and create a new return with items.

- `GET/PUT/PATCH/DELETE /api/return/{id}/`
  - Use: retrieve/update/delete a return.

- `POST /api/return/{id}/approve/`
  - Use: approve pending return.

- `POST /api/return/{id}/reject/`
  - Use: reject pending return.

- `POST /api/return/{id}/complete/`
  - Use: complete approved return, add stock back, and create refund payment record.

### 3. Are These APIs Sufficient?
For production flow: yes, now mostly complete.

Implemented production hardening:
1. role-based access:
   - manager/admin required for create/update/delete/approve/reject/complete
   - user store scoping enforced via queryset + serializer checks
2. stronger validation:
   - return only on completed bills
   - item `bill_item` must belong to selected bill
   - item `product` must match `bill_item.product`
   - over-return prevention across approved/completed active returns
   - `refund_amount` must equal sum of item refunds and cannot exceed bill total
3. lifecycle safety:
   - only `pending` returns can be updated
   - only `pending` can be approved/rejected
   - only `approved` can be completed
4. atomic completion flow:
   - net-paid check before refund (prevents over-refund)
   - stock restore + stock ledger + refund payment happen in one transaction
5. soft delete + audit logging:
   - delete operation now marks `is_active=False`
   - create/update/approve/reject/complete/delete all write `AuditLog` entries

Current return module status: production-ready for core POS return lifecycle.

#####################################################################################################################
