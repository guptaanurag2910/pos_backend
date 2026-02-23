import { useState } from 'react';
import AddGRNItemModal from './AddGRNItemModal';

interface Item {
  id?: number;
  product: number;
  product_name?: string;
  quantity_ordered: number;
  received_quantity: number;
  unit_price: number;
  batch_no?: string;
  expiry_date?: string;
  tax_rate?: number;
  discount_percentage?: number;
  discount_amount?: number;
  tax_amount?: number;
  total?: number;
}

interface Props {
  items: Item[];
  onChange: (items: Item[]) => void;
  poItems?: Item[];
}

const GRNItemsEditor = ({ items, onChange, poItems = [] }: Props) => {
  const [showItemModal, setShowItemModal] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);

  const handleRemoveItem = (index: number) => {
    const updatedItems = [...items];
    updatedItems.splice(index, 1);
    onChange([...updatedItems]); // force re-render
  };

  const handleSaveItem = (item: Item) => {
    const poMatch = poItems.find((poItem) => poItem.product === item.product);
    const quantity = item.received_quantity || 0;
    const price = item.unit_price || 0;
    const discount = item.discount_percentage || 0;
    const tax = item.tax_rate || 0;

    const base = quantity * price;
    const discountAmt = (discount / 100) * base;
    const taxable = base - discountAmt;
    const taxAmt = (tax / 100) * taxable;
    const total = taxable + taxAmt;

    const itemWithPO: Item = poMatch
      ? {
          ...item,
          quantity_ordered: poMatch.quantity_ordered,
          unit_price: item.unit_price ?? poMatch.unit_price,
          tax_rate: item.tax_rate ?? poMatch.tax_rate,
          discount_percentage: item.discount_percentage ?? poMatch.discount_percentage,
          total: total,
        }
      : {
          ...item,
          quantity_ordered: item.quantity_ordered ?? 0,
          total: total,
        };

    const updatedItems = [...items];
    if (editIndex !== null) {
      updatedItems[editIndex] = itemWithPO;
    } else {
      updatedItems.push(itemWithPO);
    }

    onChange([...updatedItems]); // force reactivity
    setEditIndex(null);
    setShowItemModal(false);
  };

  const handleEdit = (index: number) => {
    setEditIndex(index);
    setShowItemModal(true);
  };

  const formatCurrency = (value: any) => `₹${Number(value || 0).toFixed(2)}`;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => {
            setEditIndex(null);
            setShowItemModal(true);
          }}
          className="bg-primary-600 text-white px-4 py-2 rounded"
        >
          + Add Received Item
        </button>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="p-2 text-left">Product</th>
            <th className="p-2 text-right">Qty Ordered</th>
            <th className="p-2 text-right">Qty Received</th>
            <th className="p-2 text-right">Unit Price</th>
            <th className="p-2 text-right">Tax %</th>
            <th className="p-2 text-right">Discount %</th>
            <th className="p-2 text-right">Total</th>
            <th className="p-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={8} className="text-center py-4 text-gray-500">
                No items added yet.
              </td>
            </tr>
          ) : (
            items.map((item, index) => (
              <tr key={index} className="border-b">
                <td className="p-2">{item.product_name}</td>
                <td className="p-2 text-right">{item.quantity_ordered}</td>
                <td className="p-2 text-right">{item.received_quantity}</td>
                <td className="p-2 text-right">{formatCurrency(item.unit_price)}</td>
                <td className="p-2 text-right">{item.tax_rate ?? '-'}</td>
                <td className="p-2 text-right">{item.discount_percentage ?? '-'}</td>
                <td className="p-2 text-right">{formatCurrency(item.total)}</td>
                <td className="p-2 text-right">
                  <button
                    className="text-blue-600 mr-2"
                    onClick={() => handleEdit(index)}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleRemoveItem(index)}
                    className="text-red-500"
                  >
                    &times;
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {showItemModal && (
        <AddGRNItemModal
          onSave={handleSaveItem}
          onClose={() => {
            setShowItemModal(false);
            setEditIndex(null);
          }}
          initialData={editIndex !== null ? items[editIndex] : undefined}
          poItems={poItems}
        />
      )}
    </div>
  );
};

export default GRNItemsEditor;
