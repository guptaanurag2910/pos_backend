
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  RotateCcw,
  Search,
  Filter,
  Plus,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  IndianRupee
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import ReturnModal from '../components/billing/ReturnModal';
import ReturnDetailsModal from '../components/billing/ReturnDetailsModal';
import {
  listReturns,
  createReturn,
  approveReturn,
  rejectReturn,
  completeReturn,
  Return as ReturnAPI,
  CreateReturnPayload
} from '../service/returnsService';
import { listBills, getBill } from '../service/salesService';
import { Bill } from '../types';
import toast from 'react-hot-toast';

const ReturnsPage = () => {
  const { user } = useAuthStore();
  const [completedBills, setCompletedBills] = useState<Bill[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<ReturnAPI | null>(null);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [returns, setReturns] = useState<ReturnAPI[]>([]);
  const [selectedRow, setSelectedRow] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredReturns = useMemo(
    () =>
      returns.filter((returnItem) => {
        const matchesSearch = searchQuery
          ? (returnItem.returnNumber?.toLowerCase()?.includes(searchQuery.toLowerCase()) ||
             returnItem.billNumber?.toLowerCase()?.includes(searchQuery.toLowerCase()) ||
             returnItem.customerName?.toLowerCase()?.includes(searchQuery.toLowerCase()))
          : true;

        const matchesStatus = statusFilter === 'all' || returnItem.status === statusFilter;
        const matchesDate = dateFilter ? returnItem.returnDate === dateFilter : true;

        return matchesSearch && matchesStatus && matchesDate;
      }),
    [returns, searchQuery, statusFilter, dateFilter]
  );

  useEffect(() => {
    fetchReturns();
    fetchCompletedBills();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const isCtrlOrMeta = event.ctrlKey || event.metaKey;

      if (event.key === 'F2') {
        event.preventDefault();
        if (showReturnModal) {
          const modalSearch = document.querySelector<HTMLInputElement>('[data-shortcut="return-bill-search"]');
          modalSearch?.focus();
          modalSearch?.select();
          return;
        }
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (event.key === 'F4') {
        event.preventDefault();
        setShowReturnModal(true);
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedRow((prev) => Math.min(prev + 1, Math.max(filteredReturns.length - 1, 0)));
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedRow((prev) => Math.max(prev - 1, 0));
        return;
      }

      if (event.key === 'Enter' && filteredReturns.length > 0 && !showReturnModal && !showDetailsModal) {
        event.preventDefault();
        const selected = filteredReturns[selectedRow];
        if (selected) handleViewReturn(selected);
        return;
      }

      if (isCtrlOrMeta && key === 'r') {
        event.preventDefault();
        void fetchReturns();
        void fetchCompletedBills();
        return;
      }

      if (event.key === 'Escape') {
        if (showDetailsModal) setShowDetailsModal(false);
        else if (showReturnModal) setShowReturnModal(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showReturnModal, showDetailsModal, filteredReturns, selectedRow]);

  useEffect(() => {
    setSelectedRow((prev) => Math.min(prev, Math.max(filteredReturns.length - 1, 0)));
  }, [filteredReturns.length]);

  const fetchReturns = async () => {
    try {
      const res = await listReturns();
      setReturns(Array.isArray(res?.results) ? res.results : []);
    } catch (err) {
      console.error('Failed to fetch returns:', err);
      setReturns([]);
    }
  };

  const fetchCompletedBills = async () => {
    try {
      const res = await listBills({ status: 'completed' });
      setCompletedBills(Array.isArray(res?.results) ? res.results : []);
    } catch (err) {
      console.error('Failed to fetch completed bills:', err);
      setCompletedBills([]);
    }
  };

  const handleCreateReturn = async (billId: string) => {
    try {
      const bill = await getBill(parseInt(billId));
      setSelectedBill(bill);
      setShowReturnModal(true);
    } catch (err) {
      console.error('Failed to fetch bill details:', err);
      toast.error('Unable to load bill details');
    }
  };

  const handleSaveReturn = async (payload: CreateReturnPayload) => {
    try {
      await createReturn(payload);
      await fetchReturns(); // Refresh after creation
      setSelectedBill(null);
      setShowReturnModal(false);
    } catch (err) {
      console.error('Failed to create return:', err);
      throw err;
    }
  };

  const handleViewReturn = (returnItem: ReturnAPI) => {
    setSelectedReturn(returnItem);
    setShowDetailsModal(true);
  };

  const handleApproveReturn = async (returnId: number) => {
    try {
      await approveReturn(returnId);
      toast.success('Return approved');
      await fetchReturns(); // Refresh after approval
    } catch (err) {
      console.error('Approve failed:', err);
      toast.error('Failed to approve return');
    }
  };

  const handleRejectReturn = async (returnId: number) => {
    try {
      await rejectReturn(returnId);
      toast.success('Return rejected');
      await fetchReturns(); // Refresh after rejection
    } catch (err) {
      console.error('Reject failed:', err);
      toast.error('Failed to reject return');
    }
  };

  const handleCompleteReturn = async (returnId: number) => {
    try {
      await completeReturn(returnId);
      toast.success('Return completed');
      await fetchReturns();
    } catch (err) {
      console.error('Complete failed:', err);
      toast.error('Failed to complete return');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock size={16} className="text-warning-600 dark:text-warning-400" />;
      case 'approved':
        return <CheckCircle size={16} className="text-success-600 dark:text-success-400" />;
      case 'completed':
        return <CheckCircle size={16} className="text-primary-600 dark:text-primary-400" />;
      case 'rejected':
        return <XCircle size={16} className="text-error-600 dark:text-error-400" />;
      default:
        return <Clock size={16} className="text-gray-600 dark:text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-warning-100 text-warning-800 dark:bg-warning-900/50 dark:text-warning-400';
      case 'approved':
        return 'bg-success-100 text-success-800 dark:bg-success-900/50 dark:text-success-400';
      case 'completed':
        return 'bg-primary-100 text-primary-800 dark:bg-primary-900/50 dark:text-primary-400';
      case 'rejected':
        return 'bg-error-100 text-error-800 dark:bg-error-900/50 dark:text-error-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  // ✅ Updated logic: treat both "approved" and "completed" as completed
  const completedStatuses = ['approved', 'completed'];
  const totalReturns = returns.length;
  const pendingReturns = returns.filter(r => r.status === 'pending').length;
  const completedReturns = returns.filter(r => completedStatuses.includes(r.status)).length;
  const totalRefundAmount = returns
  .filter(r => completedStatuses.includes(r.status))
  .reduce((sum, r) => {
    const amount = r.refund_amount ?? r.refundAmount ?? '0';
    return sum + parseFloat(amount);
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Returns & Refunds</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage product returns and customer refunds</p>
        </div>
        
        <button 
          data-testid="returns-process-button"
          onClick={() => setShowReturnModal(true)}
          className="flex items-center px-4 py-2 bg-primary-600 dark:bg-primary-500 text-white rounded-lg hover:bg-primary-700 dark:hover:bg-primary-600"
        >
          <Plus size={18} className="mr-2" />
          Process Return
        </button>
      </div>

      {/* ✅ Summary Cards now reflect accurate values */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
          <div className="flex items-center">
            <div className="p-2 bg-primary-100 dark:bg-primary-900 rounded-lg">
              <RotateCcw className="h-6 w-6 text-primary-600 dark:text-primary-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Returns</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{totalReturns}</p>
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
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{pendingReturns}</p>
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
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{completedReturns}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
          <div className="flex items-center">
            <div className="p-2 bg-secondary-100 dark:bg-secondary-900 rounded-lg">
              <IndianRupee className="h-6 w-6 text-secondary-600 dark:text-secondary-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Refunded</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">₹{totalRefundAmount.toFixed(2)}</p>
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
              ref={searchInputRef}
              data-testid="returns-search"
              type="text"
              placeholder="Search returns..."
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
            <option value="approved">Approved</option>
            <option value="completed">Completed</option>
            <option value="rejected">Rejected</option>
          </select>
          
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
          />
          
          <button className="flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
            <Filter size={18} className="mr-2" />
            More Filters
          </button>
        </div>
      </div>

      {/* Returns List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Return Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Original Bill
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Type & Reason
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Refund Amount
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
              {filteredReturns.map((returnItem, idx) => (
                <tr
                  key={returnItem.id}
                  className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${idx === selectedRow ? 'bg-primary-50 dark:bg-primary-900/20' : ''}`}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {returnItem.returnNumber}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(returnItem.returnDate).toLocaleDateString()}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <FileText size={16} className="text-gray-400 dark:text-gray-500 mr-2" />
                      <span className="text-sm text-gray-900 dark:text-gray-100">{returnItem.billNumber}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-gray-100">
                      {returnItem.customerName || 'Walk-in Customer'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        returnItem.returnType === 'full' 
                          ? 'bg-error-100 text-error-800 dark:bg-error-900/50 dark:text-error-400'
                          : 'bg-warning-100 text-warning-800 dark:bg-warning-900/50 dark:text-warning-400'
                      }`}>
                        {returnItem.returnType || 'partial'}
                      </span>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {returnItem.reason || '—'}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      ₹{Number(returnItem.refundAmount || 0).toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                      via {(returnItem.refundMethod || 'unknown').replace('_', ' ')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getStatusIcon(returnItem.status)}
                      <span className={`ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(returnItem.status)}`}>
                        {returnItem.status || 'unknown'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button 
                        onClick={() => handleViewReturn(returnItem)}
                        className="text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300"
                      >
                        <Eye size={16} />
                      </button>
                      {returnItem.status === 'pending' && (user?.role === 'admin' || user?.role === 'manager') && (
                        <>
                          <button 
                            onClick={() => handleApproveReturn(returnItem.id)}
                            className="text-success-600 dark:text-success-400 hover:text-success-800 dark:hover:text-success-300"
                          >
                            <CheckCircle size={16} />
                          </button>
                          <button 
                            onClick={() => handleRejectReturn(returnItem.id)}
                            className="text-error-600 dark:text-error-400 hover:text-error-800 dark:hover:text-error-300"
                          >
                            <XCircle size={16} />
                          </button>
                        </>
                      )}
                      {returnItem.status === 'approved' && (user?.role === 'admin' || user?.role === 'manager') && (
                        <button
                          onClick={() => handleCompleteReturn(returnItem.id)}
                          className="text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300"
                          title="Complete Return"
                        >
                          <CheckCircle size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredReturns.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-16 w-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center text-gray-400 dark:text-gray-500 mb-4">
                <RotateCcw size={32} />
              </div>
              <p className="text-gray-500 dark:text-gray-400 font-medium">No returns found</p>
              <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
                {searchQuery || statusFilter !== 'all' || dateFilter
                  ? 'Try adjusting your search or filters'
                  : 'Process your first return to see it here'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Return Modal */}
      <ReturnModal
        isOpen={showReturnModal}
        onClose={() => {
          setShowReturnModal(false);
          setSelectedBill(null);
        }}
        onSave={handleSaveReturn}
        selectedBill={selectedBill}
        completedBills={completedBills}
        onSelectBill={handleCreateReturn}
      />

      {selectedReturn && (
        <ReturnDetailsModal
          isOpen={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedReturn(null);
          }}
          returnData={selectedReturn}
        />
      )}
    </div>
  );
};

export default ReturnsPage;
