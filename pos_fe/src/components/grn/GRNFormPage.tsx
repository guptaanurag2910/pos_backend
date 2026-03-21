import { useEffect, useState } from 'react';
import {
  createGRN,
  getGRN,
  updateGRN,
  listSuppliers,
  listPurchaseOrders,
  getPurchaseOrder,
} from '../../service/purchaseService';
import { useNavigate } from 'react-router-dom';
import { useSearchParams } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import GRNItemsEditor from './GRNItemsEditor';
import ProcurementFlowStepper from '../purchase/ProcurementFlowStepper';
import { useAuthStore } from '../../stores/authStore';

interface Props {
  grnId?: number;
}

const GRNFormPage = ({ grnId }: Props) => {
  const [form, setForm] = useState<any>({
    grn_number: '',
    grn_date: new Date().toISOString().split('T')[0],
    supplier: '',
    purchase_order: '',
    status: 'pending',
    items: [],
    po_items: [],
    notes: '',
    terms: '',
    shipping_charges: 0,
  });

  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [searchParams] = useSearchParams();
  const directReceiptMode = String(searchParams.get('mode') || '').toLowerCase() === 'direct_receipt';
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const storeId = Number(user?.storeId || 0) || undefined;

  const [summary, setSummary] = useState({
    subtotal: 0,
    discount_total: 0,
    tax_total: 0,
    total: 0,
  });

  useEffect(() => {
    const init = async () => {
      try {
        const [supplierList, poRes] = await Promise.all([
          listSuppliers(),
          listPurchaseOrders({
            page_size: 500,
            ...(storeId ? { store: storeId } : {}),
          }),
        ]);
        setSuppliers(supplierList);
        const poListRaw = Array.isArray(poRes?.results) ? poRes.results : [];
        const poList = storeId
          ? poListRaw.filter((po: any) => Number(po.store) === storeId)
          : poListRaw;
        setPurchaseOrders(poList);

        if (grnId) {
          const res = await getGRN(grnId);
          let poItems = [];
          if (res.purchase_order) {
            const po = await getPurchaseOrder(res.purchase_order);
            poItems = po.items || [];
            res.terms = po.terms || '';
          }

          const normalizedItems = (res.items || []).map((item: any) => {
            const poMatch = poItems.find((poItem: any) => poItem.product === item.product) || {};
            return {
              ...item,
              quantity_ordered: parseFloat(poMatch.quantity_ordered) || 0,
              received_quantity: parseFloat(item.quantity) || 0,
            };
          });

          setForm({ ...res, po_items: poItems, items: normalizedItems });
          return;
        }

        const poFromQuery = Number(searchParams.get('po'));
        if (Number.isInteger(poFromQuery) && poFromQuery > 0) {
          if (storeId && !poList.some((po: any) => Number(po.id) === poFromQuery)) {
            toast.error('Selected PO is not available for your store');
            return;
          }
          await handlePurchaseOrderSelect(poFromQuery);
        }
      } catch (error) {
        console.error(error);
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grnId, searchParams, storeId]);

  useEffect(() => {
    let subtotal = 0;
    let discount_total = 0;
    let tax_total = 0;

    form.items.forEach((item: any) => {
      const quantity = parseFloat(item.received_quantity) || 0;
      const price = parseFloat(item.unit_price) || 0;
      const discountPercent = parseFloat(item.discount_percentage) || 0;
      const taxRate = parseFloat(item.tax_rate) || 0;

      const baseAmount = quantity * price;
      const discountAmount = (discountPercent / 100) * baseAmount;
      const taxableAmount = baseAmount - discountAmount;
      const taxAmount = (taxRate / 100) * taxableAmount;

      subtotal += baseAmount;
      discount_total += discountAmount;
      tax_total += taxAmount;
    });

    const total = subtotal - discount_total + tax_total + Number(form.shipping_charges || 0);

    setSummary({ subtotal, discount_total, tax_total, total });
  }, [form.items, form.shipping_charges]);

  const handleChange = (field: string, value: any) => {
    setForm((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.supplier) {
      toast.error('Please select supplier');
      return;
    }
    if (!form.purchase_order && !String(form.notes || '').trim()) {
      toast.error('No-PO GRN requires reason in notes');
      return;
    }

    try {
      const payload = {
        ...form,
        purchase_order: form.purchase_order || null,
        items: form.items.map(({ product_name, ...item }: any) => item),
        notes: !form.purchase_order
          ? `${form.notes || ''}\n[Direct Receipt Exception] No PO flow`.trim()
          : form.notes,
      };

      if (grnId) {
        await updateGRN(grnId, payload);
        toast.success('GRN updated');
      } else {
        await createGRN(payload);
        toast.success('GRN created');
      }

      navigate('/purchase/grn');
    } catch (err) {
      console.error(err);
      toast.error('Error saving GRN');
    }
  };

  const handlePurchaseOrderSelect = async (poId: number) => {
    handleChange('purchase_order', poId);

    if (!poId) {
      handleChange('items', []);
      handleChange('po_items', []);
      return;
    }

    try {
      const po = await getPurchaseOrder(poId);
      handleChange('supplier', po.supplier);
      handleChange('po_items', po.items || []);
      handleChange('shipping_charges', po.shipping_charges || 0);

      const poItems = (po.items || []).map((item: any) => {
        const quantity_ordered = parseFloat(item.quantity_ordered) || 0;
        const unit_price = parseFloat(item.unit_price) || 0;
        const discount_percentage = parseFloat(item.discount_percentage) || 0;
        const tax_rate = parseFloat(item.tax_rate) || 0;

        return {
          product: item.product,
          product_name: item.product_name,
          quantity_ordered,
          quantity: 0,
          unit_price,
          discount_percentage,
          tax_rate,
          batch_no: '',
          expiry_date: '',
        };
      });

      handleChange('items', poItems);
    } catch (err) {
      console.error('Failed to load PO details', err);
      toast.error('Failed to fetch PO data');
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <Toaster position="top-right" />
      <ProcurementFlowStepper
        currentStep={2}
        steps={{
          po: { done: !!form.purchase_order, optional: true },
          grn: { done: true, optional: true },
          pi: { done: false },
          payment: { done: false },
        }}
        contextIds={{
          poId: form.purchase_order ? Number(form.purchase_order) : null,
          grnId: grnId || (form.id ? Number(form.id) : null),
        }}
      />
      {directReceiptMode && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
          Direct Receipt flow active: GRN -&gt; PI -&gt; Payment (No PO). Add reason in notes before save.
        </div>
      )}
      <h1 className="text-3xl font-semibold">{grnId ? 'Edit' : 'New'} GRN</h1>

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 space-y-6">
        <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-100">GRN Details</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {grnId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">GRN Number</label>
              <input type="text" className="input w-full mt-1" value={form.grn_number} disabled />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">GRN Date</label>
            <input
              type="date"
              className="input w-full mt-1"
              value={form.grn_date}
              onChange={(e) => handleChange('grn_date', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Supplier</label>
            <select
              className="input w-full mt-1"
              value={form.supplier || ''}
              onChange={(e) => handleChange('supplier', parseInt(e.target.value))}
              disabled={!!form.purchase_order}
            >
              <option value="">Select Supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Purchase Order</label>
            <select
              className="input w-full mt-1"
              value={form.purchase_order || ''}
              onChange={(e) => handlePurchaseOrderSelect(parseInt(e.target.value))}
            >
              <option value="">Select PO</option>
              {purchaseOrders.map((po) => (
                <option key={po.id} value={po.id}>{po.po_number}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
            <select
              className="input w-full mt-1"
              value={form.status}
              onChange={(e) => handleChange('status', e.target.value)}
            >
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-100">Received Items</h2>
        <GRNItemsEditor
          items={form.items}
          poItems={form.po_items || []}
          onChange={(updatedItems) => handleChange('items', updatedItems)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h3 className="text-md font-semibold mb-4">Invoice Summary</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-medium">₹{summary.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Discount Total:</span>
              <span className="font-medium text-red-500">- ₹{summary.discount_total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax Total:</span>
              <span className="font-medium">₹{summary.tax_total.toFixed(2)}</span>
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
              <span>₹{summary.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 space-y-2">
          <h3 className="text-md font-semibold">Notes</h3>
          <textarea
            className="input w-full"
            rows={3}
            placeholder="Additional notes..."
            value={form.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
          />
          <h3 className="text-md font-semibold mt-4">Terms</h3>
          <textarea
            className="input w-full"
            rows={3}
            placeholder="Terms and conditions..."
            value={form.terms || ''}
            onChange={(e) => handleChange('terms', e.target.value)}
          />
        </div>
      </div>

      <div className="flex justify-end mt-6">
        <button
          onClick={handleSave}
          className="bg-primary-600 hover:bg-primary-700 text-white font-medium px-6 py-3 rounded-lg transition"
        >
          Save GRN
        </button>
      </div>

    </div>
  );
};

export default GRNFormPage;
