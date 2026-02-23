import { Trash2, Package } from 'lucide-react';

interface PurchaseInvoiceItem {
  id: string;
  productName: string;
  batchNumber?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  discountType: 'percentage' | 'amount';
  taxRate: number;
  total: number;
}

interface PurchaseItemsListProps {
  items: PurchaseInvoiceItem[];
  onUpdateItem: (itemId: string, field: keyof PurchaseInvoiceItem, value: any) => void;
  onRemoveItem: (itemId: string) => void;
}

const PurchaseItemsList = ({ items, onUpdateItem, onRemoveItem }: PurchaseItemsListProps) => {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="h-16 w-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center text-gray-400 dark:text-gray-500 mb-4">
          <Package size={32} />
        </div>
        <p className="text-gray-500 dark:text-gray-400 font-medium">No items added yet</p>
        <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Add items using the form above</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-900">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Product</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Batch</th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Qty</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Unit Price</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Discount</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tax %</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total</th>
            <th className="px-4 py-3 w-10"></th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 animate-fade-in">
              <td className="px-4 py-3">
                <input
                  type="text"
                  value={item.productName}
                  onChange={(e) => onUpdateItem(item.id, 'productName', e.target.value)}
                  className="w-full px-2 py-1 text-sm border-0 bg-transparent text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-500 rounded"
                />
              </td>
              <td className="px-4 py-3">
                <input
                  type="text"
                  value={item.batchNumber || ''}
                  onChange={(e) => onUpdateItem(item.id, 'batchNumber', e.target.value)}
                  className="w-full px-2 py-1 text-sm border-0 bg-transparent text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-500 rounded"
                />
              </td>
              <td className="px-4 py-3 text-center">
                <input
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(e) => onUpdateItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                  className="w-16 px-2 py-1 text-sm text-center border-0 bg-transparent text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-500 rounded"
                />
              </td>
              <td className="px-4 py-3 text-right">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.unitPrice}
                  onChange={(e) => onUpdateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                  className="w-20 px-2 py-1 text-sm text-right border-0 bg-transparent text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-500 rounded"
                />
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end">
                  <input
                    type="number"
                    min="0"
                    value={item.discount}
                    onChange={(e) => onUpdateItem(item.id, 'discount', parseFloat(e.target.value) || 0)}
                    className="w-16 px-2 py-1 text-sm text-right border-0 bg-transparent text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-500 rounded"
                  />
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                    {item.discountType === 'percentage' ? '%' : '₹'}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 text-right">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={item.taxRate}
                  onChange={(e) => onUpdateItem(item.id, 'taxRate', parseFloat(e.target.value) || 0)}
                  className="w-16 px-2 py-1 text-sm text-right border-0 bg-transparent text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-500 rounded"
                />
              </td>
              <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-gray-100">
                ₹{item.total.toFixed(2)}
              </td>
              <td className="px-4 py-3">
                <button
                  onClick={() => onRemoveItem(item.id)}
                  className="p-1 text-gray-500 dark:text-gray-400 hover:text-error-600 dark:hover:text-error-400 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"
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

export default PurchaseItemsList;