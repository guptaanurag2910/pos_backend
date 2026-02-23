import { useState } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  CreditCard, 
  Clock, 
  CheckCircle, 
  XCircle,
  Eye,
  Edit,
  Download
} from 'lucide-react';
import PaymentModal from '../../components/purchase/modals/PaymentModal';

const SupplierPaymentsPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<any>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);

  // Mock data
  const [payments, setPayments] = useState([
    {
      id: 'pay1',
      paymentNumber: 'PAY-2024-001',
      supplierName: 'ABC Suppliers Ltd',
      invoiceNumber: 'SI-2024-001',
      paymentDate: '2024-01-18',
      amount: 25000,
      paymentMethod: 'bank_transfer',
      referenceNumber: 'UTR123456789',
      status: 'completed'
    },
    {
      id: 'pay2',
      paymentNumber: 'PAY-2024-002',
      supplierName: 'XYZ Trading Co',
      invoiceNumber: 'SI-2024-002',
      paymentDate: '2024-01-17',
      amount: 45000,
      paymentMethod: 'upi',
      referenceNumber: 'UPI987654321',
      status: 'completed'
    },
    {
      id: 'pay3',
      paymentNumber: 'PAY-2024-003',
      supplierName: 'Global Distributors',
      invoiceNumber: 'SI-2024-003',
      paymentDate: '2024-01-16',
      amount: 7500,
      paymentMethod: 'cheque',
      referenceNumber: 'CHQ001234',
      status: 'pending'
    }
  ]);

  // Mock invoice data for payment
  const mockInvoiceData = {
    id: 'inv_new',
    supplierName: 'New Supplier Ltd',
    grandTotal: 15000,
    balanceAmount: 15000
  };

  const handleSavePayment = (paymentData: any) => {
    if (editingPayment) {
      setPayments(prev => prev.map(payment => 
        payment.id === editingPayment.id ? { ...payment, ...paymentData } : payment
      ));
    } else {
      const newPayment = {
        ...paymentData,
        id: `pay_${Date.now()}`,
        invoiceNumber: selectedInvoice?.invoiceNumber || 'Manual Entry'
      };
      setPayments(prev => [newPayment, ...prev]);
    }
    setEditingPayment(null);
    setSelectedInvoice(null);
  };

  const handleEditPayment = (payment: any) => {
    setEditingPayment(payment);
    setShowPaymentModal(true);
  };

  const handleNewPaymentForInvoice = () => {
    setSelectedInvoice(mockInvoiceData);
    setEditingPayment(null);
    setShowPaymentModal(true);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock size={16} className="text-warning-600" />;
      case 'completed':
        return <CheckCircle size={16} className="text-success-600" />;
      case 'failed':
        return <XCircle size={16} className="text-error-600" />;
      default:
        return <CreditCard size={16} className="text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-warning-100 text-warning-800 dark:bg-warning-900/50 dark:text-warning-400';
      case 'completed':
        return 'bg-success-100 text-success-800 dark:bg-success-900/50 dark:text-success-400';
      case 'failed':
        return 'bg-error-100 text-error-800 dark:bg-error-900/50 dark:text-error-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'bank_transfer':
        return 'Bank Transfer';
      case 'upi':
        return 'UPI';
      case 'cheque':
        return 'Cheque';
      case 'cash':
        return 'Cash';
      case 'credit':
        return 'Credit';
      default:
        return method;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Supplier Payments</h1>
          <p className="text-gray-600 dark:text-gray-400">Track and manage payments to suppliers</p>
        </div>
        
        <div className="flex space-x-3">
          <button 
            onClick={handleNewPaymentForInvoice}
            className="flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <CreditCard size={18} className="mr-2" />
            Pay Invoice
          </button>
          <button 
            onClick={() => {
              setEditingPayment(null);
              setSelectedInvoice(null);
              setShowPaymentModal(true);
            }}
            className="flex items-center px-4 py-2 bg-primary-600 dark:bg-primary-500 text-white rounded-lg hover:bg-primary-700 dark:hover:bg-primary-600"
          >
            <Plus size={18} className="mr-2" />
            Record Payment
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
          <div className="flex items-center">
            <div className="p-2 bg-primary-100 dark:bg-primary-900 rounded-lg">
              <CreditCard className="h-6 w-6 text-primary-600 dark:text-primary-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Payments</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">₹77,500</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
          <div className="flex items-center">
            <div className="p-2 bg-success-100 dark:bg-success-900 rounded-lg">
              <CheckCircle className="h-6 w-6 text-success-600 dark:text-success-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Completed</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">₹70,000</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
          <div className="flex items-center">
            <div className="p-2 bg-warning-100 dark:bg-warning-900 rounded-lg">
              <Clock className="h-6 w-6 text-warning-600 dark:text-warning-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Pending</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">₹7,500</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
          <div className="flex items-center">
            <div className="p-2 bg-secondary-100 dark:bg-secondary-900 rounded-lg">
              <CreditCard className="h-6 w-6 text-secondary-600 dark:text-secondary-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">This Month</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">₹77,500</p>
            </div>
          </div>
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
              placeholder="Search payments..."
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
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
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

      {/* Payments List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Payment Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Supplier
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Invoice
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Payment Method
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {payments.map((payment) => (
                <tr key={payment.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {payment.paymentNumber}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(payment.paymentDate).toLocaleDateString()}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-gray-100">{payment.supplierName}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-gray-100">{payment.invoiceNumber}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      ₹{payment.amount.toLocaleString('en-IN')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-gray-100">
                      {getPaymentMethodLabel(payment.paymentMethod)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Ref: {payment.referenceNumber}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getStatusIcon(payment.status)}
                      <span className={`ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(payment.status)}`}>
                        {payment.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button className="text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300">
                        <Eye size={16} />
                      </button>
                      <button 
                        onClick={() => handleEditPayment(payment)}
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

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          setEditingPayment(null);
          setSelectedInvoice(null);
        }}
        onSave={handleSavePayment}
        invoiceData={selectedInvoice}
        initialData={editingPayment}
      />
    </div>
  );
};

export default SupplierPaymentsPage;