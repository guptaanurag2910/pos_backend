import { useState, useEffect } from 'react';
import { createProduct, listCategories, listProducts } from '../../service/inventoryService';
import { listStores } from '../../service/storeService';
import ProductModal from './../inventory/ProductModal';
import { Product } from '../types';

interface Item {
  product_id: number;
  product_name?: string;
  quantity_ordered: number;
  unit_price: number;
  discount_percentage: number;
  tax_rate: number;
  expected_delivery_date?: string;
  discount_amount?: number;
  tax_amount?: number;
  total?: number;
}

interface AddProductModalProps {
  onSave: (item: Item) => void;
  onClose: () => void;
  initialData?: Item;
}

const AddProductModal = ({ onSave, onClose, initialData }: AddProductModalProps) => {
  const [formData, setFormData] = useState<Item>({
    product_id: 0,
    product_name: '',
    quantity_ordered: 1,
    unit_price: 0,
    discount_percentage: 0,
    tax_rate: 0,
    expected_delivery_date: '',
  });

  const [products, setProducts] = useState<Product[]>([]);
  const [showProductModal, setShowProductModal] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [stores, setStores] = useState<Array<{ id: number; name: string }>>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [taxAmount, setTaxAmount] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([listProducts(), listCategories(), listStores()])
      .then(([productsRes, categoriesRes, storesRes]) => {
        setProducts(productsRes.results || []);
        setCategories(categoriesRes.results || []);
        const storeList = Array.isArray(storesRes)
          ? storesRes
          : Array.isArray((storesRes as any)?.results)
            ? (storesRes as any).results
            : [];
        setStores(storeList.map((s: any) => ({ id: Number(s.id), name: s.name })));
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    const base = formData.unit_price * formData.quantity_ordered;
    const discount = base * (formData.discount_percentage / 100);
    const afterDiscount = base - discount;
    const tax = afterDiscount * (formData.tax_rate / 100);
    const totalCalc = afterDiscount + tax;

    setDiscountAmount(discount);
    setTaxAmount(tax);
    setTotal(totalCalc);
  }, [formData]);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
      setSearchQuery(initialData.product_name || '');
      setShowSuggestions(false);
    }
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: ['quantity_ordered', 'unit_price', 'discount_percentage', 'tax_rate'].includes(name)
        ? parseFloat(value)
        : value,
    }));
    setShowSuggestions(true);
  };

  const handleSelectProduct = (product: Product) => {
    const resolvedCost = Number((product as any).cost_price ?? product.price ?? 0);
    const resolvedTax = Number((product as any).tax ?? 0);
    setFormData((prev) => ({
      ...prev,
      product_id: product.id,
      product_name: product.name,
      unit_price: resolvedCost,
      tax_rate: resolvedTax,
    }));
    setSearchQuery(product.name);
    setShowSuggestions(false);
    setError('');
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setShowSuggestions(true);
    setFormData((prev) => ({
      ...prev,
      product_id: 0,
      product_name: '',
      unit_price: 0,
    }));
    setError('');
  };

  const handleSubmit = () => {
    const selectedProduct = products.find((p) => Number(p.id) === Number(formData.product_id));
    if (!selectedProduct) {
      setError('Select an existing product or create a new product first.');
      return;
    }
    if (formData.quantity_ordered <= 0) {
      setError('Quantity should be greater than 0.');
      return;
    }
    if (formData.unit_price < 0) {
      setError('Unit price cannot be negative.');
      return;
    }
    setError('');
    onSave({ ...formData, discount_amount: discountAmount, tax_amount: taxAmount, total });
  };

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.barcode?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 dark:text-gray-200 rounded-xl shadow-2xl p-6 w-full max-w-2xl">
        <h2 className="text-2xl font-bold mb-6">
          {initialData ? 'Edit Product in Order' : 'Add Product to Order'}
        </h2>

        <div className="mb-4">
          <label className="block text-sm mb-1">Search Product</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search by name or barcode"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSuggestions(true);
              }}
              disabled={!!initialData}
              className="border p-2 rounded w-full dark:bg-gray-800 dark:border-gray-700"
            />
            {searchQuery && !initialData && (
              <button onClick={handleClearSearch} className="px-3 py-2 bg-gray-300 text-black rounded">Clear</button>
            )}
          </div>
          {!initialData && searchQuery && showSuggestions && (
            <div className="border mt-2 rounded max-h-40 overflow-y-auto bg-white dark:bg-gray-800">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  onClick={() => handleSelectProduct(product)}
                  className="p-2 cursor-pointer hover:bg-blue-100 dark:hover:bg-gray-700"
                >
                  {product.name} ({product.barcode})
                </div>
              ))}
              {filteredProducts.length === 0 && (
                <div
                  className="p-2 text-sm text-blue-600 cursor-pointer hover:underline"
                  onClick={() => setShowProductModal(true)}
                >
                  + Create new product
                </div>
              )}
            </div>
          )}
          {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1">Quantity</label>
            <input
              name="quantity_ordered"
              type="number"
              value={formData.quantity_ordered}
              onChange={handleChange}
              className="border p-2 rounded w-full dark:bg-gray-800 dark:border-gray-700"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Unit Price</label>
            <input
              name="unit_price"
              type="number"
              value={formData.unit_price}
              onChange={handleChange}
              className="border p-2 rounded w-full dark:bg-gray-800 dark:border-gray-700"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Discount (%)</label>
            <input
              name="discount_percentage"
              type="number"
              value={formData.discount_percentage}
              onChange={handleChange}
              className="border p-2 rounded w-full dark:bg-gray-800 dark:border-gray-700"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Tax (%)</label>
            <select
              name="tax_rate"
              value={formData.tax_rate}
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
            <label className="block text-sm mb-1">Expected Delivery Date</label>
            <input
              name="expected_delivery_date"
              type="date"
              value={formData.expected_delivery_date}
              onChange={handleChange}
              className="border p-2 rounded w-full dark:bg-gray-800 dark:border-gray-700"
            />
          </div>
        </div>

        <div className="mt-6 bg-gray-50 dark:bg-gray-800 p-4 rounded text-sm space-y-2">
          <div><strong>Discount Amount:</strong> ₹{discountAmount.toFixed(2)}</div>
          <div><strong>Tax Amount:</strong> ₹{taxAmount.toFixed(2)}</div>
          <div><strong>Total:</strong> ₹{total.toFixed(2)}</div>
        </div>

        <div className="flex justify-end mt-6 space-x-3">
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
            {initialData ? 'Update Product' : 'Add Product'}
          </button>
        </div>

        {showProductModal && (
          <ProductModal
            product={null}
            categories={categories}
            stores={stores}
            onClose={() => setShowProductModal(false)}
            onSave={async (data) => {
              const created = await createProduct(data);
              setShowProductModal(false);
              const refreshed = await listProducts();
              setProducts(refreshed.results || []);
              if (created?.id) {
                handleSelectProduct(created as any);
              }
            }}
          />
        )}
      </div>
    </div>
  );
};

export default AddProductModal;
