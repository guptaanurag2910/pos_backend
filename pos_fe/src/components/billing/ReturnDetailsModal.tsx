// Updated ReturnDetailsModal.tsx with API payload integration and proper typings
import { useEffect } from 'react';
import { X, Receipt, User, Calendar, Package, IndianRupee } from 'lucide-react';

interface ReturnItem {
  id: number;
  bill_item: number;
  product: number;
  productName: string;
  originalQuantity: number;
  returnQuantity: number;
  unitPrice: number;
  tax: number;
  reason: string;
  condition: 'good' | 'damaged' | 'defective' | 'expired';
  refundAmount: number;
}

interface Return {
  id: number;
  returnNumber: string;
  bill: number;
  billNumber: string;
  returnType: 'full' | 'partial';
  reason: string;
  subtotal: number;
  taxTotal: number;
  refundAmount: number;
  refundMethod: 'cash' | 'card' | 'store_credit' | 'exchange';
  status: 'pending' | 'approved' | 'completed' | 'rejected';
  returnDate: string;
  notes?: string;
  customerName?: string;
  customerId?: string;
  processedBy?: string | number;
  processedAt?: string;
  items: ReturnItem[];
}

interface ReturnDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  returnData: Return;
}

const ReturnDetailsModal = ({ isOpen, onClose, returnData }: ReturnDetailsModalProps) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-warning-100 text-warning-800 dark:bg-warning-900/50 dark:text-warning-400';
      case 'approved': return 'bg-success-100 text-success-800 dark:bg-success-900/50 dark:text-success-400';
      case 'completed': return 'bg-primary-100 text-primary-800 dark:bg-primary-900/50 dark:text-primary-400';
      case 'rejected': return 'bg-error-100 text-error-800 dark:bg-error-900/50 dark:text-error-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'good': return 'text-success-600 dark:text-success-400';
      case 'damaged': return 'text-warning-600 dark:text-warning-400';
      case 'defective': return 'text-error-600 dark:text-error-400';
      case 'expired': return 'text-error-600 dark:text-error-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getConditionIcon = (condition: string) => {
    switch (condition) {
      case 'good': return '✓';
      case 'damaged': return '⚠';
      case 'defective': return '✗';
      case 'expired': return '⏰';
      default: return '?';
    }
  };

  useEffect(() => {
    console.log('Return Details:', returnData);
  }, [returnData]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between border-b dark:border-gray-700 px-6 py-4">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Return Details</h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-4">
              <div className="flex items-center">
                <Receipt size={20} className="text-primary-600 dark:text-primary-400 mr-3" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{returnData.returnNumber}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Return Number</p>
                </div>
              </div>
              <div className="flex items-center">
                <User size={20} className="text-gray-600 dark:text-gray-400 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{returnData.customerName || 'Walk-in Customer'}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Customer</p>
                </div>
              </div>
              <div className="flex items-center">
                <Calendar size={20} className="text-gray-600 dark:text-gray-400 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{new Date(returnData.returnDate).toLocaleDateString()}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Return Date</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Original Bill</p>
                <p className="text-lg font-semibold text-gray-800 dark:text-gray-100">{returnData.billNumber}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Status</p>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(returnData.status)}`}>{returnData.status.charAt(0).toUpperCase() + returnData.status.slice(1)}</span>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Return Type</p>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  returnData.returnType === 'full' ? 'bg-error-100 text-error-800 dark:bg-error-900/50 dark:text-error-400' : 'bg-warning-100 text-warning-800 dark:bg-warning-900/50 dark:text-warning-400'
                }`}>
                  {returnData.returnType.charAt(0).toUpperCase() + returnData.returnType.slice(1)} Return
                </span>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Reason</p>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{returnData.reason}</p>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4 flex items-center">
              <Package size={20} className="mr-2" />
              Returned Items
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Product</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Original Qty</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Returned Qty</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Unit Price</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Condition</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Reason</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Refund Amount</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {returnData.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3"><div className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.productName}</div></td>
                      <td className="px-4 py-3 text-center"><span className="text-sm text-gray-900 dark:text-gray-100">{item.originalQuantity}</span></td>
                      <td className="px-4 py-3 text-center"><span className="text-sm font-medium text-primary-600 dark:text-primary-400">{item.returnQuantity}</span></td>
                      <td className="px-4 py-3 text-right"><span className="text-sm text-gray-900 dark:text-gray-100">₹{Number(item.unitPrice).toFixed(2)}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center">
                          <span className={`text-lg mr-2 ${getConditionColor(item.condition)}`}>{getConditionIcon(item.condition)}</span>
                          <span className={`text-sm font-medium ${getConditionColor(item.condition)}`}>{item.condition.charAt(0).toUpperCase() + item.condition.slice(1)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className="text-sm text-gray-900 dark:text-gray-100">{item.reason || '-'}</span></td>
                      <td className="px-4 py-3 text-right"><span className="text-sm font-medium text-gray-900 dark:text-gray-100">₹{Number(item.refundAmount).toFixed(2)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4 flex items-center">
                <IndianRupee size={20} className="mr-2" />
                Refund Summary
              </h3>
              <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Subtotal:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">₹{Number(returnData.subtotal).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Tax Total:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">₹{Number(returnData.taxTotal).toFixed(2)}</span>
                </div>
                <div className="border-t dark:border-gray-700 pt-3 flex justify-between">
                  <span className="text-base font-semibold text-gray-700 dark:text-gray-300">Total Refund:</span>
                  <span className="text-base font-bold text-primary-700 dark:text-primary-400">₹{Number(returnData.refundAmount).toFixed(2)}</span>
                </div>
                <div className="mt-3 pt-3 border-t dark:border-gray-700">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Refund Method:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100 capitalize">{returnData.refundMethod.replace('_', ' ')}</span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">Processing Information</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Processed By</p>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{returnData.processedBy}</p>
                </div>
                {returnData.processedAt && (
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Processed At</p>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{new Date(returnData.processedAt).toLocaleString()}</p>
                  </div>
                )}
                {returnData.notes && (
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Notes</p>
                    <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <p className="text-sm text-gray-800 dark:text-gray-100">{returnData.notes}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t dark:border-gray-700 px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-primary-600 dark:bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-700 dark:hover:bg-primary-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReturnDetailsModal;