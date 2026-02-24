import { useEffect, useState } from 'react';
import {
  createPurchaseOrder,
  getPurchaseOrder,
  updatePurchaseOrder,
  listSuppliers,
  createSupplier,
  listGRNs,
  listSupplierInvoices,
  listSupplierPayments,
} from '../../service/purchaseService';
import { listProducts } from '../../service/inventoryService';
import { useNavigate } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import PurchaseOrderItemsEditor from './PurchaseOrderItemsEditor';
import ProcurementFlowStepper from '../purchase/ProcurementFlowStepper';

interface Props {
  poId?: number;
}

const PurchaseOrderFormPage = ({ poId }: Props) => {
  const [form, setForm] = useState<any>({
    po_number: '',
    supplier: '',
    order_date: new Date().toISOString().split('T')[0],
    expected_delivery_date: '',
    status: 'draft',
    payment_status: 'pending',
    shipping_charges: 0,
    subtotal: 0,
    discount_total: 0,
    tax_total: 0,
    total: 0,
    notes: '',
    terms: '',
    items: [],
  });

  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [newSupplier, setNewSupplier] = useState({
    name: '',
    phone: '',
    email: '',
    contact_person: '',
    city: '',
    state: '',
  });
  const [workflow, setWorkflow] = useState({
    po: false,
    grn: false,
    invoice: false,
    payment: false,
    grnId: null as number | null,
    invoiceId: null as number | null,
    paymentId: null as number | null,
  });
  const navigate = useNavigate();

  useEffect(() => {
    if (poId) {
      getPurchaseOrder(poId)
        .then((res) => {
          setForm({
            ...res,
            subtotal: Number(res.subtotal || 0),
            tax_total: Number(res.tax_total || 0),
            shipping_charges: Number(res.shipping_charges || 0),
            discount_total: res.items?.reduce((sum: number, item: any) => sum + (parseFloat(item.discount_amount) || 0), 0),
            total: Number(res.total || 0),
            items: res.items || [],
          });
        })
        .catch(console.error);
    }
    listSuppliers().then(setSuppliers).catch(console.error);
    listProducts({}).then((res) => setProducts(res.results)).catch(console.error);
  }, [poId]);

  useEffect(() => {
    if (!poId) {
      setWorkflow({
        po: false,
        grn: false,
        invoice: false,
        payment: false,
        grnId: null,
        invoiceId: null,
        paymentId: null,
      });
      return;
    }

    const loadWorkflow = async () => {
      try {
        const [grnRes, invoiceRes, paymentRes] = await Promise.all([
          listGRNs({ purchase_order: poId, page_size: 200 }),
          listSupplierInvoices({ purchase_order: poId, page_size: 200 }),
          listSupplierPayments({ purchase_order: poId, page_size: 200 }),
        ]);

        const grns = Array.isArray(grnRes?.results) ? grnRes.results : Array.isArray(grnRes) ? grnRes : [];
        const invoices = Array.isArray(invoiceRes?.results)
          ? invoiceRes.results
          : Array.isArray(invoiceRes)
            ? invoiceRes
            : [];
        const payments = Array.isArray(paymentRes?.results)
          ? paymentRes.results
          : Array.isArray(paymentRes)
            ? paymentRes
            : [];

        const latestGRN = grns[0] || null;
        const latestInvoice = invoices[0] || null;
        const completedPayment = payments.find((p: any) => p.status === 'completed');

        setWorkflow({
          po: true,
          grn: !!latestGRN,
          invoice: !!latestInvoice,
          payment: !!completedPayment,
          grnId: latestGRN?.id || null,
          invoiceId: latestInvoice?.id || null,
          paymentId: completedPayment?.id || null,
        });
      } catch (error) {
        console.error('Failed to load purchase workflow state:', error);
      }
    };

    loadWorkflow();
  }, [poId]);

  const handleOpenGRNStep = () => {
    if (!poId) return;
    if (workflow.grnId) {
      navigate(`/grns/${workflow.grnId}?po=${poId}`);
      return;
    }
    navigate(`/grns/new?po=${poId}`);
  };

  const handleOpenInvoiceStep = () => {
    if (!poId) return;
    if (workflow.invoiceId) {
      navigate(`/purchase/invoices?edit=${workflow.invoiceId}&po=${poId}`);
      return;
    }
    if (workflow.grnId) {
      navigate(`/purchase/invoices?grn=${workflow.grnId}&po=${poId}`);
      return;
    }
    navigate(`/purchase/invoices?po=${poId}`);
  };

  const handleOpenPaymentStep = () => {
    if (!poId) return;
    if (workflow.paymentId) {
      navigate(`/purchase/payments?edit=${workflow.paymentId}&po=${poId}`);
      return;
    }
    if (workflow.invoiceId) {
      navigate(`/purchase/payments?invoice=${workflow.invoiceId}&po=${poId}`);
      return;
    }
    navigate(`/purchase/payments?po=${poId}`);
  };

  useEffect(() => {
    const rawSubtotal = form.items.reduce((sum: number, item: any) => {
      const unitPrice = parseFloat(item.unit_price) || 0;
      const quantity = parseFloat(item.quantity_ordered) || 0;
      return sum + unitPrice * quantity;
    }, 0);

    const discount_total = form.items.reduce((sum: number, item: any) => sum + (parseFloat(item.discount_amount) || 0), 0);
    const tax_total = form.items.reduce((sum: number, item: any) => sum + (parseFloat(item.tax_amount) || 0), 0);
    const total = rawSubtotal - discount_total + tax_total + Number(form.shipping_charges || 0);

    setForm((prev: any) => ({
      ...prev,
      subtotal: rawSubtotal,
      discount_total,
      tax_total,
      total,
    }));
  }, [form.items, form.shipping_charges]);

  const handleChange = (field: string, value: any) => {
    setForm((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.supplier) {
      toast.error('Please select a supplier before saving');
      return;
    }

    try {
      const payload = {
        ...form,
        expected_delivery_date: form.expected_delivery_date || null,
        items: form.items.map(({ product_id, product_name, ...item }: any) => ({
          product: product_id,
          ...item,
          unit_price: parseFloat(item.unit_price),
          expected_delivery_date: item.expected_delivery_date || null,
        })),
      };

      if (poId) {
        await updatePurchaseOrder(poId, payload);
        toast.success('Purchase order updated');
        navigate('/purchase/orders');
      } else {
        const created = await createPurchaseOrder(payload);
        toast.success('Purchase order created');
        navigate('/purchase/orders');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error saving purchase order');
    }
  };

  const handleCreateSupplier = async () => {
    if (!newSupplier.name || !newSupplier.phone) {
      toast.error('Supplier name and phone are required');
      return;
    }

    try {
      const created = await createSupplier(newSupplier);
      setSuppliers((prev) => [created, ...prev]);
      handleChange('supplier', created.id);
      setShowNewSupplier(false);
      setNewSupplier({
        name: '',
        phone: '',
        email: '',
        contact_person: '',
        city: '',
        state: '',
      });
      toast.success('Supplier created and selected');
    } catch (error) {
      console.error(error);
      toast.error('Failed to create supplier');
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <Toaster position="top-right" />
      <h1 className="text-3xl font-semibold">{poId ? 'Edit' : 'New'} Purchase Order</h1>

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
        <ProcurementFlowStepper
          currentStep={1}
          steps={{
            po: { done: poId ? workflow.po : false, optional: true },
            grn: { done: workflow.grn, optional: true },
            pi: { done: workflow.invoice },
            payment: { done: workflow.payment },
          }}
          contextIds={{
            poId: poId || null,
            grnId: workflow.grnId,
            invoiceId: workflow.invoiceId,
            paymentId: workflow.paymentId,
          }}
        />

        {poId ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleOpenGRNStep}
              className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              {workflow.grn ? 'Open GRN' : 'Create GRN for this PO'}
            </button>
            <button
              type="button"
              onClick={handleOpenInvoiceStep}
              className="px-3 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600"
            >
              {workflow.invoice ? 'Open Supplier Invoice' : 'Create Supplier Invoice'}
            </button>
            <button
              type="button"
              onClick={handleOpenPaymentStep}
              className="px-3 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600"
            >
              {workflow.payment ? 'Open Payment' : 'Record Payment'}
            </button>
          </div>
        ) : (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Save PO first to continue GRN → Supplier Invoice → Payment flow.
          </p>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 space-y-6">
        <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-100">Order Details</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {poId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">PO Number</label>
              <input type="text" className="input w-full mt-1" value={form.po_number} disabled />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Order Date</label>
            <input
              type="date"
              className="input w-full mt-1"
              value={form.order_date}
              onChange={(e) => handleChange('order_date', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Expected Delivery</label>
            <input
              type="date"
              className="input w-full mt-1"
              value={form.expected_delivery_date || ''}
              onChange={(e) => handleChange('expected_delivery_date', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Supplier</label>
            <select
              className="input w-full mt-1"
              value={form.supplier || ''}
              onChange={(e) => handleChange('supplier', parseInt(e.target.value))}
            >
              <option value="">Select Supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setShowNewSupplier((prev) => !prev)}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                {showNewSupplier ? 'Cancel new supplier' : '+ Create new supplier'}
              </button>
            </div>
          </div>

          {showNewSupplier && (
            <div className="md:col-span-3 border rounded-lg p-3 bg-blue-50 dark:bg-gray-700/40 border-blue-100 dark:border-gray-600">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  className="input w-full"
                  placeholder="Supplier name *"
                  value={newSupplier.name}
                  onChange={(e) => setNewSupplier((prev) => ({ ...prev, name: e.target.value }))}
                />
                <input
                  className="input w-full"
                  placeholder="Phone *"
                  value={newSupplier.phone}
                  onChange={(e) => setNewSupplier((prev) => ({ ...prev, phone: e.target.value }))}
                />
                <input
                  className="input w-full"
                  placeholder="Email"
                  value={newSupplier.email}
                  onChange={(e) => setNewSupplier((prev) => ({ ...prev, email: e.target.value }))}
                />
                <input
                  className="input w-full"
                  placeholder="Contact person"
                  value={newSupplier.contact_person}
                  onChange={(e) => setNewSupplier((prev) => ({ ...prev, contact_person: e.target.value }))}
                />
                <input
                  className="input w-full"
                  placeholder="City"
                  value={newSupplier.city}
                  onChange={(e) => setNewSupplier((prev) => ({ ...prev, city: e.target.value }))}
                />
                <input
                  className="input w-full"
                  placeholder="State"
                  value={newSupplier.state}
                  onChange={(e) => setNewSupplier((prev) => ({ ...prev, state: e.target.value }))}
                />
              </div>
              <div className="mt-3">
                <button
                  type="button"
                  onClick={handleCreateSupplier}
                  className="px-3 py-1.5 text-sm rounded bg-green-600 text-white hover:bg-green-700"
                >
                  Save Supplier
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
            <select
              className="input w-full mt-1"
              value={form.status}
              onChange={(e) => handleChange('status', e.target.value)}
            >
              <option value="draft">Draft</option>
              <option value="sent">Sent to Supplier</option>
              <option value="partially_received">Partially Received</option>
              <option value="received">Fully Received</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Payment Status</label>
            <select
              className="input w-full mt-1"
              value={form.payment_status}
              onChange={(e) => handleChange('payment_status', e.target.value)}
            >
              <option value="pending">Pending</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="paid">Paid</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-100">Line Items</h2>
        <PurchaseOrderItemsEditor
          items={form.items}
          products={products}
          onChange={(updatedItems) => handleChange('items', updatedItems)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h3 className="text-md font-semibold mb-4">Invoice Summary</h3>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-medium">₹{Number(form.subtotal).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Discount:</span>
              <span className="font-medium text-red-500">₹{Number(form.discount_total).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Tax:</span>
              <span className="font-medium">₹{Number(form.tax_total).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Shipping Charges:</span>
              <input
                type="number"
                className="input w-32 text-right px-2 py-1 border dark:bg-gray-700 dark:border-gray-600 rounded"
                value={form.shipping_charges || 0}
                onChange={(e) => handleChange('shipping_charges', parseFloat(e.target.value))}
              />
            </div>
            <div className="flex justify-between pt-2 border-t font-semibold text-base mt-4">
              <span>Total:</span>
              <span>₹{Number(form.total).toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 space-y-2">
          <h3 className="text-md font-semibold">Notes</h3>
          <textarea
            className="input w-full"
            rows={3}
            placeholder="Additional notes or terms..."
            value={form.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
          />

          <h3 className="text-md font-semibold">Terms</h3>
          <textarea
            className="input w-full"
            rows={3}
            placeholder="Terms and conditions..."
            value={form.terms}
            onChange={(e) => handleChange('terms', e.target.value)}
          />
        </div>
      </div>

      <div className="flex justify-end mt-6">
        <button
          onClick={handleSave}
          className="bg-primary-600 hover:bg-primary-700 text-white font-medium px-6 py-3 rounded-lg transition"
        >
          Save Purchase Order
        </button>
      </div>
    </div>
  );
};

export default PurchaseOrderFormPage;
