import { useState } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Receipt, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Eye,
  Edit,
  Download,
  DollarSign,
  Upload
} from 'lucide-react';
import SupplierInvoiceModal from '../../components/purchase/modals/SupplierInvoiceModal';

const SupplierInvoicesPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<any>(null);
  const [selectedPO, setSelectedPO] = useState<any>(null);
  const [selectedGRN, setSelectedGRN] = useState<any>(null);

  // Mock data
  const [supplierInvoices, setSupplierInvoices] = useState([
    {
      id: 'inv1',
      invoiceNumber: 'SI-2024-001',
      supplierInvoiceNumber: 'SUP-INV-001',
      supplierName: 'ABC Suppliers Ltd',
      poNumber: 'PO-2024-001',
      invoiceDate: '2024-01-17',
      dueDate: '2024-02-16',
      status: 'verified',
      grandTotal: 25000,
      paidAmount: 0,
      balanceAmount: 25000
    },
    {
      id: 'inv2',
      invoiceNumber: 'SI-2024-002',
      supplierInvoiceNumber: 'SUP-INV-002',
      supplierName: 'XYZ Trading Co',
      poNumber: 'PO-2024-002',
      invoiceDate: '2024-01-16',
      dueDate: '2024-02-15',
      status: 'paid',
      grandTotal: 45000,
      paidAmount: 45000,
      balanceAmount: 0
    },
    {
      id: 'inv3',
      invoiceNumber: 'SI-2024-003',
      supplierInvoiceNumber: 'SUP-INV-003',
      supplierName: 'Global Distributors',
      poNumber: 'PO-2024-003',
      invoiceDate: '2024-01-15',
      dueDate: '2024-01-20',
      status: 'overdue',
      grandTotal: 15000,
      paidAmount: 7500,
      balanceAmount: 7500
    }
  ]);

  // Mock PO/GRN data for creating invoice
  const mockPOData = {
    poNumber: 'PO-2024-004',
    supplierName: 'New Supplier Ltd',
    items: [
      {
        productId: 'prod1',
        productName: 'Sample Product 1',
        quantity: 10,
        unitPrice: 100,
        taxRate: 18
      }
    ]
  };

  const mockGRNData = {
    grnNumber: 'GRN-2024-004',
    poNumber: 'PO-2024-004',
    supplierName: 'New Supplier Ltd',
    items: [
      {
        productId: 'prod1',
        productName: 'Sample Product 1',
        acceptedQuantity: 8,
        unitPrice: 100,
        taxRate: 18
      }
    ]
  };

  const handleSaveInvoice = (invoiceData: any) => {
    if (editingInvoice) {
      setSupplierInvoices(prev => prev.map(invoice => 
        invoice.id === editingInvoice.id ? { ...invoice, ...invoiceData } : invoice
      ));
    } else {
      const newInvoice = {
        ...invoiceData,
        id: `inv_${Date.now()}`,
        paidAmount: 0,
        balanceAmount: invoiceData.grandTotal
      };
      setSupplierInvoices(prev => [newInvoice, ...prev]);
    }
    setEditingInvoice(null);
    setSelectedPO(null);
    setSelectedGRN(null);
  };

  const handleEditInvoice = (invoice: any) => {
    setEditingInvoice(invoice);
    setShowInvoiceModal(true);
  };

  const handleNewInvoiceFromPO = () => {
    setSelectedPO(mockPOData);
    setEditingInvoice(null);
    setShowInvoiceModal(true);
  };

  const handleNewInvoiceFromGRN = () => {
    setSelectedGRN(mockGRNData);
    setEditingInvoice(null);
    setShowInvoiceModal(true);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft':
        return <Clock size={16} className="text-gray-600" />;
      case 'verified':
        return <CheckCircle size={16} className="text-primary-600" />;
      case 'approved':
        return <CheckCircle size={16} className="text-success-600" />;
      case 'paid':
        return <DollarSign size={16} className="text-success-600" />;
      case 'overdue':
        return <AlertTriangle size={16} className="text-error-600" />;
      default:
        return <Receipt size={16} className="text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      case 'verified':
        return 'bg-primary-100 text-primary-800 dark:bg-primary-900/50 dark:text-primary-400';
      case 'approved':
        return 'bg-success-100 text-success-800 dark:bg-success-900/50 dark:text-success-400';
      case 'paid':
        return 'bg-success-100 text-success-800 dark:bg-success-900/50 dark:text-success-400';
      case 'overdue':
        return 'bg-error-100 text-error-800 dark:bg-error-900/50 dark:text-error-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Supplier Invoices</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage supplier invoices and payments</p>
        </div>
        
        <div className="flex space-x-3">
          <button 
            onClick={handleNewInvoiceFromPO}
            className="flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <Upload size={18} className="mr-2" />
            From PO
          </button>
          <button 
            onClick={handleNewInvoiceFromGRN}
            className="flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <Upload size={18} className="mr-2" />
            From GRN
          </button>
          <button 
            onClick={() => {
              setEditingInvoice(null);
              setSelectedPO(null);
              setSelectedGRN(null);
              setShowInvoiceModal(true);
            }}
            className="flex items-center px-4 py-2 bg-primary-600 dark:bg-primary-500 text-white rounded-lg hover:bg-primary-700 dark:hover:bg-primary-600"
          >
            <Plus size={18} className="mr-2" />
            New Invoice
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-gray-400 dark:text-gray-500" />
            </div>
            <input
              type="text"
              placeholder="Search invoices..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
            />
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="verified">Verified</option>
            <option value="approved">Approved</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>
          
          <input
            type="date"
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
          />
          
          <button className="flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
            <Filter size={18} className="mr-2" />
            More Filters
          </button>
        </div>
      </div>

      {/* Invoices List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Invoice Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Supplier
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  PO Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Due Date
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {supplierInvoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {invoice.invoiceNumber}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        Supplier: {invoice.supplierInvoiceNumber}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500">
                        {new Date(invoice.invoiceDate).toLocaleDateString()}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-gray-100">{invoice.supplierName}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-gray-100">{invoice.poNumber}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getStatusIcon(invoice.status)}
                      <span className={`ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(invoice.status)}`}>
                        {invoice.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      ₹{invoice.grandTotal.toLocaleString('en-IN')}
                    </div>
                    {invoice.balanceAmount > 0 && (
                      <div className="text-xs text-error-600 dark:text-error-400">
                        Balance: ₹{invoice.balanceAmount.toLocaleString('en-IN')}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`text-sm ${
                      new Date(invoice.dueDate) < new Date() && invoice.status !== 'paid'
                        ? 'text-error-600 dark:text-error-400 font-medium'
                        : 'text-gray-900 dark:text-gray-100'
                    }`}>
                      {new Date(invoice.dueDate).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button className="text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300">
                        <Eye size={16} />
                      </button>
                      <button 
                        onClick={() => handleEditInvoice(invoice)}
                        className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                      >
                        <Edit size={16} />
                      </button>
                      <button className="text-secondary-600 dark:text-secondary-400 hover:text-secondary-800 dark:hover:text-secondary-300">
                        <Download size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Supplier Invoice Modal */}
      <SupplierInvoiceModal
        isOpen={showInvoiceModal}
        onClose={() => {
          setShowInvoiceModal(false);
          setEditingInvoice(null);
          setSelectedPO(null);
          setSelectedGRN(null);
        }}
        onSave={handleSaveInvoice}
        initialData={editingInvoice}
        poData={selectedPO}
        grnData={selectedGRN}
      />
    </div>
  );
};

export default SupplierInvoicesPage;