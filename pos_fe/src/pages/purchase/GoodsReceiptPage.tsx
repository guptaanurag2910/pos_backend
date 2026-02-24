import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Clock,
  CheckCircle,
  AlertTriangle,
  Eye,
  Package,
  Trash,
  FileText,
} from 'lucide-react';
import { completeGRN, deleteGRN, listGRNs, listSupplierInvoices } from '../../service/purchaseService';
import toast from 'react-hot-toast';
import ProcurementFlowStepper from '../../components/purchase/ProcurementFlowStepper';
import DeleteConfirmModal from '../../components/common/DeleteConfirmModal';

const GoodsReceiptPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [grnRecords, setGrnRecords] = useState<any[]>([]);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [invoiceMap, setInvoiceMap] = useState<Record<number, number | null>>({});
  const [completingId, setCompletingId] = useState<number | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadGRNs();
  }, []);

  const loadGRNs = async () => {
    try {
      const [grnRes, invoiceRes] = await Promise.all([
        listGRNs({ page_size: 500 }),
        listSupplierInvoices({ page_size: 500 }),
      ]);
      const grnList = Array.isArray(grnRes?.results) ? grnRes.results : [];
      const invoiceList = Array.isArray(invoiceRes?.results) ? invoiceRes.results : [];
      setGrnRecords(grnList);

      const nextMap: Record<number, number | null> = {};
      grnList.forEach((grn: any) => {
        const id = Number(grn.id);
        const linked = invoiceList.find(
          (inv: any) =>
            Number(inv.goods_receipt || inv.grn || 0) === id
        );
        nextMap[id] = linked ? Number(linked.id) : null;
      });
      setInvoiceMap(nextMap);
    } catch (error) {
      console.error(error);
    }
  };

  const handleComplete = async (id: number) => {
    try {
      setCompletingId(id);
      await completeGRN(id);
      toast.success('GRN completed and inventory updated');
      await loadGRNs();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.detail || 'Failed to complete GRN');
    } finally {
      setCompletingId(null);
    }
  };

  const handleDeleteGRN = async (id: number) => {
    try {
      await deleteGRN(id);
      toast.success('GRN deleted');
      await loadGRNs();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.detail || 'Failed to delete GRN');
    } finally {
      setDeleteId(null);
    }
  };

  const filteredRecords = grnRecords.filter((grn) => {
    const matchesSearch =
      grn.grn_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      grn.po_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      grn.supplier_name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' || grn.status?.toLowerCase() === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft':
        return <Clock size={16} className="text-gray-600" />;
      case 'completed':
        return <CheckCircle size={16} className="text-green-600" />;
      case 'discrepancy':
        return <AlertTriangle size={16} className="text-yellow-600" />;
      default:
        return <Package size={16} className="text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'discrepancy':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  return (
    <div className="space-y-6">
      <ProcurementFlowStepper
        currentStep={2}
        steps={{
          po: { done: false, optional: true },
          grn: { done: true, optional: true },
          pi: { done: false },
          payment: { done: false },
        }}
      />

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Goods Receipt Notes</h1>
          <p className="text-gray-600 dark:text-gray-400">Step 2 of 4: Receive items against purchase orders</p>
        </div>
        <button
          onClick={() => navigate('/grns/new')}
          className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 dark:hover:bg-primary-600"
        >
          <Plus size={18} className="mr-2" />
          New GRN
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-gray-400 dark:text-gray-500" />
            </div>
            <input
              type="text"
              placeholder="Search GRN records..."
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
            <option value="completed">Completed</option>
            <option value="discrepancy">With Discrepancy</option>
          </select>

        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  GRN Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Purchase Order
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Supplier
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Items Received
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Received By
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredRecords.map((grn) => {
                const percentage =
                  grn.items_count > 0
                    ? Math.round((grn.received_items / grn.items_count) * 100)
                    : 0;
                const progressColor =
                  grn.discrepancies > 0 ? 'bg-yellow-500' : 'bg-green-500';

                return (
                  <tr key={grn.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {grn.grn_number}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {grn.receipt_date ? new Date(grn.receipt_date).toLocaleDateString('en-GB') : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4">{grn.po_number || '-'}</td>
                    <td className="px-6 py-4">{grn.supplier_name}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        {getStatusIcon(grn.status)}
                        <span
                          className={`ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                            grn.status
                          )}`}
                        >
                          {grn.status}
                        </span>
                      </div>
                      {grn.discrepancies > 0 && (
                        <div className="text-xs text-yellow-600 mt-1">
                          {grn.discrepancies} discrepancies
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        {grn.received_items}/{grn.items_count} items
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-1">
                        <div
                          className={`h-2 rounded-full ${progressColor}`}
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </td>
                    <td className="px-6 py-4">{grn.received_by}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() =>
                            invoiceMap[Number(grn.id)]
                              ? navigate(`/purchase/invoices?edit=${invoiceMap[Number(grn.id)]}&grn=${grn.id}&po=${grn.purchase_order || ''}`)
                              : navigate(`/purchase/invoices?grn=${grn.id}&po=${grn.purchase_order || ''}`)
                          }
                          title={invoiceMap[Number(grn.id)] ? 'Open Supplier Invoice' : 'Create Supplier Invoice'}
                          className={`rounded border p-2 ${
                            invoiceMap[Number(grn.id)]
                              ? 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100'
                              : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          <FileText size={16} />
                        </button>
                        <button
                          onClick={() => navigate(`/grns/${grn.id}`)}
                          title="View GRN"
                          className="rounded border border-blue-200 bg-blue-50 p-2 text-blue-700 hover:bg-blue-100"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => handleComplete(Number(grn.id))}
                          disabled={grn.status === 'completed' || completingId === Number(grn.id)}
                          title={grn.status === 'completed' ? 'Already completed' : 'Mark complete and update inventory'}
                          className={`rounded border p-2 ${
                            grn.status === 'completed'
                              ? 'cursor-not-allowed border-green-300 bg-green-50 text-green-700'
                              : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          <CheckCircle size={16} />
                        </button>
                        <button
                          onClick={() => setDeleteId(Number(grn.id))}
                          title="Delete GRN"
                          className="rounded border border-red-200 bg-red-50 p-2 text-red-700 hover:bg-red-100"
                        >
                          <Trash size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-gray-500 dark:text-gray-400">
                    No GRNs found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <DeleteConfirmModal
        isOpen={deleteId !== null}
        title="Delete GRN"
        message="Soft delete this GRN? You can still view it with include_inactive=true."
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId !== null) handleDeleteGRN(deleteId);
        }}
      />
    </div>
  );
};

export default GoodsReceiptPage;
