import { User, Product, Customer, DashboardData, Bill, StoreSettings } from '../types';
import { format, subDays } from 'date-fns';

// Mock Users
export const mockUsers: User[] = [
  {
    id: 'usr1',
    name: 'Admin User',
    email: 'admin@example.com',
    role: 'admin',
    storeId: 'store1',
    active: true,
    createdAt: format(subDays(new Date(), 30), 'yyyy-MM-dd HH:mm:ss')
  },
  {
    id: 'usr2',
    name: 'Manager User',
    email: 'manager@example.com',
    role: 'manager',
    storeId: 'store1',
    active: true,
    createdAt: format(subDays(new Date(), 20), 'yyyy-MM-dd HH:mm:ss')
  },
  {
    id: 'usr3',
    name: 'Cashier User',
    email: 'cashier@example.com',
    role: 'cashier',
    storeId: 'store1',
    active: true,
    createdAt: format(subDays(new Date(), 10), 'yyyy-MM-dd HH:mm:ss')
  }
];

// Mock Products
export const mockProducts: Product[] = [
  {
    id: 'prod1',
    name: 'Organic Milk 1L',
    barcode: '8901234567890',
    category: 'Dairy',
    price: 45.0,
    costPrice: 36.0,
    tax: 5,
    stock: 45,
    minStock: 10,
    unit: 'pack',
    image: 'https://images.pexels.com/photos/2510102/pexels-photo-2510102.jpeg?auto=compress&cs=tinysrgb&w=300'
  },
  {
    id: 'prod2',
    name: 'Whole Wheat Bread',
    barcode: '8901234567891',
    category: 'Bakery',
    price: 35.0,
    costPrice: 28.0,
    tax: 5,
    stock: 20,
    minStock: 5,
    unit: 'pack',
    image: 'https://images.pexels.com/photos/1775043/pexels-photo-1775043.jpeg?auto=compress&cs=tinysrgb&w=300'
  },
  {
    id: 'prod3',
    name: 'Fresh Eggs (12pc)',
    barcode: '8901234567892',
    category: 'Dairy',
    price: 70.0,
    costPrice: 58.0,
    tax: 5,
    stock: 30,
    minStock: 8,
    unit: 'tray',
    image: 'https://images.pexels.com/photos/162712/egg-white-food-protein-162712.jpeg?auto=compress&cs=tinysrgb&w=300'
  },
  {
    id: 'prod4',
    name: 'Colgate Toothpaste',
    barcode: '8901234567893',
    category: 'Personal Care',
    price: 55.0,
    costPrice: 44.0,
    tax: 18,
    stock: 40,
    minStock: 10,
    unit: 'tube',
    image: 'https://images.pexels.com/photos/5244062/pexels-photo-5244062.jpeg?auto=compress&cs=tinysrgb&w=300'
  },
  {
    id: 'prod5',
    name: 'Basmati Rice 5kg',
    barcode: '8901234567894',
    category: 'Groceries',
    price: 399.0,
    costPrice: 350.0,
    tax: 5,
    stock: 15,
    minStock: 3,
    unit: 'bag',
    image: 'https://images.pexels.com/photos/4110250/pexels-photo-4110250.jpeg?auto=compress&cs=tinysrgb&w=300'
  },
  {
    id: 'prod6',
    name: 'Surf Excel Detergent 1kg',
    barcode: '8901234567895',
    category: 'Home Care',
    price: 180.0,
    costPrice: 155.0,
    tax: 18,
    stock: 25,
    minStock: 5,
    unit: 'pack',
    image: 'https://images.pexels.com/photos/4389671/pexels-photo-4389671.jpeg?auto=compress&cs=tinysrgb&w=300'
  },
  {
    id: 'prod7',
    name: 'Tata Tea Gold 500g',
    barcode: '8901234567896',
    category: 'Beverages',
    price: 265.0,
    costPrice: 230.0,
    tax: 5,
    stock: 18,
    minStock: 4,
    unit: 'pack',
    image: 'https://images.pexels.com/photos/1417945/pexels-photo-1417945.jpeg?auto=compress&cs=tinysrgb&w=300'
  },
  {
    id: 'prod8',
    name: 'Amul Butter 500g',
    barcode: '8901234567897',
    category: 'Dairy',
    price: 245.0,
    costPrice: 210.0,
    tax: 5,
    stock: 22,
    minStock: 6,
    unit: 'pack',
    image: 'https://images.pexels.com/photos/236010/pexels-photo-236010.jpeg?auto=compress&cs=tinysrgb&w=300'
  }
];

// Mock Customers
export const mockCustomers: Customer[] = [
  {
    id: 'cust1',
    name: 'Rajesh Kumar',
    phone: '9876543210',
    email: 'rajesh@example.com',
    loyaltyPoints: 450,
    totalPurchases: 28500,
    lastPurchase: format(subDays(new Date(), 5), 'yyyy-MM-dd')
  },
  {
    id: 'cust2',
    name: 'Priya Sharma',
    phone: '8765432109',
    email: 'priya@example.com',
    loyaltyPoints: 320,
    totalPurchases: 19200,
    lastPurchase: format(subDays(new Date(), 2), 'yyyy-MM-dd')
  },
  {
    id: 'cust3',
    name: 'Amit Singh',
    phone: '7654321098',
    loyaltyPoints: 580,
    totalPurchases: 36500,
    lastPurchase: format(subDays(new Date(), 7), 'yyyy-MM-dd')
  },
  {
    id: 'cust4',
    name: 'Sunita Patel',
    phone: '6543210987',
    email: 'sunita@example.com',
    loyaltyPoints: 210,
    totalPurchases: 15600,
    lastPurchase: format(subDays(new Date(), 3), 'yyyy-MM-dd')
  }
];

// Mock Bills
const mockBills: Bill[] = [
  {
    id: 'bill1',
    billNumber: 'B123456',
    items: [
      {
        id: 'item1',
        productId: 'prod1',
        productName: 'Organic Milk 1L',
        quantity: 2,
        price: 45.0,
        tax: 5,
        discount: 0,
        total: 90.0
      },
      {
        id: 'item2',
        productId: 'prod2',
        productName: 'Whole Wheat Bread',
        quantity: 1,
        price: 35.0,
        tax: 5,
        discount: 0,
        total: 35.0
      }
    ],
    subtotal: 125.0,
    taxTotal: 6.25,
    discount: 0,
    total: 131.25,
    paymentMethod: 'cash',
    paymentStatus: 'paid',
    customerId: 'cust1',
    customerName: 'Rajesh Kumar',
    cashierId: 'usr3',
    cashierName: 'Cashier User',
    storeId: 'store1',
    storeName: 'Main Store',
    createdAt: format(subDays(new Date(), 1), 'yyyy-MM-dd HH:mm:ss'),
    status: 'completed'
  },
  {
    id: 'bill2',
    billNumber: 'B123457',
    items: [
      {
        id: 'item3',
        productId: 'prod5',
        productName: 'Basmati Rice 5kg',
        quantity: 1,
        price: 399.0,
        tax: 5,
        discount: 0,
        total: 399.0
      },
      {
        id: 'item4',
        productId: 'prod7',
        productName: 'Tata Tea Gold 500g',
        quantity: 2,
        price: 265.0,
        tax: 5,
        discount: 0,
        total: 530.0
      }
    ],
    subtotal: 929.0,
    taxTotal: 46.45,
    discount: 50.0,
    total: 925.45,
    paymentMethod: 'card',
    paymentStatus: 'paid',
    customerId: 'cust2',
    customerName: 'Priya Sharma',
    cashierId: 'usr3',
    cashierName: 'Cashier User',
    storeId: 'store1',
    storeName: 'Main Store',
    createdAt: format(subDays(new Date(), 2), 'yyyy-MM-dd HH:mm:ss'),
    status: 'completed'
  },
  {
    id: 'bill3',
    billNumber: 'B123458',
    items: [
      {
        id: 'item5',
        productId: 'prod4',
        productName: 'Colgate Toothpaste',
        quantity: 3,
        price: 55.0,
        tax: 18,
        discount: 0,
        total: 165.0
      },
      {
        id: 'item6',
        productId: 'prod6',
        productName: 'Surf Excel Detergent 1kg',
        quantity: 1,
        price: 180.0,
        tax: 18,
        discount: 0,
        total: 180.0
      }
    ],
    subtotal: 345.0,
    taxTotal: 62.1,
    discount: 0,
    total: 407.1,
    paymentMethod: 'upi',
    paymentStatus: 'paid',
    customerId: 'cust3',
    customerName: 'Amit Singh',
    cashierId: 'usr3',
    cashierName: 'Cashier User',
    storeId: 'store1',
    storeName: 'Main Store',
    createdAt: format(subDays(new Date(), 3), 'yyyy-MM-dd HH:mm:ss'),
    status: 'completed'
  }
];

// Mock Dashboard Data
export const mockDashboardData: DashboardData = {
  salesSummary: {
    today: 5432.75,
    yesterday: 6789.50,
    thisWeek: 32456.25,
    thisMonth: 142567.80
  },
  inventorySummary: {
    totalItems: mockProducts.length,
    lowStock: mockProducts.filter(p => p.stock <= p.minStock).length,
    outOfStock: mockProducts.filter(p => p.stock === 0).length
  },
  recentSales: mockBills,
  topProducts: [
    {
      productName: 'Basmati Rice 5kg',
      quantity: 15,
      amount: 5985.0
    },
    {
      productName: 'Tata Tea Gold 500g',
      quantity: 25,
      amount: 6625.0
    },
    {
      productName: 'Organic Milk 1L',
      quantity: 42,
      amount: 1890.0
    },
    {
      productName: 'Surf Excel Detergent 1kg',
      quantity: 18,
      amount: 3240.0
    }
  ]
};

// Mock Settings
export const mockSettings: StoreSettings = {
  general: {
    storeName: 'Main Store',
    contactEmail: 'info@billsathi.com',
    contactPhone: '+91 9876543210',
    address: '123 Main Street, City, State 123456',
    currencyFormat: 'inr',
    dateFormat: 'dd/mm/yyyy',
    theme: 'light',
    taxInclusivePrices: true,
    language: 'en',
    timezone: 'Asia/Kolkata'
  },
  store: {
    gstNumber: 'GST123456789',
    panNumber: 'PAN123456789',
    businessType: 'retail',
    openingTime: '09:00',
    closingTime: '21:00',
    workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
    branches: [
      {
        id: 'store1',
        name: 'Main Store',
        address: '123 Main Street, City, State 123456',
        phone: '+91 9876543210',
        email: 'main@billsathi.com'
      }
    ]
  },
  payment: {
    methods: {
      cash: { enabled: true, label: 'Cash' },
      card: { enabled: true, label: 'Card', types: ['credit', 'debit'] },
      upi: { enabled: true, label: 'UPI', providers: ['gpay', 'phonepe', 'paytm'] },
      wallet: { enabled: false, label: 'Wallet' }
    },
    gateway: {
      provider: 'razorpay',
      enabled: true,
      testMode: true
    }
  },
  billing: {
    invoicePrefix: 'BS',
    invoiceStartNumber: 1000,
    termsAndConditions: 'Standard terms and conditions apply',
    footerText: 'Thank you for shopping with us!',
    logo: true,
    showGst: true,
    showHsn: true,
    duplicateCopy: true,
    thermalPrinterEnabled: true
  },
  hardware: {
    printers: [
      {
        id: 'printer1',
        name: 'Thermal Printer',
        type: 'thermal',
        model: 'Epson TM-T82',
        ip: '192.168.1.100',
        port: 9100,
        enabled: true
      }
    ],
    scanner: {
      enabled: true,
      type: 'usb',
      model: 'Symbol LS2208'
    },
    weighingScale: {
      enabled: false,
      model: null,
      port: null
    },
    cashDrawer: {
      enabled: true,
      model: 'Generic',
      openOnPrint: true
    }
  },
  security: {
    passwordPolicy: {
      minLength: 8,
      requireNumbers: true,
      requireSpecialChars: true,
      expiryDays: 90
    },
    sessionTimeout: 30,
    allowMultipleLogins: false,
    ipWhitelist: [],
    twoFactorAuth: false,
    auditLogs: true
  },
  database: {
    backupSchedule: 'daily',
    backupTime: '00:00',
    retentionDays: 30,
    autoCleanup: true,
    syncInterval: 5,
    offlineMode: true,
    maxOfflineDays: 7
  }
};