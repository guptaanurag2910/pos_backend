import { useEffect, useState } from 'react';
import {
  Plus, Search, Clock, CheckCircle, Truck, Eye, Trash, Send, Circle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  listPurchaseOrders,
  deletePurchaseOrder,
  listGRNs,
  listSupplierInvoices,
  listSupplierPayments,
} from '../../service/purchaseService';
import ProcurementFlowStepper from '../../components/purchase/ProcurementFlowStepper';

const PurchaseOrdersPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [workflowMap, setWorkflowMap] = useState<Record<number, {
    grn: boolean;
    invoice: boolean;
    payment: boolean;
    grnId?: number | null;
    invoiceId?: number | null;
    paymentId?: number | null;
  }>>({});
  const navigate = useNavigate();

  useEffect(() => {
    const loadData = async () => {
      try {
        const [poRes, grnRes, invoiceRes, paymentRes] = await Promise.all([
          listPurchaseOrders({ page_size: 500 }),
          listGRNs({ page_size: 500 }),
          listSupplierInvoices({ page_size: 500 }),
          listSupplierPayments({ page_size: 500 }),
        ]);

        const poList = Array.isArray(poRes?.results) ? poRes.results : [];
        const grnList = Array.isArray(grnRes?.results) ? grnRes.results : [];
        const invoiceList = Array.isArray(invoiceRes?.results) ? invoiceRes.results : [];
        const paymentList = Array.isArray(paymentRes?.results) ? paymentRes.results : [];

        setPurchaseOrders(poList);

        const nextMap: Record<number, {
          grn: boolean;
          invoice: boolean;
          payment: boolean;
          grnId?: number | null;
          invoiceId?: number | null;
          paymentId?: number | null;
        }> = {};
        poList.forEach((po: any) => {
          const id = Number(po.id);
          const poGRNs = grnList.filter((g: any) => Number(g.purchase_order) === id);
          const poInvoices = invoiceList.filter((inv: any) => Number(inv.purchase_order) === id);
          const poPayments = paymentList.filter((p: any) => Number(p.purchase_order) === id);
          const latestGRN = poGRNs[0] || null;
          const latestInvoice = poInvoices[0] || null;
          const latestPayment = poPayments[0] || null;
          const completedPayment = poPayments.find((p: any) => p.status === 'completed') || latestPayment;
          nextMap[id] = {
            grn: !!latestGRN,
            invoice: !!latestInvoice,
            payment: !!completedPayment,
            grnId: latestGRN?.id || null,
            invoiceId: latestInvoice?.id || null,
            paymentId: completedPayment?.id || null,
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
                  <div className="flex justify-end flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-[11px] dark:border-gray-700">
                      {workflowMap[po.id]?.grn ? <CheckCircle size={12} className="text-green-600" /> : <Circle size={12} className="text-gray-400" />}
                      GRN
                    </span>
                    <span className="inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-[11px] dark:border-gray-700">
                      {workflowMap[po.id]?.invoice ? <CheckCircle size={12} className="text-green-600" /> : <Circle size={12} className="text-gray-400" />}
                      SI
                    </span>
                    <span className="inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-[11px] dark:border-gray-700">
                      {workflowMap[po.id]?.payment ? <CheckCircle size={12} className="text-green-600" /> : <Circle size={12} className="text-gray-400" />}
                      Payment
                    </span>
                    <button
                      onClick={() =>
                        workflowMap[po.id]?.grnId
                          ? navigate(`/grns/${workflowMap[po.id]?.grnId}?po=${po.id}`)
                          : navigate(`/grns/new?po=${po.id}`)
                      }
                      className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
                    >
                      {workflowMap[po.id]?.grn ? 'Open GRN' : 'Create GRN'}
                    </button>
                    <button
                      onClick={() =>
                        workflowMap[po.id]?.invoiceId
                          ? navigate(`/purchase/invoices?edit=${workflowMap[po.id]?.invoiceId}&po=${po.id}`)
                          : workflowMap[po.id]?.grnId
                            ? navigate(`/purchase/invoices?grn=${workflowMap[po.id]?.grnId}&po=${po.id}`)
                            : navigate(`/purchase/invoices?po=${po.id}`)
                      }
                      className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
                    >
                      {workflowMap[po.id]?.invoice ? 'Open SI' : 'Create SI'}
                    </button>
                    <button
                      onClick={() =>
                        workflowMap[po.id]?.paymentId
                          ? navigate(`/purchase/payments?edit=${workflowMap[po.id]?.paymentId}&po=${po.id}`)
                          : workflowMap[po.id]?.invoiceId
                            ? navigate(`/purchase/payments?invoice=${workflowMap[po.id]?.invoiceId}&po=${po.id}`)
                            : navigate(`/purchase/payments?po=${po.id}`)
                      }
                      className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
                    >
                      {workflowMap[po.id]?.payment ? 'Open Payment' : 'Record Payment'}
                    </button>
                    <button onClick={() => navigate(`/purchase-orders/${po.id}`)} className="text-blue-600 hover:text-blue-800"><Eye size={16} /></button>
                    <button onClick={() => setDeleteId(po.id)} className="text-red-600 hover:text-red-800"><Trash size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation */}
      {deleteId !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg w-full max-w-md">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Confirm Deletion</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">Are you sure you want to delete this purchase order?</p>
            <div className="flex justify-end space-x-3">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded">
                Cancel
              </button>
              <button onClick={confirmDelete} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseOrdersPage;
