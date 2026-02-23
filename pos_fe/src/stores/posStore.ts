import { create } from 'zustand';
import { Bill, BillItem, Customer, Product } from '../types';
import { mockProducts, mockCustomers } from '../data/mockData';
import { format } from 'date-fns';

interface POSState {
  products: Product[];
  customers: Customer[];
  currentBill: {
    items: BillItem[];
    customerId?: number | null;
    customerName?: string;
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
  addProductToBill: (product: Product, quantity: number) => void;
  removeItemFromBill: (itemId: string) => void;
  updateItemQuantity: (itemId: string, quantity: number) => void;
  applyDiscount: (amount: number, isPercentage: boolean) => void;
  setCustomer: (customer: Customer | null) => void;
  searchCustomers: (query: string) => Customer[];
  holdBill: (cashierId: string, cashierName: string, storeId: string, storeName: string) => void;
  clearBill: () => void;
  getBill: (id: string) => Bill | undefined;
  resumeHeldBill: (billId: string) => void;
}

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
      await new Promise(resolve => setTimeout(resolve, 500));
      set({ 
        products: mockProducts, 
        customers: mockCustomers,
        isLoading: false 
      });
    } catch (error) {
      console.error('Error loading products:', error);
      set({ isLoading: false });
    }
  },

  searchProducts: (query: string) => {
    const { products } = get();
    if (!query.trim()) return [];
    const lowerQuery = query.toLowerCase();
    return products.filter(
      product => 
        product.name.toLowerCase().includes(lowerQuery) || 
        product.barcode.includes(lowerQuery) ||
        product.category.toLowerCase().includes(lowerQuery)
    );
  },

  addProductToBill: (product: Product, quantity: number) => {
    set(state => {
      const existingItemIndex = state.currentBill.items.findIndex(
        item => item.productId === product.id
      );
      let newItems;
      if (existingItemIndex !== -1) {
        newItems = [...state.currentBill.items];
        const existingItem = newItems[existingItemIndex];
        const newQuantity = existingItem.quantity + quantity;
        newItems[existingItemIndex] = {
          ...existingItem,
          quantity: newQuantity,
          total: parseFloat((product.price * newQuantity).toFixed(2))
        };
      } else {
        const newItem: BillItem = {
          id: `item_${Date.now()}`,
          productId: product.id,
          productName: product.name,
          quantity,
          price: product.price,
          tax: product.tax,
          discount: 0,
          total: parseFloat((product.price * quantity).toFixed(2))
        };
        newItems = [...state.currentBill.items, newItem];
      }

      const subtotal = parseFloat(
        newItems.reduce((sum, item) => sum + item.total, 0).toFixed(2)
      );

      const taxTotal = parseFloat(
        newItems
          .reduce((sum, item) => {
            const itemTaxAmount = (item.price * item.quantity * item.tax) / 100;
            return sum + itemTaxAmount;
          }, 0)
          .toFixed(2)
      );

      const total = parseFloat(
        (subtotal + taxTotal - state.currentBill.discount).toFixed(2)
      );

      return {
        ...state,
        currentBill: {
          ...state.currentBill,
          items: newItems,
          subtotal,
          taxTotal,
          total
        }
      };
    });
  },

  removeItemFromBill: (itemId: string) => {
    set(state => {
      const newItems = state.currentBill.items.filter(item => item.id !== itemId);
      const subtotal = parseFloat(
        newItems.reduce((sum, item) => sum + item.total, 0).toFixed(2)
      );
      const taxTotal = parseFloat(
        newItems
          .reduce((sum, item) => {
            const itemTaxAmount = (item.price * item.quantity * item.tax) / 100;
            return sum + itemTaxAmount;
          }, 0)
          .toFixed(2)
      );
      const total = parseFloat(
        (subtotal + taxTotal - state.currentBill.discount).toFixed(2)
      );
      return {
        ...state,
        currentBill: {
          ...state.currentBill,
          items: newItems,
          subtotal,
          taxTotal,
          total
        }
      };
    });
  },

  updateItemQuantity: (itemId: string, quantity: number) => {
    set(state => {
      const newItems = [...state.currentBill.items];
      const itemIndex = newItems.findIndex(item => item.id === itemId);
      if (itemIndex !== -1) {
        const item = newItems[itemIndex];
        newItems[itemIndex] = {
          ...item,
          quantity,
          total: parseFloat((item.price * quantity).toFixed(2))
        };
        const subtotal = parseFloat(
          newItems.reduce((sum, item) => sum + item.total, 0).toFixed(2)
        );
        const taxTotal = parseFloat(
          newItems
            .reduce((sum, item) => {
              const itemTaxAmount = (item.price * item.quantity * item.tax) / 100;
              return sum + itemTaxAmount;
            }, 0)
            .toFixed(2)
        );
        const total = parseFloat(
          (subtotal + taxTotal - state.currentBill.discount).toFixed(2)
        );
        return {
          ...state,
          currentBill: {
            ...state.currentBill,
            items: newItems,
            subtotal,
            taxTotal,
            total
          }
        };
      }
      return state;
    });
  },

  applyDiscount: (amount: number, isPercentage: boolean) => {
    set(state => {
      let discountAmount = amount;
      if (isPercentage) {
        discountAmount = (state.currentBill.subtotal * amount) / 100;
      }
      const total = parseFloat(
        (state.currentBill.subtotal + state.currentBill.taxTotal - discountAmount).toFixed(2)
      );
      return {
        ...state,
        currentBill: {
          ...state.currentBill,
          discount: parseFloat(discountAmount.toFixed(2)),
          total
        }
      };
    });
  },

  setCustomer: (customer: Customer | null) => {
    set(state => ({
      ...state,
      currentBill: {
        ...state.currentBill,
        customerId: customer?.id || null,
        customerName: customer?.name || ''
      }
    }));
  },

  searchCustomers: (query: string) => {
    const { customers } = get();
    if (!query.trim()) return [];
    const lowerQuery = query.toLowerCase();
    return customers.filter(
      customer => 
        customer.name.toLowerCase().includes(lowerQuery) || 
        customer.phone.includes(query) ||
        (customer.email && customer.email.toLowerCase().includes(lowerQuery))
    );
  },

  holdBill: (cashierId: string, cashierName: string, storeId: string, storeName: string) => {
    set(state => {
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
        status: 'held'
      };
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
          customerName: ''
        }
      };
    });
  },

  clearBill: () => {
    set(state => ({
      ...state,
      currentBill: {
        items: [],
        subtotal: 0,
        taxTotal: 0,
        discount: 0,
        total: 0,
        pointsToRedeem: 0,
        customerId: null,
        customerName: ''
      }
    }));
  },

  getBill: (id: string) => {
    const { heldBills, completedBills } = get();
    return [...heldBills, ...completedBills].find(bill => bill.id === id);
  },

  resumeHeldBill: (billId: string) => {
    set(state => {
      const heldBill = state.heldBills.find(bill => bill.id === billId);
      if (!heldBill) return state;
      const updatedHeldBills = state.heldBills.filter(bill => bill.id !== billId);
      return {
        ...state,
        heldBills: updatedHeldBills,
        currentBill: {
          items: [...heldBill.items],
          customerId: heldBill.customerId || null,
          customerName: heldBill.customerName || '',
          subtotal: heldBill.subtotal,
          taxTotal: heldBill.taxTotal,
          discount: heldBill.discount,
          total: heldBill.total,
          pointsToRedeem: 0
        }
      };
    });
  }
}));
