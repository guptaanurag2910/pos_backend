import React from 'react';
import { Product } from '../../types';

interface ProductTableProps {
  products: Product[];
  onEdit: (product: Product) => void;
  onDelete: (id: number) => void;
  onAdjustStock: (productId: number, storeId: number, quantity: number) => void;
}

const ProductTable: React.FC<ProductTableProps> = ({ products, onEdit, onDelete }) => {
  return (
    <div className="overflow-x-auto border rounded dark:border-gray-700">
      <table className="min-w-full bg-white dark:bg-gray-900 dark:text-gray-200">
        <thead className="bg-gray-100 dark:bg-gray-800 text-left text-sm font-semibold">
          <tr>
            <th className="px-4 py-2">Product</th>
            <th className="px-4 py-2">Category</th>
            <th className="px-4 py-2 text-right">MRP</th>
            <th className="px-4 py-2 text-right">Rate</th>
            <th className="px-4 py-2 text-right">Unit</th>
            <th className="px-4 py-2 text-right">Stock</th>
            <th className="px-4 py-2 text-center">Status</th>
            <th className="px-4 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => {
            const stockInfo = product.stock_details?.[0];
            const stockQty = Number(product.current_stock ?? 0);
            const minStock = Number(stockInfo?.min_stock ?? 0);
            const statusText = stockQty <= minStock ? 'Low stock' : 'In stock';

            return (
              <tr key={product.id} className="border-b dark:border-gray-700 text-sm">
                <td className="px-4 py-2 flex items-center gap-3">
                  {product.image ? (
                    <img src={product.image} alt={product.name} className="w-12 h-12 object-cover rounded" />
                  ) : (
                    <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs text-gray-500">
                      No image
                    </div>
                  )}
                  <div>
                    <div className="font-medium">{product.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Barcode: {product.barcode || '—'}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2">
                  <span className="inline-block bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-xs text-gray-700 dark:text-gray-200">
                    {product.category_name || '—'}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  ₹{Number(product.price).toFixed(2)}
                </td>
                <td className="px-4 py-2 text-right">
                  ₹{Number(product.discount_price ?? product.price).toFixed(2)}
                  <div className="text-xs text-gray-500 dark:text-gray-400">Tax: {product.tax ?? 0}%</div>
                </td>
                <td className="px-4 py-2 text-right">
                  <span className="inline-block bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-xs text-gray-700 dark:text-gray-200">
                    {product.unit || '—'}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  {stockQty} <br />
                  <span className="text-xs text-gray-500 dark:text-gray-400">Min: {minStock}</span>
                </td>
                <td className="px-4 py-2 text-center">
                  <span
                    className={`text-sm font-medium ${
                      stockQty <= minStock ? 'text-red-600' : 'text-green-600'
                    }`}
                  >
                    {statusText}
                  </span>
                </td>
                <td className="px-4 py-2 text-right space-x-2">
                  <button
                    onClick={() => onEdit(product)}
                    className="bg-yellow-400 text-white px-3 py-1 rounded hover:bg-yellow-500"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDelete(product.id)}
                    className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                  >
                    View
                  </button>
                </td>
              </tr>
            );
          })}
          {products.length === 0 && (
            <tr>
              <td colSpan={8} className="text-center py-4 text-gray-500 dark:text-gray-400">
                No products found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default ProductTable;
