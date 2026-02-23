import { useState } from 'react';
import { X, Clock, ShoppingBag, Ban } from 'lucide-react';
import { Bill } from '../../types';
import { cancelBill } from '../../service/salesService';

interface HeldBillsModalProps {
  heldBills: Bill[];
  onClose: () => void;
  onResume: (billId: number) => void;
}

const HeldBillsModal = ({ heldBills, onClose, onResume }: HeldBillsModalProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [cancelConfirmId, setCancelConfirmId] = useState<number | null>(null);
  const [bills, setBills] = useState<Bill[]>(heldBills);

  const filteredBills = bills.filter(
    (bill) =>
      bill.bill_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bill.customer_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const confirmCancel = async () => {
    if (!cancelConfirmId) return;
    try {
      setLoadingId(cancelConfirmId);
      await cancelBill(cancelConfirmId);
      setBills((prev) => prev.filter((b) => b.id !== cancelConfirmId));
      setCancelConfirmId(null);
    } catch (err) {
      console.error('Failed to cancel bill:', err);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl mx-4 animate-fade-in max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-xl font-semibold text-gray-800">Held Bills</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 border-b">
          <input
            type="text"
            placeholder="Search by bill number or customer name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        <div className="overflow-y-auto flex-grow">
          {filteredBills.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 mb-4">
                <ShoppingBag size={32} />
              </div>
              <p className="text-gray-500 font-medium">No held bills found</p>
              {searchQuery ? (
                <p className="text-gray-400 text-sm mt-1">Try a different search term</p>
              ) : (
                <p className="text-gray-400 text-sm mt-1">Hold a bill to see it here</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
              {filteredBills.map((bill) => (
                <div
                  key={bill.id}
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-800">{bill.bill_number}</h3>
                      <div className="flex items-center text-xs text-gray-500 mt-1">
                        <Clock size={12} className="mr-1" />
                        <span>{new Date(bill.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                    <span className="text-lg font-bold text-primary-700">
                      ₹{parseFloat(bill.total).toFixed(2)}
                    </span>
                  </div>

                  <div className="mb-3">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Customer:</span>{' '}
                      {bill.customer_name || 'Walk-in Customer'}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Items:</span>{' '}
                      {bill.items?.length ?? 0}
                    </p>
                  </div>

                  <div className="space-y-1 mb-4">
                    {bill.items?.slice(0, 3).map((item) => (
                      <div
                        key={item.id}
                        className="text-xs text-gray-500 flex justify-between"
                      >
                        <span>
                          {item.productName ?? 'Product'} x{item.quantity}
                        </span>
                        <span>₹{item.total?.toFixed(2) ?? '0.00'}</span>
                      </div>
                    ))}
                    {bill.items && bill.items.length > 3 && (
                      <div className="text-xs text-gray-400 italic">
                        +{bill.items.length - 3} more items
                      </div>
                    )}
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => onResume(bill.id)}
                      className="w-full py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700"
                    >
                      Resume Bill
                    </button>
                    <button
                      onClick={() => setCancelConfirmId(bill.id)}
                      disabled={loadingId === bill.id}
                      className="w-full py-2 bg-red-100 text-red-600 rounded-lg text-sm font-medium hover:bg-red-200 border border-red-300"
                    >
                      <Ban size={16} className="inline-block mr-1" /> Cancel
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t p-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>

      {cancelConfirmId !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-lg max-w-sm w-full text-center">
            <p className="text-lg font-semibold text-gray-800 mb-2">Cancel this bill?</p>
            <p className="text-gray-600 mb-4">This action cannot be undone.</p>
            <div className="flex justify-center space-x-3">
              <button
                onClick={() => setCancelConfirmId(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
              >
                No
              </button>
              <button
                onClick={confirmCancel}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                disabled={loadingId === cancelConfirmId}
              >
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HeldBillsModal;