import { useState, useEffect } from 'react';
import { X, Search, RotateCcw, Package } from 'lucide-react';
import { Bill } from '../../types';
import { CreateReturnPayload, ReturnItemPayload } from '../../service/returnsService';
import { listBills, getBill } from '../../service/salesService';

interface ReturnItem {
  id: string;
  productId: string;
  productName: string;
  originalQuantity: number;
  returnQuantity: number;
  unitPrice: number;
  tax: number;
  reason: string;
  condition: 'good' | 'damaged' | 'defective' | 'expired';
  refundAmount: number;
}

interface ReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: CreateReturnPayload) => void;
}

const ReturnModal = ({ isOpen, onClose, onSave }: ReturnModalProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [step, setStep] = useState<'select_bill' | 'process_return'>('select_bill');
  const [bills, setBills] = useState<Bill[]>([]);
  const [formData, setFormData] = useState({
    originalBillNumber: '',
    originalBillId: '',
    customerName: '',
    customerId: '',
    returnDate: new Date().toISOString().split('T')[0],
    reason: '',
    items: [] as ReturnItem[],
    subtotal: 0,
    taxTotal: 0,
    refundAmount: 0,
    refundMethod: 'cash' as 'cash' | 'card' | 'store_credit' | 'exchange',
    notes: '',
  });
  const [message, setMessage] = useState('');
  const [showMessageModal, setShowMessageModal] = useState(false);

  useEffect(() => {
    if (isOpen && step === 'select_bill') fetchBills();
  }, [isOpen, step]);

  const fetchBills = async () => {
    try {
      const res = await listBills({ status: 'completed' });
      setBills(res.results || []);
    } catch (err) {
      console.error('Failed to load bills:', err);
    }
  };

  const handleSelectBill = async (bill: Bill) => {
    try {
      const fullBill = await getBill(bill.id);
      setFormData((prev) => ({
        ...prev,
        originalBillNumber: fullBill.bill_number,
        originalBillId: String(fullBill.id),
        customerName: fullBill.customer_name,
        customerId: fullBill.customer_id,
        items: fullBill.items.map((item: any) => ({
          id: `ret_${item.id}`,
          productId: item.product,
          productName: item.product_name,
          originalQuantity: parseFloat(item.quantity),
          returnQuantity: 0,
          unitPrice: parseFloat(item.price),
          tax: parseFloat(item.tax_rate),
          reason: '',
          condition: 'good',
          refundAmount: 0,
        })),
      }));
      setStep('process_return');
    } catch (err) {
      console.error('Failed to fetch bill details:', err);
    }
  };

  useEffect(() => {
    calculateTotals();
  }, [formData.items]);

  const calculateTotals = () => {
    const subtotal = formData.items.reduce((sum, item) => sum + item.returnQuantity * item.unitPrice, 0);
    const taxTotal = formData.items.reduce((sum, item) => sum + (item.returnQuantity * item.unitPrice * item.tax) / 100, 0);
    setFormData((prev) => ({ ...prev, subtotal, taxTotal, refundAmount: subtotal + taxTotal }));
  };

  const updateReturnItem = (index: number, field: keyof ReturnItem, value: any) => {
    const updatedItems = [...formData.items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };

    if (field === 'returnQuantity') {
      const item = updatedItems[index];
      const itemSubtotal = item.returnQuantity * item.unitPrice;
      const itemTax = (itemSubtotal * item.tax) / 100;
      updatedItems[index].refundAmount = itemSubtotal + itemTax;
    }

    setFormData((prev) => ({ ...prev, items: updatedItems }));
  };

  const handleInputChange = (field: keyof typeof formData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
  const returnItems: ReturnItemPayload[] = formData.items
    .filter((item) => item.returnQuantity > 0)
    .map((item) => ({
      bill_item: parseInt(item.id.replace('ret_', '')),
      product: parseInt(item.productId) || null,
      original_quantity: item.originalQuantity,
      return_quantity: item.returnQuantity,
      unit_price: item.unitPrice,
      tax: item.tax,
      reason: item.reason.trim(),
      condition: item.condition,
      refund_amount: item.refundAmount,
    }));

  if (returnItems.length === 0) {
    setMessage('Please select at least one item to return.');
    setShowMessageModal(true);
    return;
  }

  if (!formData.reason.trim()) {
    setMessage('Please provide an overall return reason.');
    setShowMessageModal(true);
    return;
  }

  if (!formData.returnDate) {
    setMessage('Please select a return date.');
    setShowMessageModal(true);
    return;
  }

  for (const item of returnItems) {
    if (!item.product || isNaN(item.product)) {
      setMessage('One or more return items are missing a valid product ID.');
      setShowMessageModal(true);
      return;
    }
    if (!item.reason) {
      setMessage('Each returned item must have a reason.');
      setShowMessageModal(true);
      return;
    }
  }

  const payload: CreateReturnPayload = {
  bill: parseInt(formData.originalBillId),
  return_type: returnItems.length === formData.items.length ? 'full' : 'partial',
  reason: formData.reason,
  subtotal: parseFloat(formData.subtotal.toFixed(2)),
  tax_total: parseFloat(formData.taxTotal.toFixed(2)),
  refund_amount: parseFloat(formData.refundAmount.toFixed(2)),
  refund_method: formData.refundMethod,
  return_date: formData.returnDate,
  notes: formData.notes,
  customer_name: formData.customerName,
  customer_id: formData.customerId,
  items: returnItems.map((item) => ({
    ...item,
    refund_amount: parseFloat(item.refund_amount.toFixed(2)),
  })),
};

  onSave(payload);
  onClose();
  resetForm();
};

  const resetForm = () => {
    setFormData({
      originalBillNumber: '',
      originalBillId: '',
      customerName: '',
      customerId: '',
      returnDate: new Date().toISOString().split('T')[0],
      reason: '',
      items: [],
      subtotal: 0,
      taxTotal: 0,
      refundAmount: 0,
      refundMethod: 'cash',
      notes: '',
    });
    setSearchQuery('');
    setStep('select_bill');
  };

  const filteredBills = bills.filter(
    (bill) =>
      bill.bill_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bill.customer_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'good': return 'text-success-600 dark:text-success-400';
      case 'damaged': return 'text-warning-600 dark:text-warning-400';
      case 'defective': return 'text-error-600 dark:text-error-400';
      case 'expired': return 'text-error-600 dark:text-error-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-6xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between border-b dark:border-gray-700 px-6 py-4">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
            {step === 'select_bill' ? 'Select Bill for Return' : 'Process Return'}
          </h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
            <X size={20} />
          </button>
        </div>

        {showMessageModal && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Alert</h3>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-6">{message}</p>
              <div className="flex justify-end">
                <button
                  onClick={() => setShowMessageModal(false)}
                  className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6">
          {step === 'select_bill' ? (
            <div>
              {/* Bill Search */}
              <div className="mb-6">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search size={18} className="text-gray-400 dark:text-gray-500" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search by bill number or customer name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>

              {/* Bills List */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredBills.map(bill => (
                  <div
                    key={bill.id}
                    onClick={() => handleSelectBill(bill)}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-primary-500 dark:hover:border-primary-400 cursor-pointer transition-colors"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-800 dark:text-gray-100">{bill.bill_number}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {new Date(bill.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="text-lg font-bold text-primary-700 dark:text-primary-400">
                        ₹{parseFloat(bill.total || '0').toFixed(2)}
                      </span>
                    </div>

                    <div className="mb-3">
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        <span className="font-medium">Customer:</span> {bill.customer_name || 'Walk-in Customer'}
                      </p>
                      <div className="space-y-1">
                        {Array.isArray(bill.items)
                          ? bill.items.slice(0, 2).map(item => (
                              <div key={item.id} className="text-xs text-gray-500 dark:text-gray-400 flex justify-between">
                                <span>{item.productName} x{item.quantity}</span>
                                <span>₹{parseFloat(item.total || '0').toFixed(2)}</span>
                              </div>
                            ))
                          : <div className="text-xs text-gray-400 dark:text-gray-500 italic">No items</div>}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        <span className="font-medium">Payment:</span> {bill.payment_method}
                      </p>
                    </div>

                    <div className="space-y-1">
                      {Array.isArray(bill.items) ? bill.items.slice(0, 2).map(item => (
                            <div key={item.id} className="text-xs text-gray-500 dark:text-gray-400 flex justify-between">
                              <span>{item.productName} x{item.quantity}</span>
                              <span>₹{parseFloat(item.total || '0').toFixed(2)}</span>
                            </div>
                          )) : (
                            <div className="text-xs text-gray-400 dark:text-gray-500 italic">No items</div>
                          )}
                      {Array.isArray(bill.items) && bill.items.length > 2 && (
                        <div className="text-xs text-gray-400 dark:text-gray-500 italic">
                          +{bill.items.length - 2} more items
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {filteredBills.length === 0 && (
                <div className="text-center py-12">
                  <div className="h-16 w-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center text-gray-400 dark:text-gray-500 mx-auto mb-4">
                    <RotateCcw size={32} />
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 font-medium">No bills found</p>
                  <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
                    {searchQuery ? 'Try a different search term' : 'No completed bills available for returns'}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div>
              {/* Return Header */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Original Bill
                  </label>
                  <input
                    type="text"
                    value={formData.originalBillNumber}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Return Date
                  </label>
                  <input
                    type="date"
                    value={formData.returnDate}
                    onChange={(e) => handleInputChange('returnDate', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Customer
                  </label>
                  <input
                    type="text"
                    value={formData.customerName || 'Walk-in Customer'}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Return Reason *
                  </label>
                  <select
                    value={formData.reason}
                    onChange={(e) => handleInputChange('reason', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">Select reason</option>
                    <option value="Product defective">Product defective</option>
                    <option value="Wrong item received">Wrong item received</option>
                    <option value="Damaged during shipping">Damaged during shipping</option>
                    <option value="Expired product">Expired product</option>
                    <option value="Changed mind">Changed mind</option>
                    <option value="Not as described">Not as described</option>
                    <option value="Quality issues">Quality issues</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Refund Method
                  </label>
                  <select
                    value={formData.refundMethod}
                    onChange={(e) => handleInputChange('refundMethod', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
                  >
                    <option value="cash">Cash</option>
                    <option value="card">Original Card</option>
                    <option value="store_credit">Store Credit</option>
                    <option value="exchange">Exchange</option>
                  </select>
                </div>
              </div>

              {/* Return Items */}
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">Select Items to Return</h3>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Product</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Original Qty</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Return Qty</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Unit Price</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Condition</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Reason</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Refund Amount</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {formData.items.map((item, index) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3">
                            <div className="flex items-center">
                              <Package size={16} className="text-gray-400 dark:text-gray-500 mr-2" />
                              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.productName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-sm text-gray-900 dark:text-gray-100">{item.originalQuantity}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="number"
                              min="0"
                              max={item.originalQuantity}
                              value={item.returnQuantity}
                              onChange={(e) => updateReturnItem(index, 'returnQuantity', parseInt(e.target.value) || 0)}
                              className="w-16 px-2 py-1 text-center border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded text-sm text-gray-900 dark:text-gray-100"
                            />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-sm text-gray-900 dark:text-gray-100">₹{item.unitPrice.toFixed(2)}</span>
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={item.condition}
                              onChange={(e) => updateReturnItem(index, 'condition', e.target.value)}
                              className={`px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded text-xs ${getConditionColor(item.condition)}`}
                              disabled={item.returnQuantity === 0}
                            >
                              <option value="good">Good</option>
                              <option value="damaged">Damaged</option>
                              <option value="defective">Defective</option>
                              <option value="expired">Expired</option>
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={item.reason}
                              onChange={(e) => updateReturnItem(index, 'reason', e.target.value)}
                              placeholder="Specific reason..."
                              disabled={item.returnQuantity === 0}
                              className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded text-xs text-gray-900 dark:text-gray-100"
                            />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              ₹{item.refundAmount.toFixed(2)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Summary and Notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">Refund Summary</h3>
                  <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Subtotal:</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">₹{formData.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Tax Total:</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">₹{formData.taxTotal.toFixed(2)}</span>
                    </div>
                    <div className="border-t dark:border-gray-700 pt-3 flex justify-between">
                      <span className="text-base font-semibold text-gray-700 dark:text-gray-300">Total Refund:</span>
                      <span className="text-base font-bold text-primary-700 dark:text-primary-400">₹{formData.refundAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">Additional Notes</h3>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
                    placeholder="Additional notes about the return..."
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="border-t dark:border-gray-700 px-6 py-4 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          {step === 'process_return' && (
            <>
              <button
                onClick={() => setStep('select_bill')}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Back
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-primary-600 dark:bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-700 dark:hover:bg-primary-600"
              >
                Process Return
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReturnModal;