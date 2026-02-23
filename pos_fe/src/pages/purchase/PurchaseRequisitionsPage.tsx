import { AlertTriangle } from 'lucide-react';

const PurchaseRequisitionsPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Purchase Requisitions</h1>
        <p className="text-gray-600 dark:text-gray-400">Optional module. Core purchase flow starts directly from Purchase Orders.</p>
      </div>

      <div className="bg-amber-50 border border-amber-200 text-amber-900 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-200 rounded-lg p-4 flex items-start gap-3">
        <AlertTriangle size={18} className="mt-0.5" />
        <div>
          <p className="font-medium">Requisition API is not enabled.</p>
          <p className="text-sm opacity-90">Use this operational sequence for now: Purchase Order -&gt; GRN -&gt; Supplier Invoice -&gt; Supplier Payment.</p>
        </div>
      </div>
    </div>
  );
};

export default PurchaseRequisitionsPage;
