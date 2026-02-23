import { useState, useEffect } from 'react';
import { X, Package, AlertTriangle, CheckCircle } from 'lucide-react';

interface GRNItem {
  id: string;
  productId: string;
  productName: string;
  orderedQuantity: number;
  receivedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  batchNumber?: string;
  expiryDate?: string;
  condition: 'good' | 'damaged' | 'expired' | 'defective';
  notes: string;
}

interface GRN {
  id?: string;
  grnNumber: string;
  poNumber: string;
  supplierName: string;
  receivedDate: string;
  receivedBy: string;
  status: 'draft' | 'completed' | 'discrepancy';
  items: GRNItem[];
  notes: string;
  discrepancies: string[];
}

interface GRNModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (grn: GRN) => void;
  initialData?: GRN;
  poData?: any; // Purchase Order data to populate items
}

const GRNModal = ({ isOpen, onClose, onSave, initialData, poData }: GRNModalProps) => {
  const [formData, setFormData] = useState<GRN>({
    grnNumber: `GRN-${Date.now().toString().slice(-6)}`,
    poNumber: '',
    supplierName: '',
    receivedDate: new Date().toISOString().split('T')[0],
    receivedBy: '',
    status: 'draft',
    items: [],
    notes: '',
    discrepancies: []
  });

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else if (poData) {
      // Initialize from PO data
      setFormData(prev => ({
        ...prev,
        poNumber: poData.poNumber,
        supplierName: poData.supplierName,
        items: poData.items.map((item: any) => ({
          id: `grn_item_${Date.now()}_${Math.random()}`,
          productId: item.productId,
          productName: item.productName,
          orderedQuantity: item.quantity,
          receivedQuantity: 0,
          acceptedQuantity: 0,
          rejectedQuantity: 0,
          batchNumber: '',
          expiryDate: '',
          condition: 'good' as const,
          notes: ''
        }))
      }));
    }
  }, [initialData, poData]);

  const handleInputChange = (field: keyof GRN, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const updateItem = (index: number, field: keyof GRNItem, value: any) => {
    const updatedItems = [...formData.items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    
    // Auto-calculate accepted quantity when received quantity changes
    if (field === 'receivedQuantity') {
      const item = updatedItems[index];
      item.acceptedQuantity = Math.max(0, value - item.rejectedQuantity);
    }
    
    // Auto-calculate accepted quantity when rejected quantity changes
    if (field === 'rejectedQuantity') {
      const item = updatedItems[index];
      item.acceptedQuantity = Math.max(0, item.receivedQuantity - value);
    }

    setFormData(prev => ({ ...prev, items: updatedItems }));
  };

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'good': return 'text-success-600 dark:text-success-400';
      case 'damaged': return 'text-warning-600 dark:text-warning-400';
      case 'expired': return 'text-error-600 dark:text-error-400';
      case 'defective': return 'text-error-600 dark:text-error-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getConditionIcon = (condition: string) => {
    switch (condition) {
      case 'good': return <CheckCircle size={16} className="text-success-600 dark:text-success-400" />;
      case 'damaged': return <AlertTriangle size={16} className="text-warning-600 dark:text-warning-400" />;
      case 'expired': return <AlertTriangle size={16} className="text-error-600 dark:text-error-400" />;
      case 'defective': return <AlertTriangle size={16} className="text-error-600 dark:text-error-400" />;
      default: return <Package size={16} className="text-gray-600 dark:text-gray-400" />;
    }
  };

  const calculateStatus = () => {
    const hasDiscrepancies = formData.items.some(item => 
      item.receivedQuantity !== item.orderedQuantity || 
      item.rejectedQuantity > 0 || 
      item.condition !== 'good'
    );
    
    return hasDiscrepancies ? 'discrepancy' : 'completed';
  };

  const handleSave = () => {
    if (!formData.poNumber || !formData.supplierName || !formData.receivedBy) {
      alert('Please fill in all required fields');
      return;
    }

    const finalData = {
      ...formData,
      status: calculateStatus() as 'draft' | 'completed' | 'discrepancy'
    };

    onSave(finalData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-6xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between border-b dark:border-gray-700 px-6 py-4">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
            {initialData ? 'Edit Goods Receipt Note' : 'New Goods Receipt Note'}
          </h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Header Information */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                GRN Number
              </label>
              <input
                type="text"
                value={formData.grnNumber}
                onChange={(e) => handleInputChange('grnNumber', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                PO Number *
              </label>
              <input
                type="text"
                value={formData.poNumber}
                onChange={(e) => handleInputChange('poNumber', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Received Date
              </label>
              <input
                type="date"
                value={formData.receivedDate}
                onChange={(e) => handleInputChange('receivedDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Supplier Name *
              </label>
              <input
                type="text"
                value={formData.supplierName}
                onChange={(e) => handleInputChange('supplierName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Received By *
              </label>
              <input
                type="text"
                value={formData.receivedBy}
                onChange={(e) => handleInputChange('receivedBy', e.target.value)}
                placeholder="Name of person receiving goods"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>

          {/* Items Section */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">Received Items</h3>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Product</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ordered</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Received</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Accepted</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Rejected</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Batch/Expiry</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Condition</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Notes</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {formData.items.map((item, index) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.productName}</div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm text-gray-900 dark:text-gray-100">{item.orderedQuantity}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          min="0"
                          value={item.receivedQuantity}
                          onChange={(e) => updateItem(index, 'receivedQuantity', parseInt(e.target.value) || 0)}
                          className="w-16 px-2 py-1 text-center border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded text-sm text-gray-900 dark:text-gray-100"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm font-medium text-success-600 dark:text-success-400">
                          {item.acceptedQuantity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          min="0"
                          max={item.receivedQuantity}
                          value={item.rejectedQuantity}
                          onChange={(e) => updateItem(index, 'rejectedQuantity', parseInt(e.target.value) || 0)}
                          className="w-16 px-2 py-1 text-center border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded text-sm text-gray-900 dark:text-gray-100"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <input
                            type="text"
                            placeholder="Batch #"
                            value={item.batchNumber || ''}
                            onChange={(e) => updateItem(index, 'batchNumber', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded text-xs text-gray-900 dark:text-gray-100"
                          />
                          <input
                            type="date"
                            value={item.expiryDate || ''}
                            onChange={(e) => updateItem(index, 'expiryDate', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded text-xs text-gray-900 dark:text-gray-100"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center">
                          {getConditionIcon(item.condition)}
                          <select
                            value={item.condition}
                            onChange={(e) => updateItem(index, 'condition', e.target.value)}
                            className={`ml-2 px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded text-xs ${getConditionColor(item.condition)}`}
                          >
                            <option value="good">Good</option>
                            <option value="damaged">Damaged</option>
                            <option value="expired">Expired</option>
                            <option value="defective">Defective</option>
                          </select>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <textarea
                          value={item.notes}
                          onChange={(e) => updateItem(index, 'notes', e.target.value)}
                          placeholder="Notes..."
                          rows={2}
                          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded text-xs text-gray-900 dark:text-gray-100"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {formData.items.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No items to receive. Please select a Purchase Order first.
                </div>
              )}
            </div>
          </div>

          {/* General Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              General Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
              placeholder="Overall notes about the delivery, quality issues, etc."
            />
          </div>
        </div>

        <div className="border-t dark:border-gray-700 px-6 py-4 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-primary-600 dark:bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-700 dark:hover:bg-primary-600"
          >
            {initialData ? 'Update GRN' : 'Create GRN'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GRNModal;