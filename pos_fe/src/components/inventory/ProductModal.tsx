import React, { useState, useEffect } from 'react';
import { Product, Category } from '../../types';

interface Props {
  product: Product | null;
  categories: Category[];
  onClose: () => void;
  onSave: (data: Partial<Product>) => void;
}

const ProductModal: React.FC<Props> = ({ product, categories, onClose, onSave }) => {
  const [formData, setFormData] = useState<Partial<Product>>({
    name: '',
    barcode: '',
    price: 0,
    cost_price: 0,
    tax: 0,
    category: undefined,
    description: '',
  });

  useEffect(() => {
    if (product) setFormData(product);
  }, [product]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: name === 'tax' || name === 'category' ? Number(value) : value }));
  };

  const handleSubmit = () => {
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 dark:text-gray-200 rounded-xl shadow-2xl p-6 w-full max-w-2xl">
        <h2 className="text-2xl font-bold mb-6">
          {product ? 'Edit Product' : 'Add New Product'}
        </h2>

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
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductModal;
