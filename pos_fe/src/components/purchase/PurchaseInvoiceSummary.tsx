interface PurchaseInvoiceSummaryProps {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  shippingCharges: number;
  grandTotal: number;
  onUpdateShipping: (value: number) => void;
}

const PurchaseInvoiceSummary = ({ 
  subtotal, 
  discountTotal, 
  taxTotal, 
  shippingCharges, 
  grandTotal, 
  onUpdateShipping 
}: PurchaseInvoiceSummaryProps) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Invoice Summary</h2>
      
      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Subtotal:</span>
          <span className="font-medium text-gray-900 dark:text-gray-100">₹{subtotal.toFixed(2)}</span>
        </div>
        
        <div className="flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Discount Total:</span>
          <span className="font-medium text-error-600 dark:text-error-400">-₹{discountTotal.toFixed(2)}</span>
        </div>
        
        <div className="flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Tax Total:</span>
          <span className="font-medium text-gray-900 dark:text-gray-100">₹{taxTotal.toFixed(2)}</span>
        </div>
        
        <div className="flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Shipping Charges:</span>
          <div className="flex items-center">
            <span className="text-gray-500 dark:text-gray-400 text-xs mr-1">₹</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={shippingCharges}
              onChange={(e) => onUpdateShipping(parseFloat(e.target.value) || 0)}
              className="w-20 px-2 py-1 text-sm text-right border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
        </div>
        
        <div className="border-t dark:border-gray-700 pt-3 flex justify-between">
          <span className="text-base font-semibold text-gray-700 dark:text-gray-300">Grand Total:</span>
          <span className="text-base font-bold text-primary-700 dark:text-primary-400">₹{grandTotal.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
};

export default PurchaseInvoiceSummary;