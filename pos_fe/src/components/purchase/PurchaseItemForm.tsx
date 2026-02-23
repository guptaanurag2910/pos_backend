import { Plus } from 'lucide-react';

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

interface PurchaseItemFormProps {
  newItem: Partial<PurchaseInvoiceItem>;
  onUpdate: (field: string, value: any) => void;
  onAdd: () => void;
}

const PurchaseItemForm = ({ newItem, onUpdate, onAdd }: PurchaseItemFormProps) => {
  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-700">
      <h3 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-3">Add New Item</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Product Name *
          </label>
          <input
            type="text"
            value={newItem.productName || ''}
            onChange={(e) => onUpdate('productName', e.target.value)}
            placeholder="Product name"
            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
        
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Batch Number
          </label>
          <input
            type="text"
            value={newItem.batchNumber || ''}
            onChange={(e) => onUpdate('batchNumber', e.target.value)}
            placeholder="Batch #"
            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
        
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Quantity *
          </label>
          <input
            type="number"
            min="1"
            value={newItem.quantity || 1}
            onChange={(e) => onUpdate('quantity', parseInt(e.target.value) || 0)}
            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
        
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Unit Price *
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={newItem.unitPrice || 0}
            onChange={(e) => onUpdate('unitPrice', parseFloat(e.target.value) || 0)}
            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
        
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Discount
          </label>
          <div className="flex">
            <input
              type="number"
              min="0"
              value={newItem.discount || 0}
              onChange={(e) => onUpdate('discount', parseFloat(e.target.value) || 0)}
              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-l focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
            <select
              value={newItem.discountType || 'percentage'}
              onChange={(e) => onUpdate('discountType', e.target.value)}
              className="px-1 py-1 text-xs border-l-0 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-r focus:outline-none"
            >
              <option value="percentage">%</option>
              <option value="amount">₹</option>
            </select>
          </div>
        </div>
        
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Tax %
          </label>
          <input
            type="number"
            min="0"
            max="100"
            value={newItem.taxRate || 18}
            onChange={(e) => onUpdate('taxRate', parseFloat(e.target.value) || 0)}
            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
        
        <div className="flex items-end">
          <button
            onClick={onAdd}
            className="w-full px-3 py-1 bg-primary-600 dark:bg-primary-500 text-white text-sm rounded hover:bg-primary-700 dark:hover:bg-primary-600 flex items-center justify-center"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PurchaseItemForm;