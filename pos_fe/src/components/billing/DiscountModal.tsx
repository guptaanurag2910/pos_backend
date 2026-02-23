import { useState } from 'react';
import { X, Percent, IndianRupee } from 'lucide-react';

interface DiscountModalProps {
  subtotal: number;
  onClose: () => void;
  onApply: (amount: number, isPercentage: boolean) => void;
}

const DiscountModal = ({ subtotal, onClose, onApply }: DiscountModalProps) => {
  const [discountType, setDiscountType] = useState<'amount' | 'percentage'>('amount');
  const [discountValue, setDiscountValue] = useState('');
  const [error, setError] = useState('');

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDiscountValue(e.target.value);
    setError('');
  };

  const handleApply = () => {
    const value = parseFloat(discountValue);
    
    if (isNaN(value) || value <= 0) {
      setError('Please enter a valid discount value');
      return;
    }
    
    if (discountType === 'amount' && value > subtotal) {
      setError('Discount cannot be greater than subtotal');
      return;
    }
    
    if (discountType === 'percentage' && value > 100) {
      setError('Percentage discount cannot exceed 100%');
      return;
    }
    
    onApply(value, discountType === 'percentage');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-md mx-4 animate-fade-in">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-xl font-semibold text-gray-800">Apply Discount</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-6">
            <p className="text-gray-700 mb-2">Subtotal: <span className="font-semibold">₹{subtotal.toFixed(2)}</span></p>
            
            {error && (
              <div className="mt-2 p-3 bg-error-50 text-error-700 rounded-lg text-sm">
                {error}
              </div>
            )}
          </div>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Discount Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  className={`flex items-center justify-center p-3 rounded-lg border transition-colors ${
                    discountType === 'amount'
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-300 hover:border-primary-500 hover:bg-primary-50'
                  }`}
                  onClick={() => setDiscountType('amount')}
                >
                  <IndianRupee size={18} className="mr-1" />
                  <span>Amount (₹)</span>
                </button>
                
                <button
                  type="button"
                  className={`flex items-center justify-center p-3 rounded-lg border transition-colors ${
                    discountType === 'percentage'
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-300 hover:border-primary-500 hover:bg-primary-50'
                  }`}
                  onClick={() => setDiscountType('percentage')}
                >
                  <Percent size={18} className="mr-1" />
                  <span>Percentage (%)</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {discountType === 'amount' ? 'Discount Amount (₹)' : 'Discount Percentage (%)'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  {discountType === 'amount' ? (
                    <span className="text-gray-500">₹</span>
                  ) : (
                    <Percent size={16} className="text-gray-500" />
                  )}
                </div>
                <input
                  type="number"
                  value={discountValue}
                  onChange={handleValueChange}
                  min="0"
                  max={discountType === 'percentage' ? '100' : undefined}
                  step="0.01"
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder={discountType === 'amount' ? 'Enter amount' : 'Enter percentage'}
                />
              </div>
            </div>

            {discountValue && !isNaN(parseFloat(discountValue)) && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-700">
                  {discountType === 'amount' 
                    ? `Applying ₹${parseFloat(discountValue).toFixed(2)} discount`
                    : `Applying ${parseFloat(discountValue).toFixed(2)}% discount (₹${((parseFloat(discountValue) / 100) * subtotal).toFixed(2)})`}
                </p>
              </div>
            )}
          </div>

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="flex-1 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700"
            >
              Apply Discount
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiscountModal;