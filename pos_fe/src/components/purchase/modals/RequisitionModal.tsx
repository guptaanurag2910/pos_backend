import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Search } from 'lucide-react';
import { usePOSStore } from '../../../stores/posStore';

interface RequisitionItem {
  id: string;
  productId: string;
  productName: string;
  currentStock: number;
  requestedQuantity: number;
  unit: string;
  estimatedPrice: number;
  justification: string;
}

interface Requisition {
  id?: string;
  requisitionNumber: string;
  requestedBy: string;
  department: string;
  requestDate: string;
  requiredDate: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  items: RequisitionItem[];
  justification: string;
  estimatedValue: number;
}

interface RequisitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (requisition: Requisition) => void;
  initialData?: Requisition;
}

const RequisitionModal = ({ isOpen, onClose, onSave, initialData }: RequisitionModalProps) => {
  const { products } = usePOSStore();
  const [formData, setFormData] = useState<Requisition>({
    requisitionNumber: `REQ-${Date.now().toString().slice(-6)}`,
    requestedBy: '',
    department: '',
    requestDate: new Date().toISOString().split('T')[0],
    requiredDate: '',
    priority: 'medium',
    status: 'draft',
    items: [],
    justification: '',
    estimatedValue: 0
  });

  const [showProductSearch, setShowProductSearch] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState('');

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  useEffect(() => {
    calculateEstimatedValue();
  }, [formData.items]);

  const calculateEstimatedValue = () => {
    const total = formData.items.reduce((sum, item) => 
      sum + (item.requestedQuantity * item.estimatedPrice), 0
    );
    setFormData(prev => ({ ...prev, estimatedValue: total }));
  };

  const handleInputChange = (field: keyof Requisition, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addProductToRequisition = (product: any) => {
    const newItem: RequisitionItem = {
      id: `req_item_${Date.now()}`,
      productId: product.id,
      productName: product.name,
      currentStock: product.stock,
      requestedQuantity: 1,
      unit: product.unit,
      estimatedPrice: product.price,
      justification: ''
    };

    setFormData(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
    setShowProductSearch(false);
    setProductSearchQuery('');
  };

  const updateItem = (index: number, field: keyof RequisitionItem, value: any) => {
    const updatedItems = [...formData.items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setFormData(prev => ({ ...prev, items: updatedItems }));
  };

  const removeItem = (index: number) => {
    const updatedItems = formData.items.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, items: updatedItems }));
  };

  const handleSave = () => {
    if (!formData.requestedBy || !formData.department || formData.items.length === 0) {
      alert('Please fill in required fields and add at least one item');
      return;
    }
    onSave(formData);
    onClose();
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
    product.barcode.includes(productSearchQuery)
  );

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-error-100 text-error-800 dark:bg-error-900/50 dark:text-error-400';
      case 'high': return 'bg-warning-100 text-warning-800 dark:bg-warning-900/50 dark:text-warning-400';
      case 'medium': return 'bg-primary-100 text-primary-800 dark:bg-primary-900/50 dark:text-primary-400';
      case 'low': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-6xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between border-b dark:border-gray-700 px-6 py-4">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
            {initialData ? 'Edit Purchase Requisition' : 'New Purchase Requisition'}
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
                Requisition Number
              </label>
              <input
                type="text"
                value={formData.requisitionNumber}
                onChange={(e) => handleInputChange('requisitionNumber', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Request Date
              </label>
              <input
                type="date"
                value={formData.requestDate}
                onChange={(e) => handleInputChange('requestDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Required Date
              </label>
              <input
                type="date"
                value={formData.requiredDate}
                onChange={(e) => handleInputChange('requiredDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Requested By *
              </label>
              <input
                type="text"
                value={formData.requestedBy}
                onChange={(e) => handleInputChange('requestedBy', e.target.value)}
                placeholder="Name of requester"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Department *
              </label>
              <select
                value={formData.department}
                onChange={(e) => handleInputChange('department', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
              >
                <option value="">Select Department</option>
                <option value="Retail">Retail</option>
                <option value="Warehouse">Warehouse</option>
                <option value="Sales">Sales</option>
                <option value="Operations">Operations</option>
                <option value="Administration">Administration</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Priority
              </label>
              <select
                value={formData.priority}
                onChange={(e) => handleInputChange('priority', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
              <div className="mt-1">
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(formData.priority)}`}>
                  {formData.priority.charAt(0).toUpperCase() + formData.priority.slice(1)}
                </span>
              </div>
            </div>
          </div>

          {/* Items Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100">Requested Items</h3>
              <button
                onClick={() => setShowProductSearch(true)}
                className="flex items-center px-4 py-2 bg-primary-600 dark:bg-primary-500 text-white rounded-lg hover:bg-primary-700 dark:hover:bg-primary-600"
              >
                <Plus size={16} className="mr-2" />
                Add Item
              </button>
            </div>

            {/* Product Search Modal */}
            {showProductSearch && (
              <div className="mb-4 p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-800 dark:text-gray-100">Search Products</h4>
                  <button
                    onClick={() => setShowProductSearch(false)}
                    className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    <X size={16} />
                  </button>
                </div>
                
                <div className="relative mb-3">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search size={16} className="text-gray-400 dark:text-gray-500" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search by product name or barcode..."
                    value={productSearchQuery}
                    onChange={(e) => setProductSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
                  />
                </div>

                <div className="max-h-40 overflow-y-auto">
                  {filteredProducts.map(product => (
                    <div
                      key={product.id}
                      onClick={() => addProductToRequisition(product)}
                      className="flex items-center justify-between p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer rounded"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{product.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Stock: {product.stock} {product.unit} • Price: ₹{product.price}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Items Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Product</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Current Stock</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Requested Qty</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Est. Price</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Justification</th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {formData.items.map((item, index) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.productName}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Unit: {item.unit}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-sm ${item.currentStock <= 5 ? 'text-error-600 dark:text-error-400 font-medium' : 'text-gray-900 dark:text-gray-100'}`}>
                          {item.currentStock}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          min="1"
                          value={item.requestedQuantity}
                          onChange={(e) => updateItem(index, 'requestedQuantity', parseInt(e.target.value) || 1)}
                          className="w-16 px-2 py-1 text-center border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded text-sm text-gray-900 dark:text-gray-100"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.estimatedPrice}
                          onChange={(e) => updateItem(index, 'estimatedPrice', parseFloat(e.target.value) || 0)}
                          className="w-20 px-2 py-1 text-right border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded text-sm text-gray-900 dark:text-gray-100"
                        />
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-gray-100">
                        ₹{(item.requestedQuantity * item.estimatedPrice).toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <textarea
                          value={item.justification}
                          onChange={(e) => updateItem(index, 'justification', e.target.value)}
                          placeholder="Why is this needed?"
                          rows={2}
                          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded text-xs text-gray-900 dark:text-gray-100"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => removeItem(index)}
                          className="text-error-600 dark:text-error-400 hover:text-error-800 dark:hover:text-error-300"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {formData.items.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No items added yet. Click "Add Item" to start building your requisition.
                </div>
              )}
            </div>
          </div>

          {/* Summary and Justification */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">Estimated Value</h3>
              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="text-2xl font-bold text-primary-700 dark:text-primary-400">
                  ₹{formData.estimatedValue.toFixed(2)}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Total estimated cost for {formData.items.length} items
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">Overall Justification</h3>
              <textarea
                value={formData.justification}
                onChange={(e) => handleInputChange('justification', e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
                placeholder="Provide overall justification for this requisition..."
              />
            </div>
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
            {initialData ? 'Update Requisition' : 'Create Requisition'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RequisitionModal;