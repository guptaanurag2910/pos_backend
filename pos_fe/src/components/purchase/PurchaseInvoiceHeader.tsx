import { Calendar, Building } from 'lucide-react';

interface PurchaseInvoiceHeaderProps {
  invoice: {
    invoiceNumber: string;
    invoiceDate: string;
    supplierName: string;
    poNumber?: string;
    grnNumber?: string;
    storeName: string;
    status: 'draft' | 'verified' | 'paid';
  };
  onUpdate: (field: string, value: any) => void;
}

const PurchaseInvoiceHeader = ({ invoice, onUpdate }: PurchaseInvoiceHeaderProps) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Invoice Details</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Invoice Number *
          </label>
          <input
            type="text"
            value={invoice.invoiceNumber}
            onChange={(e) => onUpdate('invoiceNumber', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Invoice Date *
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Calendar size={16} className="text-gray-400 dark:text-gray-500" />
            </div>
            <input
              type="date"
              value={invoice.invoiceDate}
              onChange={(e) => onUpdate('invoiceDate', e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Status
          </label>
          <select
            value={invoice.status}
            onChange={(e) => onUpdate('status', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="draft">Draft</option>
            <option value="verified">Verified</option>
            <option value="paid">Paid</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Supplier Name *
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Building size={16} className="text-gray-400 dark:text-gray-500" />
            </div>
            <input
              type="text"
              value={invoice.supplierName}
              onChange={(e) => onUpdate('supplierName', e.target.value)}
              placeholder="Enter supplier name"
              className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            PO Number
          </label>
          <input
            type="text"
            value={invoice.poNumber}
            onChange={(e) => onUpdate('poNumber', e.target.value)}
            placeholder="Purchase Order Number"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            GRN Number
          </label>
          <input
            type="text"
            value={invoice.grnNumber}
            onChange={(e) => onUpdate('grnNumber', e.target.value)}
            placeholder="Goods Receipt Note Number"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>
    </div>
  );
};

export default PurchaseInvoiceHeader;