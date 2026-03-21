import React, { useState, useEffect } from 'react';
import { Product, Category } from '../../types';
import { useAuthStore } from '../../stores/authStore';
import toast from 'react-hot-toast';

interface StoreOption {
  id: number;
  name: string;
}

type ProductFormData = Partial<Product> & {
  store?: number | string;
  quantity?: number | string;
  min_stock?: number | string;
  max_stock?: number | string;
  batch_number?: string;
  expiry_date?: string;
  hsn_code?: string;
  unit?: string;
  weight?: number | string;
  discount_price?: number | string;
  is_active?: boolean;
  is_featured?: boolean;
  is_service?: boolean;
  tax?: number | string;
  category?: number | string;
  price?: number | string;
  cost_price?: number | string;
};

interface Props {
  product: Product | null;
  categories?: Category[];
  stores?: StoreOption[];
  onClose: () => void;
  onSave: (data: ProductFormData) => void;
}

const ProductModal: React.FC<Props> = ({ product, categories = [], stores = [], onClose, onSave }) => {
  const user = useAuthStore((state) => state.user);
  const currentStoreId = Number(user?.storeId || 0) || undefined;
  const resolvedStoreId = currentStoreId || stores[0]?.id;
  const resolvedStoreName = stores.find((s) => Number(s.id) === Number(resolvedStoreId))?.name || 'Current Store';

  const pickLatestStoreStock = (stockRows: Array<Record<string, any>>, storeId?: number) => {
    const rows = Array.isArray(stockRows) ? stockRows : [];
    const scopedRows = storeId
      ? rows.filter((row) => Number(row.store) === Number(storeId))
      : rows;
    if (!scopedRows.length) return rows[0];
    const nonBatchRow = scopedRows.find((row) => !String(row.batch_number ?? '').trim());
    if (nonBatchRow) return nonBatchRow;
    return [...scopedRows].sort((a, b) => {
      const aTime = new Date(a.updated_at || 0).getTime();
      const bTime = new Date(b.updated_at || 0).getTime();
      return bTime - aTime;
    })[0];
  };

  const getInitialFormData = (): ProductFormData => ({
    name: '',
    barcode: '',
    price: 0,
    cost_price: 0,
    tax: 0,
    category: undefined,
    description: '',
    discount_price: 0,
    hsn_code: '',
    unit: 'piece',
    weight: 0,
    is_active: true,
    is_featured: false,
    is_service: false,
    store: resolvedStoreId,
    quantity: 0,
    min_stock: 0,
    max_stock: undefined,
    batch_number: '',
    expiry_date: '',
  });
  const [formData, setFormData] = useState<ProductFormData>(getInitialFormData);

  useEffect(() => {
    if (product) {
      const stockRows = (product as any).stock_details || [];
      const stock = pickLatestStoreStock(stockRows, resolvedStoreId);
      setFormData({
        ...product,
        store: resolvedStoreId,
        quantity: stock?.quantity ?? '',
        min_stock: stock?.min_stock ?? '',
        max_stock: stock?.max_stock ?? '',
        batch_number: stock?.batch_number ?? '',
        expiry_date: stock?.expiry_date ?? '',
      });
      return;
    }
    setFormData(getInitialFormData());
  }, [product, stores, resolvedStoreId]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = () => {
    const toNumberOrUndefined = (value: any) => {
      if (value === '' || value === null || value === undefined) return undefined;
      const n = Number(value);
      return Number.isFinite(n) ? n : undefined;
    };

    const payload: ProductFormData = {
      name: String(formData.name || '').trim(),
      barcode: String(formData.barcode || '').trim(),
      description: String(formData.description || '').trim(),
      hsn_code: String(formData.hsn_code || '').trim(),
      unit: String(formData.unit || 'piece').trim(),
      is_active: Boolean(formData.is_active ?? true),
      is_featured: Boolean(formData.is_featured ?? false),
      is_service: Boolean(formData.is_service ?? false),
      store: resolvedStoreId,
      category: toNumberOrUndefined(formData.category),
      tax: toNumberOrUndefined(formData.tax),
      price: toNumberOrUndefined(formData.price),
      cost_price: toNumberOrUndefined(formData.cost_price),
      discount_price: toNumberOrUndefined(formData.discount_price),
      weight: toNumberOrUndefined(formData.weight),
      quantity: toNumberOrUndefined(formData.quantity),
      min_stock: toNumberOrUndefined(formData.min_stock),
      max_stock: toNumberOrUndefined(formData.max_stock),
      batch_number: String(formData.batch_number || '').trim(),
      expiry_date: String(formData.expiry_date || '').trim() || undefined,
    };

    if (!String(payload.name || '').trim()) {
      toast.error('Product name is required');
      return;
    }
    if (!String(payload.barcode || '').trim()) {
      toast.error('Barcode is required');
      return;
    }
    if (payload.price === undefined || Number(payload.price) < 0) {
      toast.error('Enter a valid selling price');
      return;
    }
    if (payload.cost_price === undefined || Number(payload.cost_price) < 0) {
      toast.error('Enter a valid cost price');
      return;
    }
    if (payload.tax === undefined || Number(payload.tax) < 0) {
      toast.error('Enter a valid tax percentage');
      return;
    }
    if (!String(payload.unit || '').trim()) {
      toast.error('Unit is required');
      return;
    }
    if (!payload.store) {
      toast.error('Current store is not available for this user');
      return;
    }
    if (payload.quantity !== undefined && Number(payload.quantity) < 0) {
      toast.error('Stock quantity cannot be negative');
      return;
    }
    if (payload.min_stock !== undefined && Number(payload.min_stock) < 0) {
      toast.error('Min stock cannot be negative');
      return;
    }
    if (
      payload.max_stock !== undefined &&
      payload.max_stock !== null &&
      payload.max_stock !== '' &&
      Number(payload.max_stock) < Number(payload.min_stock || 0)
    ) {
      toast.error('Max stock should be greater than or equal to min stock');
      return;
    }

    onSave(payload);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 dark:text-gray-200 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b dark:border-gray-700">
          <h2 className="text-2xl font-bold">
            {product ? 'Edit Product' : 'Add New Product'}
          </h2>
        </div>

        <div className="px-6 py-4 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1">Product Name</label>
            <input
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter product name"
              className="border p-2 rounded w-full dark:bg-gray-800 dark:border-gray-700"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Barcode</label>
            <input
              name="barcode"
              value={formData.barcode}
              onChange={handleChange}
              placeholder="Enter barcode"
              className="border p-2 rounded w-full dark:bg-gray-800 dark:border-gray-700"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Selling Price</label>
            <input
              name="price"
              value={formData.price}
              onChange={handleChange}
              type="number"
              step="0.01"
              className="border p-2 rounded w-full dark:bg-gray-800 dark:border-gray-700"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Cost Price</label>
            <input
              name="cost_price"
              value={formData.cost_price}
              onChange={handleChange}
              type="number"
              step="0.01"
              className="border p-2 rounded w-full dark:bg-gray-800 dark:border-gray-700"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Discount Price</label>
            <input
              name="discount_price"
              value={formData.discount_price ?? ''}
              onChange={handleChange}
              type="number"
              step="0.01"
              className="border p-2 rounded w-full dark:bg-gray-800 dark:border-gray-700"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Category</label>
            <select
              name="category"
              value={formData.category ?? ''}
              onChange={handleChange}
              className="border p-2 rounded w-full dark:bg-gray-800 dark:border-gray-700"
            >
              <option value="">Select Category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1">Tax (%)</label>
            <select
              name="tax"
              value={formData.tax}
              onChange={handleChange}
              className="border p-2 rounded w-full dark:bg-gray-800 dark:border-gray-700"
            >
              <option value={0}>0%</option>
              <option value={5}>5%</option>
              <option value={12}>12%</option>
              <option value={18}>18%</option>
              <option value={28}>28%</option>
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1">HSN Code</label>
            <input
              name="hsn_code"
              value={formData.hsn_code ?? ''}
              onChange={handleChange}
              placeholder="Enter HSN code"
              className="border p-2 rounded w-full dark:bg-gray-800 dark:border-gray-700"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Unit</label>
            <input
              name="unit"
              value={formData.unit ?? 'piece'}
              onChange={handleChange}
              placeholder="piece/kg/ltr"
              className="border p-2 rounded w-full dark:bg-gray-800 dark:border-gray-700"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Weight</label>
            <input
              name="weight"
              value={formData.weight ?? ''}
              onChange={handleChange}
              type="number"
              step="0.01"
              className="border p-2 rounded w-full dark:bg-gray-800 dark:border-gray-700"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Store</label>
            <input
              value={resolvedStoreName}
              disabled
              className="border p-2 rounded w-full bg-gray-100 dark:bg-gray-800 dark:border-gray-700"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Stock Quantity</label>
            <input
              name="quantity"
              value={formData.quantity ?? ''}
              onChange={handleChange}
              type="number"
              step="0.01"
              className="border p-2 rounded w-full dark:bg-gray-800 dark:border-gray-700"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Min Stock</label>
            <input
              name="min_stock"
              value={formData.min_stock ?? ''}
              onChange={handleChange}
              type="number"
              step="0.01"
              className="border p-2 rounded w-full dark:bg-gray-800 dark:border-gray-700"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Max Stock</label>
            <input
              name="max_stock"
              value={formData.max_stock ?? ''}
              onChange={handleChange}
              type="number"
              className="border p-2 rounded w-full dark:bg-gray-800 dark:border-gray-700"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Batch Number</label>
            <input
              name="batch_number"
              value={formData.batch_number ?? ''}
              onChange={handleChange}
              className="border p-2 rounded w-full dark:bg-gray-800 dark:border-gray-700"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Expiry Date</label>
            <input
              name="expiry_date"
              value={formData.expiry_date ?? ''}
              onChange={handleChange}
              type="date"
              className="border p-2 rounded w-full dark:bg-gray-800 dark:border-gray-700"
            />
          </div>

          <div className="md:col-span-2 flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="is_active"
                checked={Boolean(formData.is_active)}
                onChange={(e) => setFormData((prev) => ({ ...prev, is_active: e.target.checked }))}
              />
              Active
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="is_featured"
                checked={Boolean(formData.is_featured)}
                onChange={(e) => setFormData((prev) => ({ ...prev, is_featured: e.target.checked }))}
              />
              Featured
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="is_service"
                checked={Boolean(formData.is_service)}
                onChange={(e) => setFormData((prev) => ({ ...prev, is_service: e.target.checked }))}
              />
              Service
            </label>
          </div>

            <div className="md:col-span-2">
              <label className="block text-sm mb-1">Description</label>
              <textarea
                name="description"
                value={formData.description ?? ''}
                onChange={handleChange}
                placeholder="Enter product description"
                className="border p-2 rounded w-full min-h-[80px] dark:bg-gray-800 dark:border-gray-700"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductModal;
