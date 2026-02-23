interface BillSummaryProps {
  subtotal: number;
  taxTotal: number;
  discount: number;
  total: number;
}

const BillSummary = ({ subtotal, taxTotal, discount, total }: BillSummaryProps) => {
  return (
    <div className="border-t dark:border-gray-700 pt-4 space-y-3">
      <div className="flex justify-between text-sm">
        <span className="text-gray-500 dark:text-gray-400">Subtotal:</span>
        <span className="font-medium text-gray-800 dark:text-gray-200">₹{subtotal.toFixed(2)}</span>
      </div>
      
      <div className="flex justify-between text-sm">
        <span className="text-gray-500 dark:text-gray-400">Tax:</span>
        <span className="font-medium text-gray-800 dark:text-gray-200">₹{taxTotal.toFixed(2)}</span>
      </div>
      
      {discount > 0 && (
        <div className="flex justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">Discount:</span>
          <span className="font-medium text-error-600 dark:text-error-400">-₹{discount.toFixed(2)}</span>
        </div>
      )}
      
      <div className="border-t dark:border-gray-700 pt-3 flex justify-between">
        <span className="text-base font-semibold text-gray-700 dark:text-gray-300">Total:</span>
        <span className="text-base font-bold text-primary-700 dark:text-primary-400">₹{total.toFixed(2)}</span>
      </div>
    </div>
  );
};

export default BillSummary;