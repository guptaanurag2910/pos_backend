"""
Component Breakdown:
1. PurchaseInvoiceHeader
Handles invoice details (number, date, supplier, PO/GRN numbers)
Clean form layout with proper icons and validation
Reusable and focused on header information only
2. PurchaseItemForm
Dedicated component for adding new items
Compact grid layout for all item fields
Handles validation and form submission
3. PurchaseItemsList
Displays items in a clean table format
Inline editing capabilities for all fields
Empty state with helpful messaging
Individual item actions (remove, edit)
4. PurchaseInvoiceSummary
Calculates and displays all totals
Editable shipping charges
Clean financial summary layout
5. PurchasePaymentDetails
Payment terms and status management
Notes and reference tracking
Visual status indicators
6. PurchasePaymentModal
Dedicated modal for recording payments
Form validation and submission
Clean, focused interface
7. PurchaseActionButtons
All action buttons in one component
Proper state management for disabled states
Consistent styling and layout

"""