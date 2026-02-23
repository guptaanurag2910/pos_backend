# GoFrugal POS Backend

A comprehensive Django REST API backend for a Point of Sale (POS) system similar to GoFrugal, built with Django and Django REST Framework.

## Features

### 🧾 Billing & Checkout
- Fast billing with support for barcode scanning
- GST-compliant invoices (B2B & B2C)
- Multiple payment modes (Cash, Card, UPI, Wallets, Sodexo)
- Split billing & hold/resume bills
- Loyalty redemption at checkout
- Offline billing support (syncs when back online)

### 📦 Inventory Management
- Real-time stock updates across branches
- Low-stock alerts and reorder management
- Batch number & expiry tracking
- Purchase order management
- Item-wise stock valuation and movement reports

### 📊 Reports & Analytics
- Daily sales reports
- Inventory reports (fast/slow-moving items)
- GST summary and return filing reports
- Customer-wise, item-wise, and cashier-wise reports
- Profit margin and shrinkage tracking

### 👥 Customer Management
- Loyalty program integration (points, discounts)
- Customer database with purchase history
- Personalized promotions
- Referral tracking and birthday discounts

### 🏪 Multi-Store Management
- Centralized control for all stores
- Branch-wise stock transfer and visibility
- Store-wise pricing and promotions
- Real-time sync with HQ

### 🔒 Security & Access Control
- Role-based access (cashier, store manager, owner)
- Transaction logs and audit trails
- Price override restrictions
- Session-based login with shift management

### 💼 Purchase & Supplier Management
- Purchase orders and GRN (Goods Received Note)
- Supplier rate tracking
- Credit purchase management
- Payment reminders and due reports

## API Documentation

The API documentation is available at `/api/docs/` endpoint when the server is running.

## Installation and Setup

1. Clone the repository
2. Install the requirements:

```
pip install -r requirements.txt
```

3. Run migrations:

```
python manage.py migrate
```

4. Create a superuser:

```
python manage.py createsuperuser
```

5. Run the development server:

```
python manage.py runserver
```

## API Endpoints

### Authentication
- `/api/auth/token/` - Get JWT token
- `/api/auth/token/refresh/` - Refresh JWT token
- `/api/auth/logout/` - Logout and blacklist token

### Users
- `/api/auth/users/` - List, create users
- `/api/auth/users/:id/` - Get, update, delete user
- `/api/auth/users/me/` - Get current user
- `/api/auth/users/:id/change_password/` - Change password

### Inventory
- `/api/inventory/categories/` - List, create categories
- `/api/inventory/products/` - List, create products
- `/api/inventory/stock-levels/` - List stock levels
- `/api/inventory/stock-records/` - List stock records
- `/api/inventory/stock-transfers/` - List, create stock transfers

### Sales
- `/api/sales/bills/` - List, create bills
- `/api/sales/bills/:id/complete/` - Complete a bill
- `/api/sales/bills/:id/hold/` - Hold a bill
- `/api/sales/bills/:id/resume/` - Resume a held bill
- `/api/sales/bills/:id/cancel/` - Cancel a bill
- `/api/sales/payments/` - List, create payments

### Customers
- `/api/customers/` - List, create customers
- `/api/customers/:id/purchase_history/` - Get customer purchase history
- `/api/customers/:id/add_points/` - Add loyalty points
- `/api/customers/groups/` - List, create customer groups

### Suppliers
- `/api/suppliers/suppliers/` - List, create suppliers
- `/api/suppliers/purchase-orders/` - List, create purchase orders
- `/api/suppliers/grn/` - List, create goods receipt notes
- `/api/suppliers/payments/` - List, create supplier payments

### Reports
- `/api/reports/dashboard/` - Get dashboard data
- `/api/reports/sales/` - Get sales reports
- `/api/reports/inventory/` - Get inventory reports
- `/api/reports/customers/` - Get customer reports
- `/api/reports/tax/` - Get tax reports

## License

This project is licensed under the MIT License.