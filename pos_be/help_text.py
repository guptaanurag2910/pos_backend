# CREATE USER pos_1 WITH PASSWORD pos_1;
# CREATE USER pos_1 WITH PASSWORD 'pos_1';
# GRANT ALL PRIVILEGES ON DATABASE pos_1 TO pos_1;

# python manage.py makemigrations
# python manage.py migrate

# python manage.py createsuperuser

# python manage.py seed_customers --count 100
# python manage.py seed_customergroups --count 10

# python manage.py populate_stores --stores 10 --users 5

# python manage.py import_from_merged_excel ./inventory/management/commands/merged_product_data.xlsx

"""
✅ BillViewSet Endpoints
Django API URL	React Service Method	Exists?
POST /api/sales/bills/	createBill()	✅ Yes
GET /api/sales/bills/:id/	getBill()	✅ Yes
POST /api/sales/bills/:id/complete/	completeBill()	✅ Yes
POST /api/sales/bills/:id/cancel/	cancelBill()	✅ Yes
POST /api/sales/bills/:id/hold/	holdBill()	✅ Yes
POST /api/sales/bills/:id/resume/	resumeBill()	✅ Yes
DELETE /api/sales/bills/:id/	deleteBill()	✅ Yes
GET /api/sales/bills/	listBills()	✅ Yes


BillItemViewSet (Nested under Bill)
Django API URL	React Service Method	Exists?
POST /api/sales/bills/:bill_id/items/	addBillItem()	✅ Yes
PUT /api/sales/bills/:bill_id/items/:item_id/	updateBillItem()	✅ Yes
DELETE /api/sales/bills/:bill_id/items/:item_id/	deleteBillItem()	✅ Yes


PaymentViewSet Endpoints
Django API URL	React Service Method	Exists?
POST /api/sales/payments/	addPayment()	✅ Yes
POST /api/sales/payments/:payment_id/refund/	refundPayment()	✅ Yes
GET /api/sales/payments/	listPayments()	✅ Yes

"""


"""
Here's a detailed list of all the APIs (endpoints) available in your supplier & procurement system, categorized by entity, with their respective paths, methods, and use cases:

🔸 1. Supplier APIs
Base URL: /suppliers/

Method	Endpoint	Purpose
GET	/suppliers/	List all suppliers (with filters like city, state, is_active)
POST	/suppliers/	Create a new supplier
GET	/suppliers/{id}/	Retrieve supplier details
PUT	/suppliers/{id}/	Update full supplier details
PATCH	/suppliers/{id}/	Partially update supplier
DELETE	/suppliers/{id}/	Delete (or deactivate) a supplier
GET	/suppliers/{id}/purchase_history/	View purchase orders of this supplier
GET	/suppliers/{id}/payment_history/	View all payments made to this supplier

🔸 2. Purchase Order APIs
Base URL: /purchase-orders/

Method	Endpoint	Purpose
GET	/purchase-orders/	List all purchase orders (filter by supplier, status, date)
POST	/purchase-orders/	Create a new purchase order (PO number auto-generated)
GET	/purchase-orders/{id}/	Retrieve details of a specific PO (detailed serializer used)
PUT / PATCH	/purchase-orders/{id}/	Update a purchase order
DELETE	/purchase-orders/{id}/	Delete a purchase order
POST	/purchase-orders/{id}/update_status/	Update PO status (e.g., draft → sent, sent → cancelled)

🔹 2.1. Purchase Order Item APIs (Nested)
Base URL: /purchase-orders/{po_id}/items/

Method	Endpoint	Purpose
GET	/purchase-orders/{po_id}/items/	List all items in a PO
POST	/purchase-orders/{po_id}/items/	Add a new item to the PO
GET	/purchase-orders/{po_id}/items/{item_id}/	View a specific item
PUT / PATCH	/purchase-orders/{po_id}/items/{item_id}/	Update item details
DELETE	/purchase-orders/{po_id}/items/{item_id}/	Remove item from PO (if draft/sent)

🔸 3. Goods Receipt Note (GRN) APIs
Base URL: /grn/

Method	Endpoint	Purpose
GET	/grn/	List all GRNs (filter by supplier, date, PO, etc.)
POST	/grn/	Create a new GRN (GRN number auto-generated)
GET	/grn/{id}/	Retrieve GRN details (detailed serializer used)
PUT / PATCH	/grn/{id}/	Update a GRN
DELETE	/grn/{id}/	Delete a GRN
POST	/grn/{id}/complete/	Mark GRN as completed, update inventory & PO status

🔹 3.1. GRN Item APIs (Nested)
Base URL: /grn/{grn_id}/items/

Method	Endpoint	Purpose
GET	/grn/{grn_id}/items/	List items in a GRN
POST	/grn/{grn_id}/items/	Add a new item to the GRN
GET	/grn/{grn_id}/items/{item_id}/	View a specific item
PUT / PATCH	/grn/{grn_id}/items/{item_id}/	Update GRN item
DELETE	/grn/{grn_id}/items/{item_id}/	Delete GRN item

🔸 4. Supplier Payment APIs
Base URL: /payments/

Method	Endpoint	Purpose
GET	/payments/	List all supplier payments (filter by supplier, PO, method)
POST	/payments/	Record a new payment (updates PO and supplier balance if completed)
GET	/payments/{id}/	View payment details
PUT / PATCH	/payments/{id}/	Update payment record
DELETE	/payments/{id}/	Cancel or delete a payment

✅ Summary of Features per API
Module	Create	View	Update	Delete	Extra Actions
Supplier	✅	✅	✅	✅	purchase_history, payment_history
PurchaseOrder	✅	✅	✅	✅	update_status
PurchaseOrderItem	✅	✅	✅	✅	-
GRN	✅	✅	✅	✅	complete
GRN Item	✅	✅	✅	✅	-
SupplierPayment	✅	✅	✅	✅	Balance update, PO sync
"""


