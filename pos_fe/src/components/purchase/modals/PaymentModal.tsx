import { useState } from 'react';
import { X, CreditCard, DollarSign, Smartphone, FileText } from 'lucide-react';

interface PaymentData {
  id?: string;
  paymentNumber: string;
  invoiceId: string;
  supplierName: string;
  paymentDate: string;
  amount: number;
  paymentMethod: 'cash' | 'cheque' | 'bank_transfer' | 'upi' | 'credit';
  referenceNumber: string;
  notes: string;
  status: 'pending' | 'completed' | 'failed';
}

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payment: PaymentData) => void;
  invoiceData?: {
    id: string;
    supplierName: string;
    grandTotal: number;
    balanceAmount: number;
  };
  initialData?: PaymentData;
}

const PaymentModal = ({ isOpen, onClose, onSave, invoiceData, initialData }: PaymentModalProps) => {
  const [formData, setFormData] = useState<PaymentData>({
    paymentNumber: `PAY-${Date.now().toString().slice(-6)}`,
    invoiceId: invoiceData?.id || '',
    supplierName: invoiceData?.supplierName || '',
    paymentDate: new Date().toISOString().split('T')[0],
    amount: invoiceData?.balanceAmount || 0,
    paymentMethod: 'bank_transfer',
    referenceNumber: '',
    notes: '',
    status: 'completed'
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useState(() => {
    if (initialData) {
      setFormData(initialData);
    }
  });

  const handleInputChange = (field: keyof PaymentData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.supplierName.trim()) {
      newErrors.supplierName = 'Supplier name is required';
    }

    if (!formData.amount || formData.amount <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    }

    if (invoiceData && formData.amount > invoiceData.balanceAmount) {
      newErrors.amount = 'Amount cannot exceed balance amount';
    }

    if (!formData.paymentMethod) {
      newErrors.paymentMethod = 'Payment method is required';
    }

    if (formData.paymentMethod !== 'cash' && !formData.referenceNumber.trim()) {
      newErrors.referenceNumber = 'Reference number is required for this payment method';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) {
      return;
    }

    onSave(formData);
    onClose();
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'cash':
        return <DollarSign size={20} />;
      case 'cheque':
        return <FileText size={20} />;
      case 'bank_transfer':
        return <CreditCard size={20} />;
      case 'upi':
        return <Smartphone size={20} />;
      case 'credit':
        return <CreditCard size={20} />;
      default:
        return <CreditCard size={20} />;
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'cash': return 'Cash';
      case 'cheque': return 'Cheque';
      case 'bank_transfer': return 'Bank Transfer';
      case 'upi': return 'UPI';
      case 'credit': return 'Credit';
      default: return method;
    }
  };

  const getReferenceLabel = (method: string) => {
    switch (method) {
      case 'cheque': return 'Cheque Number';
      case 'bank_transfer': return 'UTR Number';
      case 'upi': return 'Transaction ID';
      case 'credit': return 'Reference Number';
      default: return 'Reference Number';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between border-b dark:border-gray-700 px-6 py-4">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
            {initialData ? 'Edit Payment' : 'Record Payment'}
          </h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Payment Summary */}
          {invoiceData && (
            <div className="mb-6 p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
              <h3 className="text-lg font-medium text-primary-800 dark:text-primary-200 mb-2">Payment Details</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-primary-600 dark:text-primary-400">Supplier:</span>
                  <span className="ml-2 font-medium text-primary-800 dark:text-primary-200">{invoiceData.supplierName}</span>
                </div>
                <div>
                  <span className="text-primary-600 dark:text-primary-400">Total Amount:</span>
                  <span className="ml-2 font-medium text-primary-800 dark:text-primary-200">₹{invoiceData.grandTotal.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-primary-600 dark:text-primary-400">Balance Due:</span>
                  <span className="ml-2 font-bold text-primary-800 dark:text-primary-200">₹{invoiceData.balanceAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Payment Form */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Payment Number
                </label>
                <input
                  type="text"
                  value={formData.paymentNumber}
                  onChange={(e) => handleInputChange('paymentNumber', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Payment Date
                </label>
                <input
                  type="date"
                  value={formData.paymentDate}
                  onChange={(e) => handleInputChange('paymentDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Supplier Name *
              </label>
              <input
                type="text"
                value={formData.supplierName}
                onChange={(e) => handleInputChange('supplierName', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100 ${
                  errors.supplierName 
                    ? 'border-error-500 dark:border-error-400 bg-error-50 dark:bg-error-900/20' 
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'
                }`}
                disabled={!!invoiceData}
              />
              {errors.supplierName && (
                <p className="mt-1 text-sm text-error-600 dark:text-error-400">{errors.supplierName}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Payment Amount *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 dark:text-gray-400">₹</span>
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => handleInputChange('amount', parseFloat(e.target.value) || 0)}
                  className={`w-full pl-8 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100 ${
                    errors.amount 
                      ? 'border-error-500 dark:border-error-400 bg-error-50 dark:bg-error-900/20' 
                      : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'
                  }`}
                />
              </div>
              {errors.amount && (
                <p className="mt-1 text-sm text-error-600 dark:text-error-400">{errors.amount}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Payment Method *
              </label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {['bank_transfer', 'upi', 'cash', 'cheque', 'credit'].map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => handleInputChange('paymentMethod', method)}
                    className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-colors ${
                      formData.paymentMethod === method
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300'
                        : 'border-gray-300 dark:border-gray-600 hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {getPaymentMethodIcon(method)}
                    <span className="text-xs mt-1">{getPaymentMethodLabel(method)}</span>
                  </button>
                ))}
              </div>
              {errors.paymentMethod && (
                <p className="mt-1 text-sm text-error-600 dark:text-error-400">{errors.paymentMethod}</p>
              )}
            </div>

            {formData.paymentMethod && formData.paymentMethod !== 'cash' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {getReferenceLabel(formData.paymentMethod)} *
                </label>
                <input
                  type="text"
                  value={formData.referenceNumber}
                  onChange={(e) => handleInputChange('referenceNumber', e.target.value)}
                  placeholder={`Enter ${getReferenceLabel(formData.paymentMethod).toLowerCase()}`}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100 ${
                    errors.referenceNumber 
                      ? 'border-error-500 dark:border-error-400 bg-error-50 dark:bg-error-900/20' 
                      : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'
                  }`}
                />
                {errors.referenceNumber && (
                  <p className="mt-1 text-sm text-error-600 dark:text-error-400">{errors.referenceNumber}</p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => handleInputChange('status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
              >
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
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
                placeholder="Additional notes about the payment"
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
            {initialData ? 'Update Payment' : 'Record Payment'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;