import { useState } from 'react';
import AddProductModal from './AddProductModal';

interface Item {
  product_id: number;
  product_name?: string;
  quantity_ordered: number;
  unit_price: number;
  discount_percentage: number;
  tax_rate: number;
  expected_delivery_date?: string;
  total?: number;
  tax_amount?: number;
  discount_amount?: number;
}

interface Props {
  items: Item[];
  onChange: (items: Item[]) => void;
  products: any[];
}

const PurchaseOrderItemsEditor = ({ items, onChange, products }: Props) => {
  const [showNewProductModal, setShowNewProductModal] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);

  const handleRemoveItem = (index: number) => {
    const updatedItems = [...items];
    updatedItems.splice(index, 1);
    onChange(updatedItems);
  };

  const handleSaveProduct = (product: Item) => {
    const base = Number(product.unit_price) * Number(product.quantity_ordered);
    const discount_amount = base * (Number(product.discount_percentage) / 100);
    const after_discount = base - discount_amount;
    const tax_amount = after_discount * (Number(product.tax_rate) / 100);
    const total = after_discount + tax_amount;

    const updatedItem: Item = {
      ...product,
      discount_amount,
      tax_amount,
      total,
    };

    let updatedItems = [...items];
    if (editIndex !== null) {
      updatedItems[editIndex] = updatedItem;
    } else {
      updatedItems = [...items, updatedItem];
    }

    onChange(updatedItems);
    setEditIndex(null);
    setShowNewProductModal(false);
  };

  const handleEdit = (index: number) => {
    setEditIndex(index);
    setShowNewProductModal(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => {
            setEditIndex(null);
            setShowNewProductModal(true);
          }}
          className="bg-primary-600 text-white px-4 py-2 rounded"
        >
          + Add Product
        </button>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="p-2 text-left">Product</th>
            <th className="p-2 text-right">Qty</th>
            <th className="p-2 text-right">Unit Price</th>
            <th className="p-2 text-right">Discount</th>
            <th className="p-2 text-right">Tax</th>
            <th className="p-2 text-right">Total</th>
            <th className="p-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={index} className="border-b">
              <td className="p-2">{item.product_name}</td>
              <td className="p-2 text-right">{Number(item.quantity_ordered)}</td>
              <td className="p-2 text-right">₹{Number(item.unit_price).toFixed(2)}</td>
              <td className="p-2 text-right">{Number(item.discount_percentage).toFixed(2)}%</td>
              <td className="p-2 text-right">{Number(item.tax_rate).toFixed(2)}%</td>
              <td className="p-2 text-right">₹{Number(item.total ?? 0).toFixed(2)}</td>
              <td className="p-2 text-right">
                <button className="text-blue-600 mr-2" onClick={() => handleEdit(index)}>Edit</button>
                <button onClick={() => handleRemoveItem(index)} className="text-red-500">×</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showNewProductModal && (
        <AddProductModal
          onSave={handleSaveProduct}
          onClose={() => {
            setShowNewProductModal(false);
            setEditIndex(null);
          }}
          initialData={editIndex !== null ? items[editIndex] : undefined} // Pass selected item
        />
      )}
    </div>
  );
};

export default PurchaseOrderItemsEditor;
