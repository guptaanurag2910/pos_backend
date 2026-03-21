import { useEffect, useRef, useState } from 'react';
import {
  listProducts,
  listCategories,
  adjustProductStock,
  createProduct,
  getProduct,
  updateProduct,
  deleteProduct,
  downloadInventorySheet,
  uploadInventorySheet,
} from '../service/inventoryService';
import { listStores } from '../service/storeService';
import { Product, Category } from '../types';
import ProductTable from '../components/inventory/ProductTable';
import ProductModal from '../components/inventory/ProductModal';
import DeleteConfirmModal from '../components/common/DeleteConfirmModal';
import { useAuthStore } from '../stores/authStore';
import toast from 'react-hot-toast';

import { Download, Plus, Upload } from 'lucide-react';

const InventoryPage = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<'in_stock' | 'out_of_stock' | 'all'>('in_stock');
  const [showProductModal, setShowProductModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [stores, setStores] = useState<Array<{ id: number; name: string }>>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const categoryFilterRef = useRef<HTMLSelectElement>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const inventoryUploadInputRef = useRef<HTMLInputElement | null>(null);
  const [isInventoryUploading, setIsInventoryUploading] = useState(false);
  const [deleteProductId, setDeleteProductId] = useState<number | null>(null);
  const [isDeletingProduct, setIsDeletingProduct] = useState(false);
  const user = useAuthStore((state) => state.user);
  const storeId = Number(user?.storeId || 0) || undefined;

  const pickLatestStoreStock = (stockRows: Array<Record<string, any>>, targetStoreId?: number) => {
    const rows = Array.isArray(stockRows) ? stockRows : [];
    const scopedRows = targetStoreId
      ? rows.filter((row) => Number(row.store) === Number(targetStoreId))
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

  const fetchData = async (nextPage = 1, append = false) => {
    try {
      if (append) setIsLoadingMore(true);
      else setIsInitialLoading(true);

      const prodResponse = await listProducts({
        search: searchQuery,
        category: categoryFilter || undefined,
        store: storeId,
        page: nextPage,
        page_size: 40,
        stock_status: searchQuery.trim() ? 'all' : statusFilter,
      });
      const catResponse = await listCategories();
      const storeResponse = await listStores();
      const nextProducts = Array.isArray(prodResponse?.results) ? prodResponse.results : [];
      setProducts((prev) => {
        if (!append) return nextProducts;
        const merged = [...prev, ...nextProducts];
        const seen = new Set<number | string>();
        return merged.filter((item: any) => {
          if (seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        });
      });
      setPage(nextPage);
      setHasMore(Boolean(prodResponse?.next));
      setCategories(Array.isArray(catResponse?.results) ? catResponse.results : []);
      const storeList = Array.isArray(storeResponse)
        ? storeResponse
        : Array.isArray((storeResponse as any)?.results)
          ? (storeResponse as any).results
          : [];
      setStores(storeList.map((s: any) => ({ id: Number(s.id), name: s.name })));
    } catch (error) {
      console.error('Error fetching inventory data:', error);
    } finally {
      setIsInitialLoading(false);
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    setProducts([]);
    setPage(1);
    setHasMore(true);
    fetchData(1, false);
  }, [searchQuery, categoryFilter, statusFilter]);

  useEffect(() => {
    if (!hasMore || isInitialLoading || isLoadingMore) return;
    const node = loadMoreRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        fetchData(page + 1, true);
      },
      { threshold: 0.2 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, page, isInitialLoading, isLoadingMore, searchQuery, categoryFilter, statusFilter]);

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
        setSelectedProduct(null);
        setShowProductModal(true);
        return;
      }

      if (isCtrlOrMeta && key === 'r') {
        event.preventDefault();
        void fetchData(1, false);
        return;
      }

      if (event.key === 'Escape' && showProductModal) {
        event.preventDefault();
        setShowProductModal(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showProductModal, searchQuery, categoryFilter, statusFilter]);

  const handleSaveProduct = async (data: any) => {
    try {
      if (selectedProduct) {
        await updateProduct(selectedProduct.id, data);
        toast.success('Product updated');
      } else {
        await createProduct(data);
        toast.success('Product created');
      }
      setShowProductModal(false);
      setSelectedProduct(null);
      await fetchData(1, false);
    } catch (error: any) {
      console.error('Error saving product:', error);
      const detail = error?.response?.data?.detail;
      const fieldErrors = error?.response?.data;
      const fallback =
        typeof detail === 'string'
          ? detail
          : fieldErrors && typeof fieldErrors === 'object'
            ? Object.entries(fieldErrors)
                .filter(([k]) => k !== 'detail')
                .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
                .join(' | ')
            : 'Failed to save product';
      toast.error(fallback || 'Failed to save product');
    }
  };

  const handleDeleteProduct = async (id: number) => {
    setDeleteProductId(id);
  };

  const confirmDeleteProduct = async () => {
    if (deleteProductId === null) return;
    try {
      setIsDeletingProduct(true);
      await deleteProduct(deleteProductId);
      toast.success('Product deleted');
      await fetchData(1, false);
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Failed to delete product');
    } finally {
      setIsDeletingProduct(false);
      setDeleteProductId(null);
    }
  };

  const handleAdjustStock = async (productId: number, storeId: number, quantity: number) => {
    try {
      await adjustProductStock(productId, { store: storeId, quantity });
      fetchData(1, false);
    } catch (error) {
      console.error('Error adjusting stock:', error);
    }
  };

  const handleDownloadInventorySheet = async () => {
    try {
      const response = await downloadInventorySheet(storeId);
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `inventory_template_${timestamp}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Inventory sheet downloaded');
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Failed to download inventory sheet');
    }
  };

  const handleInventoryUploadSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setIsInventoryUploading(true);
    try {
      const result = await uploadInventorySheet(file, storeId, true);
      const processed = Number(result?.processed || 0);
      const errors = Array.isArray(result?.errors) ? result.errors.length : 0;
      if (errors > 0) {
        toast.error(`Imported ${processed} rows with ${errors} errors`);
      } else {
        toast.success(`Inventory updated successfully (${processed} rows)`);
      }
      await fetchData(1, false);
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      const errors = error?.response?.data?.errors;
      const message = detail || (Array.isArray(errors) && errors.length ? errors[0]?.error : null) || 'Failed to upload inventory sheet';
      toast.error(message);
    } finally {
      setIsInventoryUploading(false);
    }
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Inventory</h1>
        <div className="flex items-center gap-2">
          <input
            ref={inventoryUploadInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleInventoryUploadSelect}
          />
          <button
            onClick={handleDownloadInventorySheet}
            className="border border-gray-300 bg-white text-gray-700 px-3 py-2 rounded flex items-center shadow text-sm"
          >
            <Download className="mr-2 h-4 w-4" /> Download Sheet
          </button>
          <button
            onClick={() => inventoryUploadInputRef.current?.click()}
            disabled={isInventoryUploading}
            className="border border-gray-300 bg-white text-gray-700 px-3 py-2 rounded flex items-center shadow text-sm disabled:opacity-60"
            title="Upload sheet and override inventory for this store"
          >
            <Upload className="mr-2 h-4 w-4" /> {isInventoryUploading ? 'Uploading...' : 'Upload & Override'}
          </button>
          <button
            onClick={() => {
              setSelectedProduct(null);
              setShowProductModal(true);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded flex items-center shadow"
          >
            <Plus className="mr-2" /> Add Product
          </button>
        </div>
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
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'in_stock' | 'out_of_stock' | 'all')}
          className="border border-gray-300 px-3 py-2 rounded-md text-sm bg-white shadow-sm"
        >
          <option value="in_stock">In Stock</option>
          <option value="out_of_stock">Out of Stock</option>
          <option value="all">All</option>
        </select>

        <button
          onClick={() => fetchData(1, false)}
          className="flex items-center gap-1 px-4 py-2 border rounded-md bg-white text-sm shadow-sm hover:bg-gray-50"
        >
          <svg
            className="h-5 w-5 text-gray-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707l-5.414 5.414A1 1 0 0115 12.828V19a1 1 0 01-.553.894l-4 2A1 1 0 019 21v-8.172a1 1 0 01-.293-.707L3.293 6.707A1 1 0 013 6V4z" />
          </svg>
          Refresh
        </button>
      </div>
      {searchQuery.trim() ? (
        <div className="mb-4 text-xs text-gray-600">Search includes out-of-stock items so availability is visible.</div>
      ) : null}

      <ProductTable
        products={products}
        onView={async (product) => {
          try {
            const latest = await getProduct(product.id);
            setViewingProduct(latest);
          } catch {
            setViewingProduct(product);
          }
        }}
        onEdit={(product) => {
          setSelectedProduct(product);
          setShowProductModal(true);
        }}
        onDelete={handleDeleteProduct}
        onAdjustStock={handleAdjustStock}
      />
      <div ref={loadMoreRef} className="py-4 text-center text-sm text-gray-500">
        {isInitialLoading ? 'Loading products...' : isLoadingMore ? 'Loading more products...' : hasMore ? 'Scroll to load more' : 'All products loaded'}
      </div>

      {showProductModal && (
        <ProductModal
          product={selectedProduct}
          categories={categories}
          stores={stores}
          onClose={() => {
            setShowProductModal(false);
            setSelectedProduct(null);
          }}
          onSave={handleSaveProduct}
        />
      )}

      {viewingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-3xl rounded-xl bg-white p-6 dark:bg-gray-900 dark:text-gray-200 max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Product Details</h2>
              <button
                onClick={() => setViewingProduct(null)}
                className="rounded bg-gray-200 px-3 py-1 text-sm dark:bg-gray-700"
              >
                Close
              </button>
            </div>
            {(() => {
              const stockRows = (viewingProduct as any).stock_details || [];
              const stock = pickLatestStoreStock(stockRows, storeId) || {};
              return (
                <div className="space-y-4 text-sm">
                  {viewingProduct.image ? (
                    <div>
                      <img
                        src={viewingProduct.image}
                        alt={viewingProduct.name}
                        className="h-32 w-32 rounded border object-cover"
                      />
                    </div>
                  ) : null}
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <p><strong>Name:</strong> {viewingProduct.name || '-'}</p>
                    <p><strong>Barcode:</strong> {viewingProduct.barcode || '-'}</p>
                    <p><strong>Category:</strong> {viewingProduct.category_name || '-'}</p>
                    <p><strong>Selling Price:</strong> ₹{Number(viewingProduct.price || 0).toFixed(2)}</p>
                    <p><strong>Cost Price:</strong> ₹{Number(viewingProduct.cost_price || 0).toFixed(2)}</p>
                    <p><strong>Discount Price:</strong> ₹{Number(viewingProduct.discount_price ?? 0).toFixed(2)}</p>
                    <p><strong>Tax:</strong> {Number(viewingProduct.tax || 0)}%</p>
                    <p><strong>HSN Code:</strong> {(viewingProduct as any).hsn_code || '-'}</p>
                    <p><strong>Unit:</strong> {viewingProduct.unit || '-'}</p>
                    <p><strong>Weight:</strong> {(viewingProduct as any).weight ?? '-'}</p>
                    <p><strong>Current Stock:</strong> {Number(viewingProduct.current_stock || 0)}</p>
                    <p><strong>Stock Quantity:</strong> {stock?.quantity ?? '-'}</p>
                    <p><strong>Min Stock:</strong> {stock?.min_stock ?? '-'}</p>
                    <p><strong>Max Stock:</strong> {stock?.max_stock ?? '-'}</p>
                    <p><strong>Batch Number:</strong> {stock?.batch_number || '-'}</p>
                    <p><strong>Expiry Date:</strong> {stock?.expiry_date || '-'}</p>
                    <p><strong>Active:</strong> {(viewingProduct as any).is_active ? 'Yes' : 'No'}</p>
                    <p><strong>Featured:</strong> {(viewingProduct as any).is_featured ? 'Yes' : 'No'}</p>
                    <p><strong>Service:</strong> {(viewingProduct as any).is_service ? 'Yes' : 'No'}</p>
                  </div>
                  <p><strong>Description:</strong> {viewingProduct.description || '-'}</p>
                </div>
              );
            })()}
            </div>
          </div>
      )}

      <DeleteConfirmModal
        isOpen={deleteProductId !== null}
        title="Delete Product"
        message="This will hide the product from active inventory. Are you sure?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isLoading={isDeletingProduct}
        onCancel={() => setDeleteProductId(null)}
        onConfirm={confirmDeleteProduct}
      />
    </div>
  );
};

export default InventoryPage;
