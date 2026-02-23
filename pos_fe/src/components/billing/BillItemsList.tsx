import { Trash2, Plus, Minus } from 'lucide-react';
import { BillItem } from '../../types';

interface BillItemsListProps {
  items: BillItem[];
  updateQuantity: (itemId: string, quantity: number) => void;
  removeItem: (itemId: string) => void;
}

const BillItemsList = ({ items, updateQuantity, removeItem }: BillItemsListProps) => {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="h-16 w-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center text-gray-400 dark:text-gray-500 mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
        </div>
        <p className="text-gray-500 dark:text-gray-400 font-medium">No items in the bill yet</p>
        <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Search and add items to start billing</p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto flex-grow">
      <table className="min-w-full">
        <thead>
          <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            <th className="px-4 py-3">Item</th>
            <th className="px-4 py-3 text-center">Qty</th>
            <th className="px-4 py-3 text-right">MRP</th>
            <th className="px-4 py-3 text-right">Rate</th>
            <th className="px-4 py-3 text-right">Total</th>
            <th className="px-4 py-3 w-10"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 animate-fade-in">
              <td className="px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{item.productName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Barcode: {item.barcode}</p>
                </div>
              </td>

              <td className="px-4 py-3">
                <div className="flex items-center justify-center">
                  <button
                    onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                    className="p-1 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    <Minus size={14} />
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (!isNaN(value) && value > 0) {
                        updateQuantity(item.id, value);
                      }
                    }}
                    className="w-12 mx-1 text-center border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded text-sm"
                  />
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    className="p-1 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </td>

              <td className="px-4 py-3 text-sm text-right text-gray-800 dark:text-gray-200">
                ₹{Number(item.mrp || item.price || 0).toFixed(2)}
              </td>

              <td className="px-4 py-3 text-sm text-right text-gray-800 dark:text-gray-200">
                ₹{Number(item.price || 0).toFixed(2)}
                <div className="text-xs text-gray-500 dark:text-gray-400">Tax: {item.tax}%</div>
              </td>

              <td className="px-4 py-3 text-sm font-medium text-right text-gray-800 dark:text-gray-200">
                ₹{Number(item.total || 0).toFixed(2)}
              </td>

              <td className="px-4 py-3 text-right">
                <button
                  onClick={() => removeItem(item.id)}
                  className="p-1 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-error-600 dark:hover:text-error-400"
                >
                  <Trash2 size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default BillItemsList;
