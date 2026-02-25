import { useEffect, useState } from 'react';
import {
  Plus, Search, Clock, CheckCircle, Truck, Eye, Trash, Send, Package
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  listPurchaseOrders,
  deletePurchaseOrder,
  listGRNs,
} from '../../service/purchaseService';
import ProcurementFlowStepper from '../../components/purchase/ProcurementFlowStepper';
import DeleteConfirmModal from '../../components/common/DeleteConfirmModal';

const PurchaseOrdersPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [workflowMap, setWorkflowMap] = useState<Record<number, {
    grn: boolean;
    grnId?: number | null;
  }>>({});
  const navigate = useNavigate();

  useEffect(() => {
    const loadData = async () => {
      try {
        const [poRes, grnRes] = await Promise.all([
          listPurchaseOrders({ page_size: 500 }),
          listGRNs({ page_size: 500 }),
        ]);

        const poList = Array.isArray(poRes?.results) ? poRes.results : [];
        const grnList = Array.isArray(grnRes?.results) ? grnRes.results : [];

        setPurchaseOrders(poList);

        const nextMap: Record<number, {
          grn: boolean;
          grnId?: number | null;
        }> = {};
        poList.forEach((po: any) => {
          const id = Number(po.id);
          const poGRNs = grnList.filter((g: any) => Number(g.purchase_order) === id);
          const latestGRN = poGRNs[0] || null;
          nextMap[id] = {
            grn: !!latestGRN,
            grnId: latestGRN?.id || null,
          };
        });
        setWorkflowMap(nextMap);
      } catch (error) {
        console.error(error);
      }
    };

    loadData();
  }, []);

  const confirmDelete = async () => {
    if (deleteId === null) return;
    try {
      await deletePurchaseOrder(deleteId);
      toast.success('Purchase order deleted');
      setPurchaseOrders(prev => prev.filter(po => po.id !== deleteId));
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete purchase order');
    } finally {
      setDeleteId(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent': return <Send size={16} className="text-primary-600" />;
      case 'partially_received': return <Truck size={16} className="text-warning-600" />;
      case 'received': return <CheckCircle size={16} className="text-success-600" />;
      case 'draft':
      default: return <Clock size={16} className="text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'bg-primary-100 text-primary-800';
      case 'partially_received': return 'bg-yellow-100 text-yellow-800';
      case 'received': return 'bg-green-100 text-green-800';
      case 'draft':
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredOrders = purchaseOrders.filter((po) => {
    const matchesQuery = searchQuery === '' || po.po_number?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || po.status === statusFilter;
    return matchesQuery && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <ProcurementFlowStepper
        currentStep={1}
        steps={{
          po: { done: true, optional: true },
          grn: { done: false, optional: true },
          pi: { done: false },
          payment: { done: false },
        }}
        showScenarioActions
      />

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Purchase Orders</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage purchase orders and supplier communications</p>
        </div>
        <button
          onClick={() => navigate('/purchase-orders/new')}
          className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <Plus size={18} className="mr-2" /> New Purchase Order
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search purchase orders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="partially_received">Partially Received</option>
            <option value="received">Received</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              {['Purchase Order', 'Supplier', 'Status', 'Items', 'Total Amount', 'Expected Delivery', 'Actions'].map(h => (
                <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filteredOrders.map(po => (
              <tr key={po.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                {/* PO Number + Order Date */}
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{po.po_number}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">{new Date(po.order_date).toLocaleDateString()}</div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-200">{po.supplier_name}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    {getStatusIcon(po.status)}
                    <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${getStatusColor(po.status)}`}>
                      {po.status.replace('_', ' ')}
                    </span>
                  </div>
                </td>
                {/* Items Progress */}
                <td className="px-6 py-4">
                  {(() => {
                    const totalItems = Number(po.items_count) || 0;
                    const receivedItems = Number(po.received_items) || 0;
                    const progress = totalItems > 0 ? (receivedItems / totalItems) * 100 : 0;
                    return (
                      <>
                        <div className="text-sm text-gray-900 dark:text-gray-100">
                          {receivedItems}/{totalItems} received
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-1">
                          <div
                            className="bg-primary-600 h-2 rounded-full"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </>
                    );
                  })()}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">₹{Number(po.total).toLocaleString('en-IN')}</td>
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-200">
                  {po.expected_delivery_date ? new Date(po.expected_delivery_date).toLocaleDateString() : '-'}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end items-center gap-2">
                    <button
                      onClick={() =>
                        workflowMap[po.id]?.grnId
                          ? navigate(`/grns/${workflowMap[po.id]?.grnId}?po=${po.id}`)
                          : navigate(`/grns/new?po=${po.id}`)
                      }
                      title={workflowMap[po.id]?.grn ? 'Open GRN' : 'Create GRN'}
                      className={`rounded border p-2 ${
                        workflowMap[po.id]?.grn
                          ? 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100'
                          : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <Package size={16} />
                    </button>
                    <button
                      onClick={() => navigate(`/purchase-orders/${po.id}`)}
                      title="View PO"
                      className="rounded border border-blue-200 bg-blue-50 p-2 text-blue-700 hover:bg-blue-100"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => setDeleteId(po.id)}
                      title="Delete PO"
                      className="rounded border border-red-200 bg-red-50 p-2 text-red-700 hover:bg-red-100"
                    >
                      <Trash size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DeleteConfirmModal
        isOpen={deleteId !== null}
        title="Delete Purchase Order"
        message="Soft delete this purchase order? It will be hidden from default views."
        onCancel={() => setDeleteId(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
};

export default PurchaseOrdersPage;
