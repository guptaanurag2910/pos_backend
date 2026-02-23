import { useEffect, useRef, useState } from 'react';
import {
  listProducts,
  listCategories,
  adjustProductStock,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../service/inventoryService';
import { Product, Category } from '../types';
import ProductTable from '../components/inventory/ProductTable';
// import ProductModal from '../components/inventory/ProductModal';
import AddProductModal from '../components/inventory/AddProductModal';

import { Plus } from 'lucide-react';

const InventoryPage = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const categoryFilterRef = useRef<HTMLSelectElement>(null);

  const fetchData = async () => {
    try {
      const prodResponse = await listProducts({ search: searchQuery, category: categoryFilter });
      const catResponse = await listCategories();
      setProducts(prodResponse.results);
      setCategories(catResponse.results);
    } catch (error) {
      console.error('Error fetching inventory data:', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, [searchQuery, categoryFilter]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const isCtrlOrMeta = event.ctrlKey || event.metaKey;

      if (event.key === 'F2') {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (event.key === 'F3') {
        event.preventDefault();
        categoryFilterRef.current?.focus();
        return;
      }

      if (event.key === 'F4') {
        event.preventDefault();
        setShowModal(true);
        return;
      }

      if (isCtrlOrMeta && key === 'r') {
        event.preventDefault();
        void fetchData();
        return;
      }

      if (event.key === 'Escape' && showModal) {
        event.preventDefault();
        setShowModal(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showModal, searchQuery, categoryFilter]);

  const handleSaveProduct = async (data: Partial<Product>) => {
    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, data);
      } else {
        await createProduct(data);
      }
      setShowModal(false);
      setEditingProduct(null);
      fetchData();
    } catch (error) {
      console.error('Error saving product:', error);
    }
  };

  const handleDeleteProduct = async (id: number) => {
    try {
      await deleteProduct(id);
      fetchData();
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  };

  const handleAdjustStock = async (productId: number, storeId: number, quantity: number) => {
    try {
      await adjustProductStock(productId, { store: storeId, quantity });
      fetchData();
    } catch (error) {
      console.error('Error adjusting stock:', error);
    }
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Inventory</h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded flex items-center shadow"
        >
          <Plus className="mr-2" /> Add Product
        </button>
      </div>

      {/* Modern Search + Filter UI */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="relative flex-1">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search products by name or barcode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          />
          <svg
            className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1116.65 6.65a7.5 7.5 0 010 10.6z" />
          </svg>
        </div>

        <select
          ref={categoryFilterRef}
          value={categoryFilter ?? ''}
          onChange={(e) => setCategoryFilter(e.target.value ? Number(e.target.value) : null)}
          className="border border-gray-300 px-3 py-2 rounded-md text-sm bg-white shadow-sm"
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>

        <button className="flex items-center gap-1 px-4 py-2 border rounded-md bg-white text-sm shadow-sm hover:bg-gray-50">
          <svg
            className="h-5 w-5 text-gray-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707l-5.414 5.414A1 1 0 0115 12.828V19a1 1 0 01-.553.894l-4 2A1 1 0 019 21v-8.172a1 1 0 01-.293-.707L3.293 6.707A1 1 0 013 6V4z" />
          </svg>
          Filters
        </button>
      </div>

      <ProductTable
        products={products}
        onEdit={(product) => {
          setEditingProduct(product);
          setShowModal(true);
        }}
        onDelete={handleDeleteProduct}
        onAdjustStock={handleAdjustStock}
      />

      <button
        onClick={() => setShowModal(true)}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg"
      >
        Add Product
      </button>

      {showModal && (
        <AddProductModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
};

export default InventoryPage;
