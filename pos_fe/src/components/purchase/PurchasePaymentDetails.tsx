import { CheckCircle } from 'lucide-react';

interface PurchasePaymentDetailsProps {
  paymentTerms: string;
  paymentStatus: 'pending' | 'partially_paid' | 'paid';
  paymentMethod?: string;
  referenceNumber?: string;
  notes?: string;
  onUpdate: (field: string, value: any) => void;
}

const PurchasePaymentDetails = ({ 
  paymentTerms, 
  paymentStatus, 
  paymentMethod, 
  referenceNumber, 
  notes, 
  onUpdate 
}: PurchasePaymentDetailsProps) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Payment Details</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Payment Terms
          </label>
          <select
            value={paymentTerms}
            onChange={(e) => onUpdate('paymentTerms', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
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
            Payment Status
          </label>
          <div className="flex items-center space-x-2">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              paymentStatus === 'paid' 
                ? 'bg-success-100 dark:bg-success-900/50 text-success-700 dark:text-success-400'
                : paymentStatus === 'partially_paid'
                ? 'bg-warning-100 dark:bg-warning-900/50 text-warning-700 dark:text-warning-400'
                : 'bg-error-100 dark:bg-error-900/50 text-error-700 dark:text-error-400'
            }`}>
              {paymentStatus === 'paid' ? 'Paid' : 
               paymentStatus === 'partially_paid' ? 'Partially Paid' : 'Pending'}
            </span>
            {paymentStatus === 'paid' && (
              <CheckCircle size={16} className="text-success-600 dark:text-success-400" />
            )}
          </div>
        </div>
        
        {paymentMethod && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Payment Method
            </label>
            <p className="text-sm text-gray-900 dark:text-gray-100 capitalize">{paymentMethod}</p>
          </div>
        )}
        
        {referenceNumber && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Reference Number
            </label>
            <p className="text-sm text-gray-900 dark:text-gray-100">{referenceNumber}</p>
          </div>
        )}
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Notes
          </label>
          <textarea
            value={notes || ''}
            onChange={(e) => onUpdate('notes', e.target.value)}
            rows={3}
            placeholder="Additional notes or terms..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>
    </div>
  );
};

export default PurchasePaymentDetails;