# POS FE/BE Schema and API Analysis

Generated on 2026-02-23 for:
- Backend: `pos_be`
- Frontend: `pos_fe`

## 1) Backend Database Schema (Django Models)

### Core auth/accounts
- `accounts.User`
  - Custom auth user (`email` as username), roles: `admin | manager | cashier`.
  - FK: `store -> stores.Store` (nullable).
- `accounts.UserSession`
  - Tracks JWT session lifecycle (`session_key`, login/logout timestamps, IP/device).
  - FK: `user -> accounts.User`.
- `accounts.AuditLog`
  - Generic activity log (`action`, `model_name`, `object_id`, JSON `details`).
  - FK: `user -> accounts.User` (nullable).

### Stores
- `stores.Store`
  - Store master: code, address, contact, GST/PAN, active flags, timings.
- `stores.StoreSettings`
  - One-to-one config per store (invoice, billing, theme, printer, loyalty flags).
  - O2O: `store -> stores.Store`.
  - FK: `updated_by -> accounts.User`.

### Inventory
- `inventory.Category`
  - Hierarchical category (`parent` self-FK), slug, active flag.
- `inventory.Product`
  - Product catalog (barcode unique, tax slab, price/cost, service flag, image).
  - FK: `category -> inventory.Category` (nullable).
- `inventory.StockRecord`
  - Movement ledger (`purchase`, `sale`, `return`, `adjustment`, `transfer_in/out`).
  - FK: `product -> inventory.Product`, `store -> stores.Store`, `created_by -> accounts.User`.
- `inventory.StockLevel`
  - Current stock per product/store/batch.
  - Unique key: `(product, store, batch_number)`.
  - FK: `product -> inventory.Product`, `store -> stores.Store`.
- `inventory.StockTransfer`
  - Inter-store movement header with status lifecycle.
  - FK: `from_store`, `to_store -> stores.Store`, `created_by/completed_by -> accounts.User`.
- `inventory.StockTransferItem`
  - Line items for transfer.
  - FK: `transfer -> inventory.StockTransfer`, `product -> inventory.Product`.

### Sales
- `sales.Bill`
  - POS bill header (draft/on_hold/completed/cancelled, totals, payment status, loyalty points).
  - FK: `customer -> customers.Customer` (nullable), `store -> stores.Store`, `cashier -> accounts.User`.
- `sales.BillItem`
  - Bill line item with tax/discount/total computed in `save()`.
  - FK: `bill -> sales.Bill`, `product -> inventory.Product`.
- `sales.Payment`
  - Payments against bills, supports refunds via negative amount row.
  - FK: `bill -> sales.Bill`, `created_by -> accounts.User`.

### Customers
- `customers.Customer`
  - Customer master + loyalty + purchase summary fields.
  - FK: `created_by -> accounts.User`.
- `customers.CustomerGroup`
  - Segment with many-to-many customers and group discount.
  - M2M: `customers <-> customers.Customer`.
  - FK: `created_by -> accounts.User`.

### Returns
- `return.Return`
  - Return header against bill (pending/approved/completed/rejected).
  - FK: `bill -> sales.Bill`, `processed_by -> accounts.User`.
- `return.ReturnItem`
  - Item-level return quantities and refund amounts.
  - FK: `return_ref -> return.Return`, `bill_item -> sales.BillItem`, `product -> inventory.Product`.

### Suppliers / Procurement
- `suppliers.Supplier`
  - Vendor master and credit terms.
  - FK: `created_by -> accounts.User`.
- `suppliers.PurchaseOrder`
  - PO header with status/payment status and totals.
  - FK: `supplier -> suppliers.Supplier`, `store -> stores.Store`, `created_by -> accounts.User`.
- `suppliers.PurchaseOrderItem`
  - PO item with computed discount/tax/total.
  - FK: `purchase_order -> suppliers.PurchaseOrder`, `product -> inventory.Product`.
- `suppliers.GoodsReceiptNote`
  - GRN header, optional PO link.
  - FK: `purchase_order -> suppliers.PurchaseOrder` (nullable), `supplier -> suppliers.Supplier`, `store -> stores.Store`, `created_by -> accounts.User`.
- `suppliers.GoodsReceiptNoteItem`
  - GRN line with received qty + batch/expiry.
  - FK: `grn -> suppliers.GoodsReceiptNote`, `product -> inventory.Product`.
- `suppliers.SupplierInvoice`
  - Supplier invoice header (uses text fields for supplier/PO/GRN refs).
- `suppliers.SupplierInvoiceItem`
  - Supplier invoice line items.
  - FK: `invoice -> suppliers.SupplierInvoice`.
- `suppliers.SupplierPayment`
  - Payments to supplier, optional PO link.
  - FK: `supplier -> suppliers.Supplier`, `purchase_order -> suppliers.PurchaseOrder` (nullable), `created_by -> accounts.User`.

## 2) Backend API Surface (from URLs + View actions)

Base API prefix: `/api/`

### Auth (`/api/auth/`)
- `POST token/`
- `POST token/refresh/`
- `POST logout/`
- `GET/POST users/`
- `GET/PUT/PATCH/DELETE users/{id}/`
- `GET users/me/`
- `POST users/{id}/change_password/`
- `GET sessions/`
- `GET audit-logs/`

### Inventory (`/api/inventory/`)
- `categories/` CRUD
- `products/` CRUD
- `GET products/{id}/stock_levels/`
- `GET products/{id}/stock_history/`
- `POST products/{id}/adjust_stock/`
- `GET stock-records/`
- `GET stock-levels/`
- `GET stock-levels/low_stock/`
- `stock-transfers/` CRUD
- `POST stock-transfers/{id}/update_status/`
- `stock-transfers/{transfer_pk}/items/` CRUD

### Sales (`/api/sales/`)
- `bills/` CRUD
- `POST bills/{id}/complete/`
- `POST bills/{id}/cancel/`
- `POST bills/{id}/hold/`
- `POST bills/{id}/resume/`
- `bills/{bill_pk}/items/` CRUD
- `payments/` CRUD
- `POST payments/{id}/refund/`

### Returns (`/api/return/`)
- Base return endpoint CRUD on `/api/return/`
- `POST /api/return/{id}/approve/`
- `POST /api/return/{id}/reject/`
- `POST /api/return/{id}/complete/`

### Customers (`/api/customers/`)
- Base customer endpoint CRUD on `/api/customers/`
- `GET /api/customers/{id}/purchase_history/`
- `POST /api/customers/{id}/add_points/`
- `GET /api/customers/stats/`
- `groups/` CRUD
- `POST groups/{id}/add_customers/`
- `POST groups/{id}/remove_customers/`

### Stores (`/api/stores/`)
- Base store endpoint CRUD on `/api/stores/`
- `GET/PUT/PATCH /api/stores/{id}/settings/`

### Suppliers (`/api/suppliers/`)
- `suppliers/` CRUD
- `GET suppliers/{id}/purchase_history/`
- `GET suppliers/{id}/payment_history/`
- `purchase-orders/` CRUD
- `POST purchase-orders/{id}/update_status/`
- `purchase-orders/{po_pk}/items/` CRUD
- `grn/` CRUD
- `POST grn/{id}/complete/`
- `grn/{grn_pk}/items/` CRUD
- `supplier-invoices/` CRUD
- `payments/` CRUD

### Reports (`/api/reports/`)
- `GET dashboard/`
- `GET sales/`
- `GET inventory/`
- `GET customers/`
- `GET tax/`

## 3) Frontend API Usage (pos_fe)

Frontend API base config:
- `axiosInstance` baseURL = `VITE_API_BASE_URL` or `http://localhost:8000`.
- All service files call relative API paths (except one refresh-token bug noted below).

### Service-to-endpoint mapping
- `src/service/authService.ts`
  - Uses `/api/auth/*` endpoints for login/logout/user/session/audit.
- `src/service/inventoryService.ts`
  - Uses `/api/inventory/*` including custom actions (`adjust_stock`, `low_stock`, `update_status`).
- `src/service/salesService.ts`
  - Uses `/api/sales/bills`, nested `/items`, `/complete`, `/hold`, `/resume`, and `/api/sales/payments`.
- `src/service/customerService.ts`
  - Uses `/api/customers/*` plus group actions.
- `src/service/returnsService.ts`
  - Uses `/api/return/` and return actions.
- `src/service/storeService.ts`
  - Uses `/api/stores/` and `/settings/`.
- `src/service/reportService.ts`
  - Uses `/api/reports/{dashboard|sales|inventory|customers|tax}/`.
- `src/service/purchaseService.ts`
  - Intended for supplier/PO/GRN/payment/invoice flows; currently has multiple URL mismatches (below).

## 4) Integration Gaps / Mismatches Found

### High-impact BE issues
- `reports.DashboardView` uses invalid ORM filter `bill__store_filter`; this will fail at runtime for top products query.
- `inventory.views` references `models.Q`, `models.F`, and `timezone.now()` without importing `models`/`timezone` in this file.
- `return.complete` creates `sales.Payment` using `refund_method`; return allows `store_credit` and `exchange` but `Payment` model does not. Completion can fail for these methods.

### FE ↔ BE endpoint mismatches
- `purchaseService` uses `GET /api/suppliers/` expecting API root link discovery; backend at that path is a DRF router root inside suppliers module and is not guaranteed for this discovery pattern.
- Supplier payment calls in FE use `/api/payments/*`, but backend routes are `/api/suppliers/payments/*`.
- FE has invoice item endpoints:
  - `/api/suppliers/supplier-invoices/{id}/items/`
  - `/api/suppliers/supplier-invoices/{id}/items/{itemId}/`
  - These routes are not defined in backend `suppliers/urls.py`.

### FE technical issue
- `src/utils/axiosInstance.ts`: token refresh uses `axios.post('/api/auth/token/refresh/')` (plain axios), so it may bypass configured `baseURL` and fail in non-proxy setups.

### FE completeness note
- Some pages/stores still rely on mock/local state instead of services (example: dashboard store and POS store), so API integration is partial by design.

## 5) Recommended Next Steps

1. Fix backend runtime issues first (`reports`, `inventory` imports, returns payment-method mapping).
2. Standardize procurement routes:
   - Align FE `purchaseService` URLs with `/api/suppliers/*`.
   - Add missing invoice-item nested routes if FE workflow needs independent item ops.
3. Fix axios refresh to use `axiosInstance` (or absolute backend URL with base).
4. Replace remaining mock-store flows with real service-backed data and add a single API contract doc from OpenAPI schema (`/api/schema/`).
