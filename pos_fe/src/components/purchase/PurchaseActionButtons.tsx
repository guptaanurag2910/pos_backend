import { Save, Upload, FileText, Download, DollarSign } from 'lucide-react';

interface PurchaseActionButtonsProps {
  hasItems: boolean;
  onSave: () => void;
  onMarkAsPaid: () => void;
}

const PurchaseActionButtons = ({ hasItems, onSave, onMarkAsPaid }: PurchaseActionButtonsProps) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <div className="flex flex-wrap gap-3">
        <button
          onClick={onSave}
          className="flex items-center px-4 py-2 bg-primary-600 dark:bg-primary-500 text-white rounded-lg hover:bg-primary-700 dark:hover:bg-primary-600"
        >
          <Save size={18} className="mr-2" />
          Save Invoice
        </button>
        
        <button
          onClick={onMarkAsPaid}
          disabled={!hasItems}
          className={`flex items-center px-4 py-2 rounded-lg ${
            !hasItems
              ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed'
              : 'bg-success-600 dark:bg-success-500 text-white hover:bg-success-700 dark:hover:bg-success-600'
          }`}
        >
          <DollarSign size={18} className="mr-2" />
          Mark as Paid
        </button>
        
        <button className="flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
          <Upload size={18} className="mr-2" />
          Import from PO/GRN
        </button>
        
        <button className="flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
          <FileText size={18} className="mr-2" />
          Generate PDF
        </button>
        
        <button className="flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
          <Download size={18} className="mr-2" />
          Export
        </button>
      </div>
    </div>
  );
};

export default PurchaseActionButtons;