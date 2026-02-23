import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Search } from 'lucide-react';
import { usePOSStore } from '../../../stores/posStore';

interface PurchaseOrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  discountType: 'percentage' | 'amount';
  taxRate: number;
  total: number;
}

interface PurchaseOrder {
  id?: string;
  poNumber: string;
  supplierName: string;
  supplierContact: string;
  orderDate: string;
  expectedDeliveryDate: string;
  status: 'draft' | 'pending' | 'approved' | 'sent';
  items: PurchaseOrderItem[];
  subtotal: number;
  taxTotal: number;
  shippingCharges: number;
  grandTotal: number;
  terms: string;
  notes: string;
}

interface PurchaseOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (order: PurchaseOrder) => void;
  initialData?: PurchaseOrder;
}

const PurchaseOrderModal = ({ isOpen, onClose, onSave, initialData }: PurchaseOrderModalProps) => {
  const { products } = usePOSStore();
  const [formData, setFormData] = useState<PurchaseOrder>({
    poNumber: `PO-${Date.now().toString().slice(-6)}`,
    supplierName: '',
    supplierContact: '',
    orderDate: new Date().toISOString().split('T')[0],
    expectedDeliveryDate: '',
    status: 'draft',
    items: [],
    subtotal: 0,
    taxTotal: 0,
    shippingCharges: 0,
    grandTotal: 0,
    terms: 'Net 30 days',
    notes: ''
  });

  const [showProductSearch, setShowProductSearch] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  useEffect(() => {
    calculateTotals();
  }, [formData.items, formData.shippingCharges]);

  const calculateTotals = () => {
    const subtotal = formData.items.reduce((sum, item) => {
      const baseAmount = item.quantity * item.unitPrice;
      const discountAmount = item.discountType === 'percentage' 
        ? (baseAmount * item.discount) / 100 
        : item.discount;
      return sum + (baseAmount - discountAmount);
    }, 0);

    const taxTotal = formData.items.reduce((sum, item) => {
      const baseAmount = item.quantity * item.unitPrice;
      const discountAmount = item.discountType === 'percentage' 
        ? (baseAmount * item.discount) / 100 
        : item.discount;
      const discountedAmount = baseAmount - discountAmount;
      return sum + (discountedAmount * item.taxRate) / 100;
    }, 0);

    const grandTotal = subtotal + taxTotal + formData.shippingCharges;

    setFormData(prev => ({
      ...prev,
      subtotal,
      taxTotal,
      grandTotal
    }));
  };

  const handleInputChange = (field: keyof PurchaseOrder, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addProductToOrder = (product: any) => {
    const newItem: PurchaseOrderItem = {
      id: `item_${Date.now()}`,
      productId: product.id,
      productName: product.name,
      quantity: 1,
      unitPrice: product.price,
      discount: 0,
      discountType: 'percentage',
      taxRate: product.tax,
      total: product.price
    };

    setFormData(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
    setShowProductSearch(false);
    setProductSearchQuery('');
  };

  const updateItem = (index: number, field: keyof PurchaseOrderItem, value: any) => {
    const updatedItems = [...formData.items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    
    // Recalculate item total
    const item = updatedItems[index];
    const baseAmount = item.quantity * item.unitPrice;
    const discountAmount = item.discountType === 'percentage' 
      ? (baseAmount * item.discount) / 100 
      : item.discount;
    const discountedAmount = baseAmount - discountAmount;
    const taxAmount = (discountedAmount * item.taxRate) / 100;
    item.total = discountedAmount + taxAmount;

    setFormData(prev => ({ ...prev, items: updatedItems }));
  };

  const removeItem = (index: number) => {
    const updatedItems = formData.items.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, items: updatedItems }));
  };

  const handleSave = () => {
    if (!formData.supplierName || formData.items.length === 0) {
      alert('Please fill in supplier name and add at least one item');
      return;
    }
    onSave(formData);
    onClose();
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
    product.barcode.includes(productSearchQuery)
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-6xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between border-b dark:border-gray-700 px-6 py-4">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
            {initialData ? 'Edit Purchase Order' : 'New Purchase Order'}
          </h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Header Information */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                PO Number
              </label>
              <input
                type="text"
                value={formData.poNumber}
                onChange={(e) => handleInputChange('poNumber', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Order Date
              </label>
              <input
                type="date"
                value={formData.orderDate}
                onChange={(e) => handleInputChange('orderDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Expected Delivery
              </label>
              <input
                type="date"
                value={formData.expectedDeliveryDate}
                onChange={(e) => handleInputChange('expectedDeliveryDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Supplier Name *
              </label>
              <input
                type="text"
                value={formData.supplierName}
                onChange={(e) => handleInputChange('supplierName', e.target.value)}
                placeholder="Enter supplier name"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Supplier Contact
              </label>
              <input
                type="text"
                value={formData.supplierContact}
                onChange={(e) => handleInputChange('supplierContact', e.target.value)}
                placeholder="Phone/Email"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => handleInputChange('status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
              >
                <option value="draft">Draft</option>
                <option value="pending">Pending Approval</option>
                <option value="approved">Approved</option>
                <option value="sent">Sent to Supplier</option>
              </select>
            </div>
          </div>

          {/* Items Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100">Order Items</h3>
              <button
                onClick={() => setShowProductSearch(true)}
                className="flex items-center px-4 py-2 bg-primary-600 dark:bg-primary-500 text-white rounded-lg hover:bg-primary-700 dark:hover:bg-primary-600"
              >
                <Plus size={16} className="mr-2" />
                Add Product
              </button>
            </div>

            {/* Product Search Modal */}
            {showProductSearch && (
              <div className="mb-4 p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-800 dark:text-gray-100">Search Products</h4>
                  <button
                    onClick={() => setShowProductSearch(false)}
                    className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    <X size={16} />
                  </button>
                </div>
                
                <div className="relative mb-3">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search size={16} className="text-gray-400 dark:text-gray-500" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search by product name or barcode..."
                    value={productSearchQuery}
                    onChange={(e) => setProductSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
                  />
                </div>

                <div className="max-h-40 overflow-y-auto">
                  {filteredProducts.map(product => (
                    <div
                      key={product.id}
                      onClick={() => addProductToOrder(product)}
                      className="flex items-center justify-between p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer rounded"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{product.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {product.barcode} • Stock: {product.stock}
                        </p>
                      </div>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">₹{product.price}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Items Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Product</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Qty</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Unit Price</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Discount</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tax %</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total</th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {formData.items.map((item, index) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{item.productName}</td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                          className="w-16 px-2 py-1 text-center border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded text-sm text-gray-900 dark:text-gray-100"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                          className="w-20 px-2 py-1 text-right border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded text-sm text-gray-900 dark:text-gray-100"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end">
                          <input
                            type="number"
                            min="0"
                            value={item.discount}
                            onChange={(e) => updateItem(index, 'discount', parseFloat(e.target.value) || 0)}
                            className="w-16 px-2 py-1 text-right border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded text-sm text-gray-900 dark:text-gray-100"
                          />
                          <select
                            value={item.discountType}
                            onChange={(e) => updateItem(index, 'discountType', e.target.value)}
                            className="ml-1 px-1 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded text-xs text-gray-900 dark:text-gray-100"
                          >
                            <option value="percentage">%</option>
                            <option value="amount">₹</option>
                          </select>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={item.taxRate}
                          onChange={(e) => updateItem(index, 'taxRate', parseFloat(e.target.value) || 0)}
                          className="w-16 px-2 py-1 text-right border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded text-sm text-gray-900 dark:text-gray-100"
                        />
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-gray-100">
                        ₹{item.total.toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => removeItem(index)}
                          className="text-error-600 dark:text-error-400 hover:text-error-800 dark:hover:text-error-300"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {formData.items.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No items added yet. Click "Add Product" to start building your order.
                </div>
              )}
            </div>
          </div>

          {/* Summary and Additional Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">Order Summary</h3>
              <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Subtotal:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">₹{formData.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Tax Total:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">₹{formData.taxTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Shipping:</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.shippingCharges}
                    onChange={(e) => handleInputChange('shippingCharges', parseFloat(e.target.value) || 0)}
                    className="w-20 px-2 py-1 text-right border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded text-sm text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div className="border-t dark:border-gray-700 pt-3 flex justify-between">
                  <span className="text-base font-semibold text-gray-700 dark:text-gray-300">Grand Total:</span>
                  <span className="text-base font-bold text-primary-700 dark:text-primary-400">₹{formData.grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">Additional Information</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Terms & Conditions
                  </label>
                  <textarea
                    value={formData.terms}
                    onChange={(e) => handleInputChange('terms', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
                    placeholder="Payment terms, delivery conditions, etc."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
                    placeholder="Additional notes or special instructions"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t dark:border-gray-700 px-6 py-4 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-primary-600 dark:bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-700 dark:hover:bg-primary-600"
          >
            {initialData ? 'Update Order' : 'Create Order'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PurchaseOrderModal;