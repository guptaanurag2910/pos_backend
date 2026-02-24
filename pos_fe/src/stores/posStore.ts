import { create } from 'zustand';
import { format } from 'date-fns';
import { Bill, BillItem, Customer, Product } from '../types';
import { listProducts } from '../service/inventoryService';
import { customerService } from '../service/customerService';
import { listBills } from '../service/salesService';

interface POSState {
  products: Product[];
  customers: Customer[];
  currentBill: {
    items: BillItem[];
    customerId?: number | null;
    customerName?: string;
    notes?: string;
    subtotal: number;
    taxTotal: number;
    discount: number;
    total: number;
    pointsToRedeem?: number;
  };
  heldBills: Bill[];
  completedBills: Bill[];
  isLoading: boolean;
}

interface POSStore extends POSState {
  loadProducts: () => Promise<void>;
  searchProducts: (query: string) => Product[];
  addProductToBill: (product: Product, quantity: number) => { ok: boolean; message?: string };
  removeItemFromBill: (itemId: string) => void;
  updateItemQuantity: (itemId: string, quantity: number) => void;
  updateItemDiscount: (itemId: string, discountRate: number) => void;
  applyDiscount: (amount: number, isPercentage: boolean) => void;
  setCustomer: (customer: Customer | null) => void;
  searchCustomers: (query: string) => Customer[];
  holdBill: (cashierId: string, cashierName: string, storeId: string, storeName: string) => void;
  clearBill: () => void;
  getBill: (id: string) => Bill | undefined;
  resumeHeldBill: (billOrId: any) => void;
}

const toNumber = (value: any, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const round2 = (value: number) => parseFloat(value.toFixed(2));

const computeItemTotals = (item: any) => {
  const quantity = toNumber(item?.quantity, 0);
  const price = toNumber(item?.price, 0);
  const taxRate = toNumber(item?.tax, 0);
  const discountRate = Math.max(0, Math.min(100, toNumber(item?.discountRate, 0)));

  const gross = price * quantity;
  const discountAmount = gross * (discountRate / 100);
  const taxable = gross - discountAmount;
  const taxAmount = taxable * (taxRate / 100);
  const total = taxable + taxAmount;

  return {
    discountRate,
    discountAmount: round2(discountAmount),
    taxAmount: round2(taxAmount),
    total: round2(total),
    subtotalExTax: round2(taxable),
  };
};

const computeBillTotals = (items: any[], billDiscount: number) => {
  const subtotal = round2(
    items.reduce((sum, item) => sum + computeItemTotals(item).subtotalExTax, 0)
  );
  const taxTotal = round2(
    items.reduce((sum, item) => sum + computeItemTotals(item).taxAmount, 0)
  );
  const total = round2(subtotal + taxTotal - toNumber(billDiscount, 0));
  return { subtotal, taxTotal, total };
};

const normalizeProduct = (product: any): Product => {
  const stockDetails = Array.isArray(product?.stock_details) ? product.stock_details : [];
  const totalStock = stockDetails.length
    ? stockDetails.reduce((sum: number, level: any) => sum + toNumber(level?.quantity, 0), 0)
    : toNumber(product?.current_stock, 0);
  const minStock = stockDetails.length
    ? Math.min(...stockDetails.map((level: any) => toNumber(level?.min_stock, 0)))
    : 0;

  return {
    id: product.id,
    name: product.name,
    barcode: product.barcode,
    category: product.category_name || product.category || 'Uncategorized',
    price: toNumber(product.price),
    costPrice: toNumber(product.cost_price),
    tax: toNumber(product.tax),
    stock: totalStock,
    minStock,
    unit: product.unit || 'piece',
    image: product.image || undefined,
  } as Product;
};

const normalizeCustomer = (customer: any): Customer => ({
  id: customer.id,
  name: customer.name,
  phone: customer.phone,
  email: customer.email || undefined,
  loyaltyPoints: toNumber(customer.loyalty_points, 0),
  totalPurchases: toNumber(customer.total_purchases, 0),
  lastPurchase: customer.last_purchase || '',
} as Customer);

const normalizeApiBill = (bill: any): Bill => {
  const items = Array.isArray(bill?.items)
    ? bill.items.map((item: any) => ({
        id: String(item.id),
        productId: item.product,
        productName: item.product_name || item.productName || '',
        quantity: toNumber(item.quantity),
        price: toNumber(item.price),
        tax: toNumber(item.tax_rate ?? item.tax),
        discount: toNumber(item.discount_amount ?? 0),
        discountRate: toNumber(item.discount_rate ?? 0),
        total: toNumber(item.total),
      }))
    : [];

  return {
    id: String(bill.id),
    billNumber: bill.bill_number || bill.billNumber,
    items,
    subtotal: toNumber(bill.subtotal),
    taxTotal: toNumber(bill.tax_total),
    discount: toNumber(bill.discount),
    total: toNumber(bill.total),
    paymentMethod: bill.payment_method || bill.paymentMethod || '',
    paymentStatus: bill.payment_status || bill.paymentStatus || 'pending',
    customerId: bill.customer || bill.customerId || null,
    customerName: bill.customer_name || bill.customerName || '',
    cashierId: String(bill.cashier || ''),
    cashierName: bill.cashier_name || bill.cashierName || '',
    storeId: String(bill.store || ''),
    storeName: bill.store_name || bill.storeName || '',
    createdAt: bill.created_at || bill.createdAt || format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
    status: bill.status || 'draft',
    pointsRedeemed: toNumber(bill.points_redeemed ?? bill.pointsRedeemed, 0),
  } as Bill;
};

export const usePOSStore = create<POSStore>((set, get) => ({
  products: [],
  customers: [],
  currentBill: {
    items: [],
    subtotal: 0,
    taxTotal: 0,
    discount: 0,
    total: 0,
    pointsToRedeem: 0,
    customerId: null,
  },
  heldBills: [],
  completedBills: [],
  isLoading: false,

  loadProducts: async () => {
    set({ isLoading: true });
    try {
      const [productsRes, customersRes, completedBillsRes] = await Promise.all([
        listProducts({ page_size: 500 }),
        customerService.list({ page_size: 500 }),
        listBills({ status: 'completed', page_size: 200 }),
      ]);

      const rawProducts = Array.isArray(productsRes?.results) ? productsRes.results : productsRes || [];
      const rawCustomers = Array.isArray(customersRes?.results) ? customersRes.results : customersRes || [];
      const rawCompletedBills = Array.isArray(completedBillsRes?.results)
        ? completedBillsRes.results
        : completedBillsRes || [];

      set({
        products: rawProducts.map(normalizeProduct),
        customers: rawCustomers.map(normalizeCustomer),
        completedBills: rawCompletedBills.map(normalizeApiBill),
        isLoading: false,
      });
    } catch (error) {
      console.error('Error loading products/customers:', error);
      set({ isLoading: false });
    }
  },

  searchProducts: (query: string) => {
    const { products } = get();
    if (!query.trim()) return [];
    const lowerQuery = query.toLowerCase();
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(lowerQuery) ||
        product.barcode.includes(lowerQuery) ||
        String(product.category || '').toLowerCase().includes(lowerQuery)
    );
  },

  addProductToBill: (product: Product, quantity: number) => {
    let result: { ok: boolean; message?: string } = { ok: true };
    set((state) => {
      const availableStock = toNumber(product.stock, 0);
      if (availableStock <= 0) {
        result = { ok: false, message: `${product.name} is out of stock.` };
        return state;
      }

      const existingItemIndex = state.currentBill.items.findIndex((item) => item.productId === product.id);
      let newItems;

      if (existingItemIndex !== -1) {
        newItems = [...state.currentBill.items];
        const existingItem = newItems[existingItemIndex];
        const requestedQuantity = existingItem.quantity + quantity;
        const newQuantity = Math.min(requestedQuantity, availableStock);
        if (newQuantity <= existingItem.quantity) {
          result = {
            ok: false,
            message: `Cannot add more ${product.name}. Available stock: ${availableStock}.`,
          };
          return state;
        }
        const computed = computeItemTotals({
          ...existingItem,
          quantity: newQuantity,
        });
        newItems[existingItemIndex] = {
          ...existingItem,
          quantity: newQuantity,
          discountRate: computed.discountRate,
          discount: computed.discountAmount,
          total: computed.total,
        };
      } else {
        const safeQuantity = Math.min(quantity, availableStock);
        if (safeQuantity <= 0) {
          result = { ok: false, message: `${product.name} is out of stock.` };
          return state;
        }
        const computed = computeItemTotals({
          quantity: safeQuantity,
          price: product.price,
          tax: product.tax,
          discountRate: 0,
        });
        const newItem: BillItem = {
          id: `item_${Date.now()}`,
          productId: product.id,
          productName: product.name,
          quantity: safeQuantity,
          price: product.price,
          tax: product.tax,
          discount: computed.discountAmount,
          discountRate: computed.discountRate,
          total: computed.total,
        } as BillItem;
        newItems = [...state.currentBill.items, newItem];
      }

      const { subtotal, taxTotal, total } = computeBillTotals(
        newItems,
        state.currentBill.discount
      );

      return {
        ...state,
        currentBill: {
          ...state.currentBill,
          items: newItems,
          subtotal,
          taxTotal,
          total,
        },
      };
    });
    return result;
  },

  removeItemFromBill: (itemId: string) => {
    set((state) => {
      const newItems = state.currentBill.items.filter((item) => item.id !== itemId);
      const { subtotal, taxTotal, total } = computeBillTotals(
        newItems,
        state.currentBill.discount
      );

      return {
        ...state,
        currentBill: {
          ...state.currentBill,
          items: newItems,
          subtotal,
          taxTotal,
          total,
        },
      };
    });
  },

  updateItemQuantity: (itemId: string, quantity: number) => {
    set((state) => {
      const newItems = [...state.currentBill.items];
      const itemIndex = newItems.findIndex((item) => item.id === itemId);
      if (itemIndex === -1) return state;

      const item = newItems[itemIndex];
      const product = state.products.find((p) => p.id === item.productId);
      const availableStock = toNumber(product?.stock, item.quantity);
      const safeQuantity = Math.max(1, Math.min(quantity, availableStock));
      const computed = computeItemTotals({
        ...item,
        quantity: safeQuantity,
      });
      newItems[itemIndex] = {
        ...item,
        quantity: safeQuantity,
        discountRate: computed.discountRate,
        discount: computed.discountAmount,
        total: computed.total,
      };

      const { subtotal, taxTotal, total } = computeBillTotals(
        newItems,
        state.currentBill.discount
      );

      return {
        ...state,
        currentBill: {
          ...state.currentBill,
          items: newItems,
          subtotal,
          taxTotal,
          total,
        },
      };
    });
  },

  updateItemDiscount: (itemId: string, discountRate: number) => {
    set((state) => {
      const newItems = [...state.currentBill.items];
      const itemIndex = newItems.findIndex((item) => item.id === itemId);
      if (itemIndex === -1) return state;

      const item = newItems[itemIndex];
      const safeDiscount = Math.max(0, Math.min(100, toNumber(discountRate, 0)));
      const computed = computeItemTotals({
        ...item,
        discountRate: safeDiscount,
      });

      newItems[itemIndex] = {
        ...item,
        discountRate: safeDiscount,
        discount: computed.discountAmount,
        total: computed.total,
      };

      const { subtotal, taxTotal, total } = computeBillTotals(
        newItems,
        state.currentBill.discount
      );

      return {
        ...state,
        currentBill: {
          ...state.currentBill,
          items: newItems,
          subtotal,
          taxTotal,
          total,
        },
      };
    });
  },

  applyDiscount: (amount: number, isPercentage: boolean) => {
    set((state) => {
      let discountAmount = amount;
      if (isPercentage) {
        discountAmount = (state.currentBill.subtotal * amount) / 100;
      }
      const total = parseFloat((state.currentBill.subtotal + state.currentBill.taxTotal - discountAmount).toFixed(2));
      return {
        ...state,
        currentBill: {
          ...state.currentBill,
          discount: parseFloat(discountAmount.toFixed(2)),
          total,
        },
      };
    });
  },

  setCustomer: (customer: Customer | null) => {
    set((state) => ({
      ...state,
      currentBill: {
        ...state.currentBill,
        customerId: customer ? Number(customer.id) : null,
        customerName: customer?.name || '',
      },
    }));
  },

  searchCustomers: (query: string) => {
    const { customers } = get();
    if (!query.trim()) return [];
    const lowerQuery = query.toLowerCase();
    return customers.filter(
      (customer) =>
        customer.name.toLowerCase().includes(lowerQuery) ||
        customer.phone.includes(query) ||
        (customer.email && customer.email.toLowerCase().includes(lowerQuery))
    );
  },

  holdBill: (cashierId: string, cashierName: string, storeId: string, storeName: string) => {
    set((state) => {
      if (state.currentBill.items.length === 0) return state;

      const heldBill: Bill = {
        id: `bill_${Date.now()}`,
        billNumber: `H${Date.now().toString().slice(-6)}`,
        items: [...state.currentBill.items],
        subtotal: state.currentBill.subtotal,
        taxTotal: state.currentBill.taxTotal,
        discount: state.currentBill.discount,
        total: state.currentBill.total,
        paymentMethod: '',
        paymentStatus: 'unpaid',
        customerId: state.currentBill.customerId,
        customerName: state.currentBill.customerName,
        cashierId,
        cashierName,
        storeId,
        storeName,
        createdAt: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
        status: 'held',
      } as Bill;

      return {
        ...state,
        heldBills: [...state.heldBills, heldBill],
        currentBill: {
          items: [],
          subtotal: 0,
          taxTotal: 0,
          discount: 0,
          total: 0,
          pointsToRedeem: 0,
          customerId: null,
          customerName: '',
        },
      };
    });
  },

  clearBill: () => {
    set((state) => ({
      ...state,
      currentBill: {
        items: [],
        subtotal: 0,
        taxTotal: 0,
        discount: 0,
        total: 0,
        pointsToRedeem: 0,
        customerId: null,
        customerName: '',
      },
    }));
  },

  getBill: (id: string) => {
    const { heldBills, completedBills } = get();
    return [...heldBills, ...completedBills].find((bill) => String(bill.id) === String(id));
  },

  resumeHeldBill: (billOrId: any) => {
    set((state) => {
      const heldBill =
        typeof billOrId === 'object' && billOrId !== null
          ? normalizeApiBill(billOrId)
          : state.heldBills.find((bill) => String(bill.id) === String(billOrId));

      if (!heldBill) return state;

      const updatedHeldBills = state.heldBills.filter((bill) => String(bill.id) !== String(heldBill.id));
      return {
        ...state,
        heldBills: updatedHeldBills,
        currentBill: {
          items: [...heldBill.items],
          customerId: (heldBill.customerId as any) || null,
          customerName: heldBill.customerName || '',
          subtotal: toNumber(heldBill.subtotal),
          taxTotal: toNumber(heldBill.taxTotal),
          discount: toNumber(heldBill.discount),
          total: toNumber(heldBill.total),
          pointsToRedeem: 0,
        },
      };
    });
  },
}));
