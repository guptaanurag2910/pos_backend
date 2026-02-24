# POS Backend API Catalog (Use Cases)

Base URL: `/api/`

## Auth / Accounts (`/api/auth`)
| Endpoint | Methods | Use Case |
|---|---|---|
| `/api/auth/register/` | `POST` | Create new user account (onboarding). |
| `/api/auth/token/` | `POST` | Login and get JWT access/refresh token. |
| `/api/auth/token/refresh/` | `POST` | Refresh expired access token. |
| `/api/auth/logout/` | `POST` | Logout and blacklist refresh token. |
| `/api/auth/users/` | `GET, POST` | List users / create user (admin flow). |
| `/api/auth/users/{id}/` | `GET, PUT, PATCH, DELETE` | View/update/deactivate a user. |
| `/api/auth/users/me/` | `GET` | Get current logged-in user profile. |
| `/api/auth/users/{id}/change_password/` | `POST` | User/admin password change for a specific user. |
| `/api/auth/users/{id}/reset_password/` | `POST` | Admin reset of user password. |
| `/api/auth/users/{id}/force_logout_sessions/` | `POST` | Force logout all active sessions for target user. |
| `/api/auth/sessions/` | `GET` | View active/login session history. |
| `/api/auth/sessions/{id}/` | `GET` | View single session details. |
| `/api/auth/audit-logs/` | `GET` | Audit trail list for operations. |
| `/api/auth/audit-logs/{id}/` | `GET` | Audit trail detail. |

## Stores (`/api/stores`)
| Endpoint | Methods | Use Case |
|---|---|---|
| `/api/stores/` | `GET, POST` | List stores / create new store branch. |
| `/api/stores/{id}/` | `GET, PUT, PATCH, DELETE` | View/update/soft-delete store. |
| `/api/stores/active/` | `GET` | List only active stores. |
| `/api/stores/{id}/activate/` | `POST` | Activate a store. |
| `/api/stores/{id}/deactivate/` | `POST` | Deactivate a store. |
| `/api/stores/{id}/set_main/` | `POST` | Mark one store as main store. |
| `/api/stores/{id}/settings/` | `GET, PUT, PATCH` | Read/update store-level POS settings. |
| `/api/stores/{id}/bootstrap-import/` | `POST` | Upload onboarding file to populate store data (inventory/customers/sales, etc.). |

## Inventory (`/api/inventory`)
| Endpoint | Methods | Use Case |
|---|---|---|
| `/api/inventory/categories/` | `GET, POST` | List/create categories. |
| `/api/inventory/categories/{id}/` | `GET, PUT, PATCH, DELETE` | Manage category. |
| `/api/inventory/products/` | `GET, POST` | List/create products. |
| `/api/inventory/products/{id}/` | `GET, PUT, PATCH, DELETE` | Manage product master. |
| `/api/inventory/products/{id}/stock_levels/` | `GET` | View stock levels for a product (store/batch wise). |
| `/api/inventory/products/{id}/stock_history/` | `GET` | View stock movement history for a product. |
| `/api/inventory/products/{id}/adjust_stock/` | `POST` | Adjust stock for one product/store. |
| `/api/inventory/products/bulk_adjust_stock/` | `POST` | Bulk stock adjustments for many products. |
| `/api/inventory/stock-records/` | `GET` | Read stock movement ledger (purchase/sale/transfer/return). |
| `/api/inventory/stock-records/{id}/` | `GET` | Read one stock movement entry. |
| `/api/inventory/stock-levels/` | `GET` | Read current stock levels. |
| `/api/inventory/stock-levels/{id}/` | `GET` | Read one stock level row. |
| `/api/inventory/stock-levels/low_stock/` | `GET` | List low-stock items for alerts. |
| `/api/inventory/stock-levels/reconcile/` | `POST` | Reconcile physical vs system stock. |
| `/api/inventory/stock-transfers/` | `GET, POST` | List/create inter-store transfers. |
| `/api/inventory/stock-transfers/{id}/` | `GET, PUT, PATCH, DELETE` | Manage transfer header. |
| `/api/inventory/stock-transfers/{id}/approve/` | `POST` | Approve pending transfer (receiving store/admin). |
| `/api/inventory/stock-transfers/{id}/update_status/` | `POST` | Move transfer through lifecycle (in_transit/completed/cancelled). |
| `/api/inventory/stock-transfers/{transfer_id}/items/` | `GET, POST` | List/add transfer line items. |
| `/api/inventory/stock-transfers/{transfer_id}/items/{id}/` | `GET, PUT, PATCH, DELETE` | Manage transfer line item. |
| `/api/inventory/uploads/` | `GET, POST` | Upload inventory file and optionally process immediately. |
| `/api/inventory/uploads/{id}/` | `GET, PUT, PATCH, DELETE` | Manage uploaded file record. |

## Sales / Billing (`/api/sales`)
| Endpoint | Methods | Use Case |
|---|---|---|
| `/api/sales/bills/` | `GET, POST` | List bills / create new bill draft. |
| `/api/sales/bills/{id}/` | `GET, PUT, PATCH, DELETE` | View/update/delete bill. |
| `/api/sales/bills/{id}/complete/` | `POST` | Complete bill, finalize sale, deduct stock. |
| `/api/sales/bills/{id}/validate_payment_split/` | `POST` | Validate multi-mode payment split equals bill total. |
| `/api/sales/bills/{id}/receipt/` | `GET, POST` | Get bill receipt / mark reprint. |
| `/api/sales/bills/{id}/cancel/` | `POST` | Cancel non-completed bill. |
| `/api/sales/bills/{id}/hold/` | `POST` | Put draft bill on hold. |
| `/api/sales/bills/{id}/resume/` | `POST` | Resume on-hold bill back to draft. |
| `/api/sales/bills/{bill_id}/items/` | `GET, POST` | List/add bill items. |
| `/api/sales/bills/{bill_id}/items/{id}/` | `GET, PUT, PATCH, DELETE` | Manage bill line item. |
| `/api/sales/payments/` | `GET, POST` | List/create payment records. |
| `/api/sales/payments/{id}/` | `GET, PUT, PATCH, DELETE` | Manage payment record. |
| `/api/sales/payments/{id}/refund/` | `POST` | Refund a completed payment (creates negative payment entry). |

## Returns (`/api/return`)
| Endpoint | Methods | Use Case |
|---|---|---|
| `/api/return/` | `GET, POST` | List/create return request for bill. |
| `/api/return/{id}/` | `GET, PUT, PATCH, DELETE` | View/update/soft-delete return entry. |
| `/api/return/{id}/approve/` | `POST` | Approve pending return. |
| `/api/return/{id}/reject/` | `POST` | Reject pending return with reason. |
| `/api/return/{id}/complete/` | `POST` | Complete approved return, stock-in and refund posting. |

## Customers (`/api/customers`)
| Endpoint | Methods | Use Case |
|---|---|---|
| `/api/customers/` | `GET, POST` | List/create customer. |
| `/api/customers/{id}/` | `GET, PUT, PATCH, DELETE` | View/update/soft-delete customer. |
| `/api/customers/{id}/purchase_history/` | `GET` | Fetch customer bill history. |
| `/api/customers/{id}/add_points/` | `POST` | Add/deduct loyalty points manually. |
| `/api/customers/stats/` | `GET` | Customer KPIs (new/active/top). |
| `/api/customers/merge/` | `POST` | Merge duplicate customer profiles. |
| `/api/customers/groups/` | `GET, POST` | List/create customer groups. |
| `/api/customers/groups/{id}/` | `GET, PUT, PATCH, DELETE` | Manage customer group. |
| `/api/customers/groups/{id}/add_customers/` | `POST` | Bulk add customers to a group. |
| `/api/customers/groups/{id}/remove_customers/` | `POST` | Bulk remove customers from a group. |

## Suppliers / Purchase (`/api/suppliers`)
| Endpoint | Methods | Use Case |
|---|---|---|
| `/api/suppliers/suppliers/` | `GET, POST` | List/create supplier master. |
| `/api/suppliers/suppliers/{id}/` | `GET, PUT, PATCH, DELETE` | Manage supplier. |
| `/api/suppliers/suppliers/{id}/purchase_history/` | `GET` | Supplier-wise PO history. |
| `/api/suppliers/suppliers/{id}/payment_history/` | `GET` | Supplier-wise payment history. |
| `/api/suppliers/purchase-orders/` | `GET, POST` | List/create purchase orders. |
| `/api/suppliers/purchase-orders/{id}/` | `GET, PUT, PATCH, DELETE` | Manage PO header. |
| `/api/suppliers/purchase-orders/{id}/update_status/` | `POST` | Update PO status (draft/sent/received/cancelled). |
| `/api/suppliers/purchase-orders/{po_id}/items/` | `GET, POST` | List/add PO items. |
| `/api/suppliers/purchase-orders/{po_id}/items/{id}/` | `GET, PUT, PATCH, DELETE` | Manage PO item. |
| `/api/suppliers/grn/` | `GET, POST` | List/create Goods Receipt Note. |
| `/api/suppliers/grn/{id}/` | `GET, PUT, PATCH, DELETE` | Manage GRN header. |
| `/api/suppliers/grn/{id}/complete/` | `POST` | Complete GRN and update stock + PO receipt qty. |
| `/api/suppliers/grn/{grn_id}/items/` | `GET, POST` | List/add GRN items. |
| `/api/suppliers/grn/{grn_id}/items/{id}/` | `GET, PUT, PATCH, DELETE` | Manage GRN item. |
| `/api/suppliers/supplier-invoices/` | `GET, POST` | List/create supplier invoices. |
| `/api/suppliers/supplier-invoices/{id}/` | `GET, PUT, PATCH, DELETE` | Manage supplier invoice header. |
| `/api/suppliers/supplier-invoices/{id}/update_status/` | `POST` | Update supplier invoice status lifecycle. |
| `/api/suppliers/supplier-invoices/{invoice_id}/items/` | `GET, POST` | List/add supplier invoice items. |
| `/api/suppliers/supplier-invoices/{invoice_id}/items/{id}/` | `GET, PUT, PATCH, DELETE` | Manage supplier invoice item. |
| `/api/suppliers/payments/` | `GET, POST` | List/create supplier payments. |
| `/api/suppliers/payments/{id}/` | `GET, PUT, PATCH, DELETE` | Manage supplier payment record. |

## Reports (`/api/reports`)
| Endpoint | Methods | Use Case |
|---|---|---|
| `/api/reports/dashboard/` | `GET` | Full analytics dashboard data (KPIs + charts + lists). |
| `/api/reports/dashboard/analytics/` | `GET` | Alias of dashboard endpoint for FE compatibility. |
| `/api/reports/dashboard/export-bootstrap/` | `GET` | Export current store data in bootstrap-style Excel. |
| `/api/reports/sales/` | `GET` | Sales report aggregates and trends. |
| `/api/reports/inventory/` | `GET` | Inventory report (stock levels, valuation, alerts). |
| `/api/reports/customers/` | `GET` | Customer analytics report. |
| `/api/reports/tax/` | `GET` | Tax summary report for filing/reconciliation. |

## API Docs
| Endpoint | Methods | Use Case |
|---|---|---|
| `/api/schema/` | `GET` | OpenAPI schema JSON. |
| `/api/docs/` | `GET` | Swagger UI interactive docs. |
| `/api/redoc/` | `GET` | ReDoc API docs. |
