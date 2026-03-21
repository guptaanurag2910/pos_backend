import { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Search,
  CreditCard,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  Trash,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import ProcurementFlowStepper from '../../components/purchase/ProcurementFlowStepper';
import PaymentModal from '../../components/purchase/modals/PaymentModal';
import DeleteConfirmModal from '../../components/common/DeleteConfirmModal';
import {
  createSupplierPayment,
  deleteSupplierPayment,
  listPurchaseOrders,
  listSupplierInvoices,
  listSupplierPayments,
  listSuppliers,
  partialUpdateSupplierPayment,
  updateSupplierPayment,
} from '../../service/purchaseService';
import { useAuthStore } from '../../stores/authStore';

const toNumber = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const extractList = (response: any): any[] => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.results)) return response.results;
  return [];
};

const apiToUiPaymentMethod = (method: string) => {
  if (method === 'check') return 'cheque';
  return method;
};

const uiToApiPaymentMethod = (method: string) => {
  if (method === 'cheque') return 'check';
  return method;
};

const normalizePayment = (payment: any) => ({
  id: payment.id,
  paymentNumber: `PAY-${String(payment.id).padStart(6, '0')}`,
  supplierName: payment.supplier_name || '',
  supplierId: payment.supplier || null,
  purchaseOrderId: payment.purchase_order || null,
  supplierInvoiceId: payment.supplier_invoice || null,
  invoiceNumber: payment.supplier_invoice_number || payment.po_number || 'Manual Entry',
  paymentDate: payment.payment_date,
  amount: toNumber(payment.amount),
  paymentMethod: apiToUiPaymentMethod(payment.payment_method),
  referenceNumber: payment.reference_number || '',
  status: payment.status,
  notes: payment.notes || '',
});

const normalizeInvoice = (invoice: any) => {
  const grandTotal = toNumber(invoice.grand_total);
  const dueAmount =
    invoice.due_amount !== undefined && invoice.due_amount !== null
      ? toNumber(invoice.due_amount)
      : Math.max(grandTotal - toNumber(invoice.amount_paid), 0);

  return {
    id: invoice.id,
    supplierName: invoice.supplier_name_resolved || invoice.supplier_name || '',
    supplierId: invoice.supplier || null,
    purchaseOrderId: invoice.purchase_order || null,
    invoiceNumber: invoice.invoice_number,
    grandTotal,
    balanceAmount: dueAmount,
    dueDate: invoice.due_date,
    status: invoice.status,
  };
};

const SupplierPaymentsPage = () => {
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<any>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [deletePaymentId, setDeletePaymentId] = useState<number | null>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [openInvoices, setOpenInvoices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const user = useAuthStore((state) => state.user);
  const storeId = Number(user?.storeId || 0) || undefined;
  const mode = String(searchParams.get('mode') || '').toLowerCase();
  const queryPoId = Number(searchParams.get('po'));
  const queryInvoiceId = Number(searchParams.get('invoice'));
  const queryPaymentId = Number(searchParams.get('edit'));

  const loadData = async () => {
    setIsLoading(true);
    try {
      const scopeParams = {
        page_size: 500,
        ...(storeId ? { store: storeId } : {}),
      };

      const [paymentsResponse, suppliersResponse, invoicesResponse, purchaseOrdersResponse] = await Promise.all([
        listSupplierPayments(scopeParams),
        listSuppliers(),
        listSupplierInvoices(scopeParams),
        listPurchaseOrders(scopeParams),
      ]);

      const rawInvoices = extractList(invoicesResponse);
      const scopedInvoiceRows = storeId
        ? rawInvoices.filter((invoice: any) => Number(invoice.store) === storeId)
        : rawInvoices;
      const invoices = scopedInvoiceRows.map(normalizeInvoice);
      const allowedInvoiceIds = new Set(
        scopedInvoiceRows
          .map((invoice: any) => Number(invoice.id))
          .filter((id: number) => Number.isFinite(id) && id > 0)
      );

      const rawPurchaseOrders = extractList(purchaseOrdersResponse);
      const scopedPoRows = storeId
        ? rawPurchaseOrders.filter((po: any) => Number(po.store) === storeId)
        : rawPurchaseOrders;
      const allowedPoIds = new Set(
        scopedPoRows
          .map((po: any) => Number(po.id))
          .filter((id: number) => Number.isFinite(id) && id > 0)
      );

      const scopedPayments = extractList(paymentsResponse).filter((payment: any) => {
        const supplierInvoiceId = Number(payment.supplier_invoice || 0);
        const purchaseOrderId = Number(payment.purchase_order || 0);

        if (supplierInvoiceId > 0) return allowedInvoiceIds.has(supplierInvoiceId);
        if (purchaseOrderId > 0) return allowedPoIds.has(purchaseOrderId);
        if (!storeId) return true;
        return Number(payment.created_by || 0) === Number(user?.id || 0);
      });

      setPayments(scopedPayments.map(normalizePayment));
      setSuppliers(Array.isArray(suppliersResponse) ? suppliersResponse : []);
      setOpenInvoices(
        invoices.filter((invoice) => invoice.balanceAmount > 0 && invoice.status !== 'paid')
      );
    } catch (error) {
      console.error('Failed to load supplier payments:', error);
      toast.error('Failed to load supplier payments');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [storeId, user?.id]);

  useEffect(() => {
    const editId = Number(searchParams.get('edit'));
    if (Number.isInteger(editId) && editId > 0) {
      return;
    }

    const invoiceId = String(searchParams.get('invoice') || '').trim();
    const poId = Number(searchParams.get('po'));
    if (!invoiceId && !(Number.isInteger(poId) && poId > 0)) {
      return;
    }

    const matchedInvoice = openInvoices.find((invoice) => {
      if (invoiceId && String(invoice.id) === invoiceId) return true;
      if (Number.isInteger(poId) && poId > 0 && Number(invoice.purchaseOrderId) === poId) return true;
      return false;
    });

    if (!matchedInvoice) return;

    setSelectedInvoice({
      id: String(matchedInvoice.id),
      supplierName: matchedInvoice.supplierName,
      grandTotal: matchedInvoice.grandTotal,
      balanceAmount: matchedInvoice.balanceAmount,
      invoiceNumber: matchedInvoice.invoiceNumber,
      purchaseOrderId: matchedInvoice.purchaseOrderId,
    });
    setEditingPayment(null);
    setShowPaymentModal(true);
  }, [searchParams, openInvoices]);

  useEffect(() => {
    const editId = Number(searchParams.get('edit'));
    if (!(Number.isInteger(editId) && editId > 0)) return;
    if (showPaymentModal) return;
    const payment = payments.find((p) => Number(p.id) === editId);
    if (!payment) return;
    handleEditPayment(payment);
  }, [searchParams, payments, showPaymentModal]);

  const handleSavePayment = async (paymentData: any) => {
    try {
      const matchedSupplier = suppliers.find(
        (supplier) =>
          typeof supplier.name === 'string' &&
          supplier.name.toLowerCase() === String(paymentData.supplierName || '').toLowerCase()
      );

      const sourceInvoice = openInvoices.find(
        (invoice) => String(invoice.id) === String(paymentData.invoiceId)
      );

      const payload = {
        supplier: matchedSupplier?.id || sourceInvoice?.supplierId || editingPayment?.supplierId,
        purchase_order: sourceInvoice?.purchaseOrderId || editingPayment?.purchaseOrderId || null,
        supplier_invoice: sourceInvoice?.id || editingPayment?.supplierInvoiceId || null,
        amount: toNumber(paymentData.amount),
        payment_method: uiToApiPaymentMethod(paymentData.paymentMethod),
        reference_number: paymentData.referenceNumber || '',
        payment_date: paymentData.paymentDate,
        status: paymentData.status,
        notes: paymentData.notes || '',
      };

      if (!payload.supplier) {
        toast.error('Please use a valid supplier name');
        return false;
      }

      if (editingPayment?.id) {
        await updateSupplierPayment(Number(editingPayment.id), payload);
        toast.success('Supplier payment updated');
      } else {
        await createSupplierPayment(payload);
        toast.success('Supplier payment recorded');
      }

      setEditingPayment(null);
      setSelectedInvoice(null);
      setShowPaymentModal(false);
      await loadData();
      return true;
    } catch (error: any) {
      console.error('Failed to save payment:', error);
      toast.error(error?.response?.data?.detail || 'Failed to save payment');
      return false;
    }
  };

  const handleEditPayment = (payment: any) => {
    setEditingPayment({
      id: String(payment.id),
      paymentNumber: payment.paymentNumber,
      invoiceId: payment.supplierInvoiceId ? String(payment.supplierInvoiceId) : '',
      supplierName: payment.supplierName,
      supplierId: payment.supplierId || null,
      purchaseOrderId: payment.purchaseOrderId || null,
      supplierInvoiceId: payment.supplierInvoiceId || null,
      paymentDate: payment.paymentDate,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      referenceNumber: payment.referenceNumber,
      notes: payment.notes,
      status: payment.status,
    });
    setShowPaymentModal(true);
  };

  const handleDeletePayment = async (paymentId: number) => {
    try {
      await deleteSupplierPayment(paymentId);
      toast.success('Supplier payment deleted');
      await loadData();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.detail || 'Failed to delete supplier payment');
    } finally {
      setDeletePaymentId(null);
    }
  };

  const handleCompletePayment = async (paymentId: number) => {
    try {
      await partialUpdateSupplierPayment(paymentId, { status: 'completed' });
      toast.success('Payment marked as completed');
      await loadData();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.detail || 'Failed to complete payment');
    }
  };

  const handleNewPaymentForInvoice = () => {
    if (openInvoices.length === 0) {
      toast.error('No open invoices available for payment');
      return;
    }

    const sorted = [...openInvoices].sort(
      (a, b) => new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime()
    );
    const invoice = sorted[0];
    setSelectedInvoice({
      id: String(invoice.id),
      supplierName: invoice.supplierName,
      grandTotal: invoice.grandTotal,
      balanceAmount: invoice.balanceAmount,
      invoiceNumber: invoice.invoiceNumber,
      purchaseOrderId: invoice.purchaseOrderId,
    });
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
      case 'cancelled':
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
      case 'cancelled':
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
      case 'check':
        return 'Cheque';
      case 'cash':
        return 'Cash';
      case 'credit':
        return 'Credit';
      default:
        return method;
    }
  };

  const filteredPayments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return payments.filter((payment) => {
      const matchesSearch =
        query.length === 0 ||
        payment.paymentNumber.toLowerCase().includes(query) ||
        payment.supplierName.toLowerCase().includes(query) ||
        payment.invoiceNumber.toLowerCase().includes(query) ||
        payment.referenceNumber.toLowerCase().includes(query);
      const matchesStatus = statusFilter === 'all' || payment.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [payments, searchQuery, statusFilter]);

  return (
    <div className="space-y-6">
      <ProcurementFlowStepper
        currentStep={4}
        steps={{
          po: { done: mode !== 'direct_invoice' && mode !== 'direct_receipt', optional: true },
          grn: { done: mode !== 'direct_invoice', optional: true },
          pi: { done: true },
          payment: { done: true },
        }}
        contextIds={{
          poId:
            selectedInvoice?.purchaseOrderId ||
            editingPayment?.purchaseOrderId ||
            (Number.isInteger(queryPoId) && queryPoId > 0 ? queryPoId : null),
          invoiceId:
            selectedInvoice?.id ? Number(selectedInvoice.id) : (
              editingPayment?.supplierInvoiceId ||
              (Number.isInteger(queryInvoiceId) && queryInvoiceId > 0 ? queryInvoiceId : null)
            ),
          paymentId:
            editingPayment?.id ? Number(editingPayment.id) : (
              Number.isInteger(queryPaymentId) && queryPaymentId > 0 ? queryPaymentId : null
            ),
        }}
      />

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Supplier Payments</h1>
          <p className="text-gray-600 dark:text-gray-400">Step 4 of 4: Record supplier payments</p>
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

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

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
              {isLoading ? (
                <tr>
                  <td className="px-6 py-8 text-center text-gray-500 dark:text-gray-400" colSpan={7}>
                    Loading payments...
                  </td>
                </tr>
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td className="px-6 py-8 text-center text-gray-500 dark:text-gray-400" colSpan={7}>
                    No supplier payments found.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{payment.paymentNumber}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString() : '--'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-gray-100">{payment.supplierName || '--'}</div>
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
                      <div className="text-sm text-gray-900 dark:text-gray-100 capitalize">
                        {getPaymentMethodLabel(payment.paymentMethod)}
                      </div>
                      {payment.referenceNumber && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">Ref: {payment.referenceNumber}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(payment.status)}
                        <span
                          className={`ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(payment.status)}`}
                        >
                          {payment.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleCompletePayment(Number(payment.id))}
                          disabled={payment.status === 'completed'}
                          title={payment.status === 'completed' ? 'Already completed' : 'Mark as completed'}
                          className={`rounded border p-2 ${
                            payment.status === 'completed'
                              ? 'cursor-not-allowed border-green-300 bg-green-50 text-green-700'
                              : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          <CheckCircle size={16} />
                        </button>
                        <button
                          onClick={() => handleEditPayment(payment)}
                          title="View Payment"
                          className="rounded border border-blue-200 bg-blue-50 p-2 text-blue-700 hover:bg-blue-100"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => setDeletePaymentId(Number(payment.id))}
                          title="Delete Payment"
                          className="rounded border border-red-200 bg-red-50 p-2 text-red-700 hover:bg-red-100"
                        >
                          <Trash size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          setEditingPayment(null);
          setSelectedInvoice(null);
        }}
        onSave={handleSavePayment}
        initialData={editingPayment}
        invoiceData={selectedInvoice}
      />
      <DeleteConfirmModal
        isOpen={deletePaymentId !== null}
        title="Delete Supplier Payment"
        message="Soft delete this supplier payment?"
        onCancel={() => setDeletePaymentId(null)}
        onConfirm={() => {
          if (deletePaymentId !== null) handleDeletePayment(deletePaymentId);
        }}
      />
    </div>
  );
};

export default SupplierPaymentsPage;
