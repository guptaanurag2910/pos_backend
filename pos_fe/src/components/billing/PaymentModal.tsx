import { useEffect, useState } from 'react';
import { CreditCard, IndianRupee, Smartphone, X } from 'lucide-react';
import toast from 'react-hot-toast';
import * as salesService from '../../service/salesService';
import { BillItem } from '../../types';

interface PaymentModalProps {
  total: number;
  subtotal: number;
  taxTotal: number;
  itemDiscountTotal?: number;
  customerId: number | null;
  items: BillItem[];
  discount: number;
  pointsToRedeem?: number;
  resumedBillId?: number;
  onClose: () => void;
  onComplete: (bill: any) => void;
}

const PaymentModal = ({
  total,
  subtotal,
  taxTotal,
  itemDiscountTotal = 0,
  customerId,
  items,
  discount,
  pointsToRedeem = 0,
  resumedBillId,
  onClose,
  onComplete,
}: PaymentModalProps) => {
  const paymentMethods = ['cash', 'card', 'upi'] as const;
  const [paymentMethod, setPaymentMethod] = useState('');
  const [highlightedMethodIndex, setHighlightedMethodIndex] = useState(0);
  const [cashReceived, setCashReceived] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCashReceivedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCashReceived(e.target.value);
  };

  const handleComplete = async () => {
    if (!paymentMethod) {
      setError('Please select a payment method');
      return;
    }

    if (paymentMethod === 'cash') {
      const cashAmount = parseFloat(cashReceived);
      if (isNaN(cashAmount) || cashAmount < total) {
        setError('Cash received must be greater than or equal to the total amount');
        return;
      }
    }

    try {
      setLoading(true);
      let billId: number;

      if (resumedBillId) {
        billId = resumedBillId;
      } else {
        const validItems = items
          .map((item) => ({
            product_id: item.productId,
            quantity: Number(item.quantity),
            rate: Number((item as any).rate ?? item.price),
            tax_rate: Number(item.tax || 0),
            discount_rate: Number(item.discountRate || 0),
          }))
          .filter(
            (item) =>
              Number.isFinite(item.quantity) &&
              item.quantity > 0 &&
              !!item.product_id &&
              Number.isFinite(item.rate) &&
              item.rate > 0
          );

        if (validItems.length === 0) {
          setError('Cannot create bill without valid items.');
          setLoading(false);
          return;
        }

        const billPayload = {
          customer_id: customerId,
          items: validItems,
          bill_discount: discount || 0,
          points_to_redeem: pointsToRedeem || 0,
        };

        const createdBill = await salesService.createBill(billPayload);
        billId = createdBill.id;
      }

      // completeBill handles payment recording for outstanding amount
      await salesService.completeBill(billId, paymentMethod);

      const completedBill = await salesService.getBill(billId);
      toast.success('Payment completed and bill generated successfully');
      onComplete(completedBill);
      onClose();
    } catch (err: any) {
      console.error(err);
      const detail =
        err?.response?.data?.detail ||
        err?.response?.data?.items ||
        (typeof err?.response?.data === 'object' ? JSON.stringify(err.response.data) : null) ||
        'Failed to complete payment';
      setError(typeof detail === 'string' ? detail : 'Failed to complete payment');
      toast.error(typeof detail === 'string' ? detail : 'Failed to complete payment');
    } finally {
      setLoading(false);
    }
  };

  const cashChange = cashReceived ? parseFloat(cashReceived) - total : 0;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditableTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        Boolean(target?.isContentEditable);

      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      // Do not hijack number/arrow typing when user is entering values in fields.
      if (isEditableTarget) {
        return;
      }

      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlightedMethodIndex((current) => {
          const next = (current + 1) % paymentMethods.length;
          setPaymentMethod(paymentMethods[next]);
          return next;
        });
        return;
      }

      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlightedMethodIndex((current) => {
          const next = (current - 1 + paymentMethods.length) % paymentMethods.length;
          setPaymentMethod(paymentMethods[next]);
          return next;
        });
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        if (!paymentMethod) {
          setPaymentMethod(paymentMethods[highlightedMethodIndex]);
          return;
        }
        if (!loading) void handleComplete();
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleComplete, highlightedMethodIndex, loading, onClose, paymentMethod, paymentMethods]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-md mx-4 animate-fade-in">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-xl font-semibold text-gray-800">Complete Payment</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-4 rounded-lg border border-gray-200 p-3 text-sm text-gray-700">
            <div className="flex justify-between"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Tax (included)</span><span>₹{taxTotal.toFixed(2)}</span></div>
            <div className="flex justify-between text-error-700"><span>Item Discounts</span><span>-₹{itemDiscountTotal.toFixed(2)}</span></div>
            <div className="flex justify-between text-error-700"><span>Bill Discount</span><span>-₹{discount.toFixed(2)}</span></div>
          </div>
          <div className="mb-6">
            <p className="text-lg font-semibold text-center mb-2">Total Amount</p>
            <p className="text-3xl font-bold text-primary-700 text-center">₹{total.toFixed(2)}</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-error-50 text-error-700 rounded-lg">
              {error}
            </div>
          )}

          <div className="space-y-4 mb-6">
            <p className="font-medium text-gray-700">Select Payment Method</p>
            <div className="grid grid-cols-3 gap-3">
              {paymentMethods.map((method, index) => {
                const Icon = method === 'cash' ? IndianRupee : method === 'card' ? CreditCard : Smartphone;
                const label = method.charAt(0).toUpperCase() + method.slice(1);
                return (
                  <button
                    key={method}
                    type="button"
                    data-testid={`payment-method-${method}`}
                    className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-colors ${
                      paymentMethod === method
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : highlightedMethodIndex === index
                          ? 'border-primary-300 bg-primary-50/60 text-primary-700'
                          : 'border-gray-300 hover:border-primary-500 hover:bg-primary-50'
                    }`}
                    onClick={() => {
                      setHighlightedMethodIndex(index);
                      setPaymentMethod(method);
                    }}
                  >
                    <Icon size={24} className="mb-1" />
                    <span className="text-sm">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {paymentMethod === 'cash' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cash Received (₹)
              </label>
              <input
                data-testid="payment-cash-received"
                type="number"
                value={cashReceived}
                onChange={handleCashReceivedChange}
                autoFocus
                className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Enter amount"
              />
              {cashReceived && !isNaN(parseFloat(cashReceived)) && (
                <div className="mt-2">
                  <div className="flex justify-between text-sm">
                    <span>Change to return:</span>
                    <span className={`font-medium ${cashChange >= 0 ? 'text-success-600' : 'text-error-600'}`}>
                      ₹{cashChange.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

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
              data-testid="payment-complete"
              onClick={handleComplete}
              disabled={loading}
              className="flex-1 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700"
            >
              {loading ? 'Processing...' : 'Complete Payment'}
            </button>
          </div>

          <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
            <span className="font-medium">Keyboard Shortcuts:</span> Esc - Close, Arrow Keys - Select Payment Method, Enter - Complete Payment
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
