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
  returnsSummary?: {
    totalReturns: number;
    pendingReturns: number;
    approvedReturns: number;
    completedReturns: number;
    rejectedReturns: number;
    totalRefundAmount: number;
    averageRefundAmount: number;
    refundRate: number;
  };
  returnsTrend?: Array<{
    period: string;
    count: number;
    refund: number;
  }>;
  refundMethods?: Array<{
    method: string;
    count: number;
    amount: number;
  }>;
  topReturnReasons?: Array<{
    reason: string;
    count: number;
    amount: number;
  }>;
  recentReturns?: Array<{
    id: number;
    returnNumber: string;
    billNumber: string | null;
    customerName: string | null;
    status: string;
    refundAmount: number;
    refundMethod: string;
    returnDate: string | null;
  }>;
}

export interface DashboardParams {
  start_date?: string;
  end_date?: string;
  time_range?: 'last7days' | 'last30days' | 'last90days' | 'thisyear';
  all_time?: boolean;
  store?: number;
}

export interface SalesReportParams {
  start_date?: string;
  end_date?: string;
  all_time?: boolean;
  group_by?: 'day' | 'week' | 'month';
  store?: number;
  export?: boolean;
}

export interface InventoryReportParams {
  start_date?: string;
  end_date?: string;
  all_time?: boolean;
  store?: number;
  category?: number;
  low_stock?: boolean;
  export?: boolean;
}

export interface CustomerReportParams {
  start_date?: string;
  end_date?: string;
  all_time?: boolean;
  export?: boolean;
}

export interface TaxReportParams {
  start_date?: string;
  end_date?: string;
  all_time?: boolean;
  export?: boolean;
}

// 1. Dashboard
export const fetchDashboard = async (params?: DashboardParams): Promise<DashboardData> => {
  const res = await axiosInstance.get(`${BASE_URL}dashboard/`, { params });
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
