import { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Search,
  Receipt,
  Clock,
  CheckCircle,
  Edit,
  IndianRupee,
  Upload,
} from 'lucide-react';
import toast from 'react-hot-toast';
import SupplierInvoiceModal from '../../components/purchase/modals/SupplierInvoiceModal';
import {
  createSupplierInvoice,
  getGRN,
  listGRNs,
  listSupplierInvoices,
  listSuppliers,
  updateSupplierInvoice,
} from '../../service/purchaseService';

const toNumber = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const extractList = (response: any): any[] => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.results)) return response.results;
  return [];
};

const normalizeInvoice = (invoice: any) => {
  const grandTotal = toNumber(invoice.grand_total);
  const paidAmount = toNumber(invoice.amount_paid);
  const dueAmount =
    invoice.due_amount !== undefined && invoice.due_amount !== null
      ? toNumber(invoice.due_amount)
      : Math.max(grandTotal - paidAmount, 0);

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoice_number,
    supplierInvoiceNumber: invoice.supplier_invoice_number,
    supplierName: invoice.supplier_name_resolved || invoice.supplier_name || '',
    supplierId: invoice.supplier || null,
    poNumber: invoice.po_number_resolved || invoice.po_number || '',
    purchaseOrderId: invoice.purchase_order || null,
    grnNumber: invoice.grn_number_resolved || invoice.grn_number || '',
    grnId: invoice.grn || null,
    invoiceDate: invoice.invoice_date,
    dueDate: invoice.due_date,
    status: invoice.status,
    subtotal: toNumber(invoice.subtotal),
    discountTotal: toNumber(invoice.discount_total),
    taxTotal: toNumber(invoice.tax_total),
    shippingCharges: toNumber(invoice.shipping_charges),
    grandTotal,
    paidAmount,
    balanceAmount: dueAmount,
    paymentTerms: invoice.payment_terms || 'Net 30',
    notes: invoice.notes || '',
    items: Array.isArray(invoice.items)
      ? invoice.items.map((item: any) => ({
          id: String(item.id),
          productId: item.product_code || String(item.product_ref || ''),
          productName: item.product_name_resolved || item.product_name || '',
          quantity: toNumber(item.quantity),
          unitPrice: toNumber(item.unit_price),
          discount: toNumber(item.discount),
          discountType: item.discount_type === 'amount' ? 'amount' : 'percentage',
          taxRate: toNumber(item.tax_rate),
          total: toNumber(item.total),
        }))
      : [],
  };
};

const SupplierInvoicesPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<any>(null);
  const [selectedGRN, setSelectedGRN] = useState<any>(null);
  const [supplierInvoices, setSupplierInvoices] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadInvoices = async () => {
    setIsLoading(true);
    try {
      const [invoiceResponse, suppliersResponse] = await Promise.all([
        listSupplierInvoices({ page_size: 500 }),
        listSuppliers(),
      ]);
      setSupplierInvoices(extractList(invoiceResponse).map(normalizeInvoice));
      setSuppliers(Array.isArray(suppliersResponse) ? suppliersResponse : []);
    } catch (error) {
      console.error('Failed to load supplier invoices:', error);
      toast.error('Failed to load supplier invoices');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, []);

  const buildInvoicePayload = (invoiceData: any) => {
    const supplierName = invoiceData.supplierName?.trim();
    const matchedSupplier = suppliers.find(
      (supplier) =>
        typeof supplier.name === 'string' &&
        supplier.name.toLowerCase() === String(supplierName || '').toLowerCase()
    );

    return {
      invoice_number: invoiceData.invoiceNumber,
      supplier_invoice_number: invoiceData.supplierInvoiceNumber,
      supplier_name: supplierName,
      supplier: matchedSupplier?.id || editingInvoice?.supplierId || null,
      po_number: invoiceData.poNumber || null,
      grn_number: invoiceData.grnNumber || null,
      invoice_date: invoiceData.invoiceDate,
      due_date: invoiceData.dueDate,
      status: invoiceData.status,
      payment_terms: invoiceData.paymentTerms,
      subtotal: toNumber(invoiceData.subtotal),
      discount_total: toNumber(invoiceData.discountTotal),
      tax_total: toNumber(invoiceData.taxTotal),
      shipping_charges: toNumber(invoiceData.shippingCharges),
      grand_total: toNumber(invoiceData.grandTotal),
      notes: invoiceData.notes || '',
      items: (invoiceData.items || []).map((item: any) => {
        const productIdAsNumber = Number(item.productId);
        const isNumericProductRef = Number.isInteger(productIdAsNumber) && productIdAsNumber > 0;
        const baseAmount = toNumber(item.quantity) * toNumber(item.unitPrice);
        const discountAmount =
          item.discountType === 'amount'
            ? toNumber(item.discount)
            : (baseAmount * toNumber(item.discount)) / 100;
        const taxableAmount = Math.max(baseAmount - discountAmount, 0);
        const taxAmount = (taxableAmount * toNumber(item.taxRate)) / 100;

        return {
          product_ref: isNumericProductRef ? productIdAsNumber : null,
          product_code: isNumericProductRef ? null : item.productId || null,
          product_name: item.productName,
          quantity: toNumber(item.quantity),
          unit_price: toNumber(item.unitPrice),
          discount: toNumber(item.discount),
          discount_type: item.discountType,
          tax_rate: toNumber(item.taxRate),
          tax_amount: taxAmount,
          total: taxableAmount + taxAmount,
        };
      }),
    };
  };

  const handleSaveInvoice = async (invoiceData: any) => {
    setIsSaving(true);
    try {
      const payload = buildInvoicePayload(invoiceData);
      if (editingInvoice?.id) {
        await updateSupplierInvoice(editingInvoice.id, payload);
        toast.success('Supplier invoice updated');
      } else {
        await createSupplierInvoice(payload);
        toast.success('Supplier invoice created');
      }

      setEditingInvoice(null);
      setSelectedGRN(null);
      setShowInvoiceModal(false);
      await loadInvoices();
      return true;
    } catch (error: any) {
      console.error('Failed to save supplier invoice:', error);
      toast.error(error?.response?.data?.detail || 'Failed to save supplier invoice');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditInvoice = (invoice: any) => {
    setEditingInvoice(invoice);
    setShowInvoiceModal(true);
  };

  const handleNewInvoiceFromGRN = async () => {
    try {
      const grnResponse = await listGRNs({ page_size: 1, ordering: '-created_at' });
      const grn = extractList(grnResponse)[0];
      if (!grn?.id) {
        toast.error('No GRNs found');
        return;
      }

      const grnDetails = await getGRN(Number(grn.id));
      setSelectedGRN({
        grnNumber: grnDetails.grn_number || grn.grn_number || '',
        poNumber: grnDetails.po_number || '',
        supplierName: grnDetails.supplier_name || '',
        items: Array.isArray(grnDetails.items)
          ? grnDetails.items.map((item: any) => ({
              productId: String(item.product || ''),
              productName: item.product_name || '',
              acceptedQuantity: toNumber(item.quantity),
              unitPrice: toNumber(item.unit_price),
              taxRate: toNumber(item.tax_rate),
            }))
          : [],
      });
      setEditingInvoice(null);
      setShowInvoiceModal(true);
    } catch (error) {
      console.error('Failed to load GRN details:', error);
      toast.error('Failed to import from GRN');
    }
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
        return <IndianRupee size={16} className="text-success-600" />;
      case 'partially_paid':
        return <IndianRupee size={16} className="text-warning-600" />;
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
      case 'partially_paid':
        return 'bg-warning-100 text-warning-800 dark:bg-warning-900/50 dark:text-warning-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const filteredInvoices = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return supplierInvoices.filter((invoice) => {
      const matchesSearch =
        query.length === 0 ||
        invoice.invoiceNumber?.toLowerCase().includes(query) ||
        invoice.supplierInvoiceNumber?.toLowerCase().includes(query) ||
        invoice.supplierName?.toLowerCase().includes(query) ||
        invoice.poNumber?.toLowerCase().includes(query);
      const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [searchQuery, statusFilter, supplierInvoices]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Supplier Invoices</h1>
          <p className="text-gray-600 dark:text-gray-400">Step 3 of 4: Create and verify supplier invoices</p>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={handleNewInvoiceFromGRN}
            className="flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <Upload size={18} className="mr-2" />
            From Latest GRN
          </button>
          <button
            onClick={() => {
              setEditingInvoice(null);
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

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <option value="partially_paid">Partially Paid</option>
            <option value="paid">Paid</option>
          </select>
        </div>
      </div>

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
              {isLoading ? (
                <tr>
                  <td className="px-6 py-8 text-center text-gray-500 dark:text-gray-400" colSpan={7}>
                    Loading invoices...
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td className="px-6 py-8 text-center text-gray-500 dark:text-gray-400" colSpan={7}>
                    No supplier invoices found.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{invoice.invoiceNumber}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        Supplier: {invoice.supplierInvoiceNumber}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleDateString() : '--'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-gray-100">{invoice.supplierName || '--'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-gray-100">{invoice.poNumber || '--'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(invoice.status)}
                        <span
                          className={`ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(invoice.status)}`}
                        >
                          {invoice.status.replace('_', ' ')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        ₹{invoice.grandTotal.toLocaleString('en-IN')}
                      </div>
                      {invoice.balanceAmount > 0 && (
                        <div className="text-sm text-error-600 dark:text-error-400">
                          Balance: ₹{invoice.balanceAmount.toLocaleString('en-IN')}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div
                        className={`text-sm ${
                          invoice.dueDate && new Date(invoice.dueDate) < new Date() && invoice.status !== 'paid'
                            ? 'text-error-600 dark:text-error-400'
                            : 'text-gray-900 dark:text-gray-100'
                        }`}
                      >
                        {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : '--'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEditInvoice(invoice)}
                        className="text-primary-600 dark:text-primary-400 hover:text-primary-900 dark:hover:text-primary-300"
                      >
                        <Edit size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <SupplierInvoiceModal
        isOpen={showInvoiceModal}
        onClose={() => {
          if (isSaving) return;
          setShowInvoiceModal(false);
          setEditingInvoice(null);
          setSelectedGRN(null);
        }}
        onSave={handleSaveInvoice}
        initialData={editingInvoice}
        poData={null}
        grnData={selectedGRN}
      />
    </div>
  );
};

export default SupplierInvoicesPage;
