import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Upload } from 'lucide-react';

interface SupplierInvoiceItem {
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

interface SupplierInvoice {
  id?: string;
  invoiceNumber: string;
  supplierInvoiceNumber: string;
  poNumber: string;
  grnNumber?: string;
  supplierName: string;
  invoiceDate: string;
  dueDate: string;
  status: 'draft' | 'verified' | 'approved' | 'paid';
  items: SupplierInvoiceItem[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  shippingCharges: number;
  grandTotal: number;
  paymentTerms: string;
  notes: string;
}

interface SupplierInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (invoice: SupplierInvoice) => void | Promise<void | boolean>;
  initialData?: SupplierInvoice;
  poData?: any;
  grnData?: any;
}

const SupplierInvoiceModal = ({ isOpen, onClose, onSave, initialData, poData, grnData }: SupplierInvoiceModalProps) => {
  const [formData, setFormData] = useState<SupplierInvoice>({
    invoiceNumber: `SI-${Date.now().toString().slice(-6)}`,
    supplierInvoiceNumber: '',
    poNumber: '',
    grnNumber: '',
    supplierName: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    status: 'draft',
    items: [],
    subtotal: 0,
    discountTotal: 0,
    taxTotal: 0,
    shippingCharges: 0,
    grandTotal: 0,
    paymentTerms: 'Net 30',
    notes: ''
  });

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else if (poData || grnData) {
      const sourceData = grnData || poData;
      setFormData(prev => ({
        ...prev,
        poNumber: sourceData.poNumber,
        grnNumber: grnData?.grnNumber || '',
        supplierName: sourceData.supplierName,
        items: sourceData.items.map((item: any) => ({
          id: `inv_item_${Date.now()}_${Math.random()}`,
          productId: item.productId,
          productName: item.productName,
          quantity: grnData ? item.acceptedQuantity : item.quantity,
          unitPrice: item.unitPrice || 0,
          discount: 0,
          discountType: 'percentage' as const,
          taxRate: item.taxRate || 18,
          total: 0
        }))
      }));
    }
  }, [initialData, poData, grnData]);

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

    const discountTotal = formData.items.reduce((sum, item) => {
      const baseAmount = item.quantity * item.unitPrice;
      const discountAmount = item.discountType === 'percentage' 
        ? (baseAmount * item.discount) / 100 
        : item.discount;
      return sum + discountAmount;
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
      discountTotal,
      taxTotal,
      grandTotal
    }));
  };

  const handleInputChange = (field: keyof SupplierInvoice, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const updateItem = (index: number, field: keyof SupplierInvoiceItem, value: any) => {
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

  const calculateDueDate = (invoiceDate: string, terms: string) => {
    const date = new Date(invoiceDate);
    const daysToAdd = terms === 'Immediate' ? 0 : 
                     terms === 'Net 15' ? 15 : 
                     terms === 'Net 30' ? 30 : 
                     terms === 'Net 60' ? 60 : 30;
    
    date.setDate(date.getDate() + daysToAdd);
    return date.toISOString().split('T')[0];
  };

  useEffect(() => {
    if (formData.invoiceDate && formData.paymentTerms) {
      const newDueDate = calculateDueDate(formData.invoiceDate, formData.paymentTerms);
      setFormData(prev => ({ ...prev, dueDate: newDueDate }));
    }
  }, [formData.invoiceDate, formData.paymentTerms]);

  const handleSave = async () => {
    if (!formData.supplierInvoiceNumber || !formData.supplierName || formData.items.length === 0) {
      alert('Please fill in supplier invoice number, supplier name, and add at least one item');
      return;
    }
    const result = await Promise.resolve(onSave(formData));
    if (result === false) return;
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-6xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between border-b dark:border-gray-700 px-6 py-4">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
            {initialData ? 'Edit Supplier Invoice' : 'New Supplier Invoice'}
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
                Our Invoice Number
              </label>
              <input
                type="text"
                value={formData.invoiceNumber}
                onChange={(e) => handleInputChange('invoiceNumber', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Supplier Invoice Number *
              </label>
              <input
                type="text"
                value={formData.supplierInvoiceNumber}
                onChange={(e) => handleInputChange('supplierInvoiceNumber', e.target.value)}
                placeholder="Supplier's invoice number"
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
                <option value="verified">Verified</option>
                <option value="approved">Approved</option>
                <option value="paid">Paid</option>
              </select>
            </div>

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
                GRN Number
              </label>
              <input
                type="text"
                value={formData.grnNumber || ''}
                onChange={(e) => handleInputChange('grnNumber', e.target.value)}
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
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Invoice Date
              </label>
              <input
                type="date"
                value={formData.invoiceDate}
                onChange={(e) => handleInputChange('invoiceDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Payment Terms
              </label>
              <select
                value={formData.paymentTerms}
                onChange={(e) => handleInputChange('paymentTerms', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
              >
                <option value="Immediate">Immediate</option>
                <option value="Net 15">Net 15</option>
                <option value="Net 30">Net 30</option>
                <option value="Net 60">Net 60</option>
                <option value="Credit">Credit</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Due Date
              </label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) => handleInputChange('dueDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>

          {/* Items Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100">Invoice Items</h3>
              <div className="flex space-x-2">
                <button className="flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                  <Upload size={16} className="mr-2" />
                  Import from PO/GRN
                </button>
              </div>
            </div>
            
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
                  No items added yet. Import from PO/GRN or add items manually.
                </div>
              )}
            </div>
          </div>

          {/* Summary and Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">Invoice Summary</h3>
              <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Subtotal:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">₹{formData.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Discount Total:</span>
                  <span className="font-medium text-error-600 dark:text-error-400">-₹{formData.discountTotal.toFixed(2)}</span>
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
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">Notes</h3>
              <textarea
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
                placeholder="Additional notes, terms, or special instructions"
              />
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
            {initialData ? 'Update Invoice' : 'Create Invoice'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SupplierInvoiceModal;