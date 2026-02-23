import axiosInstance from '../utils/axiosInstance';

const BASE_URL = '/api/reports/';

export interface SalesSummary {
  today: number;
  yesterday: number;
  thisWeek: number;
  thisMonth: number;
}

export interface InventorySummary {
  totalItems: number;
  lowStock: number;
  outOfStock: number;
}

export interface DashboardData {
  salesSummary: SalesSummary;
  inventorySummary: InventorySummary;
  recentSales: any[]; // Can replace with Bill type if defined
  topProducts: {
    productName: string;
    quantity: number;
    amount: number;
  }[];
}

export interface SalesReportParams {
  start_date?: string;
  end_date?: string;
  group_by?: 'day' | 'week' | 'month';
  store?: number;
  export?: boolean;
}

export interface InventoryReportParams {
  store?: number;
  category?: number;
  low_stock?: boolean;
  export?: boolean;
}

export interface CustomerReportParams {
  start_date?: string;
  end_date?: string;
  export?: boolean;
}

export interface TaxReportParams {
  start_date?: string;
  end_date?: string;
  export?: boolean;
}

// 1. Dashboard
export const fetchDashboard = async (): Promise<DashboardData> => {
  const res = await axiosInstance.get(`${BASE_URL}dashboard/`);
  return res.data;
};

// 2. Sales Report
export const fetchSalesReport = async (params: SalesReportParams): Promise<any> => {
  const res = await axiosInstance.get(`${BASE_URL}sales/`, { params });
  return res.data;
};

// 3. Inventory Report
export const fetchInventoryReport = async (params: InventoryReportParams): Promise<any> => {
  const res = await axiosInstance.get(`${BASE_URL}inventory/`, { params });
  return res.data;
};

// 4. Customer Report
export const fetchCustomerReport = async (params: CustomerReportParams): Promise<any> => {
  const res = await axiosInstance.get(`${BASE_URL}customers/`, { params });
  return res.data;
};

// 5. Tax Report
export const fetchTaxReport = async (params: TaxReportParams): Promise<any> => {
  const res = await axiosInstance.get(`${BASE_URL}tax/`, { params });
  return res.data;
};
