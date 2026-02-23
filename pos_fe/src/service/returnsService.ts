import axiosInstance from '../utils/axiosInstance';

const RETURNS_URL = '/api/return/';

// --- ENUM TYPES ---
export type ReturnType = 'full' | 'partial';
export type RefundMethod = 'cash' | 'card' | 'store_credit' | 'exchange';
export type ReturnStatus = 'pending' | 'approved' | 'completed' | 'rejected';
export type ProductCondition = 'good' | 'damaged' | 'defective' | 'expired';

// --- PAYLOAD TYPES ---
export interface ReturnItemPayload {
  bill_item: number;
  product: number;
  original_quantity: number;
  return_quantity: number;
  unit_price: number;
  tax: number;
  reason: string;
  condition: ProductCondition;
  refund_amount: number;
}

export interface CreateReturnPayload {
  bill: number;
  return_type: ReturnType;
  reason: string;
  subtotal: number;
  tax_total: number;
  refund_amount: number;
  refund_method: RefundMethod;
  return_date: string;
  notes?: string;
  customer_name?: string;
  customer_id?: string;
  items: ReturnItemPayload[];
}

// --- RESPONSE TYPES ---
export interface ReturnItem {
  id: number;
  bill_item: number;
  product: number;
  product_name: string;
  original_quantity: number;
  return_quantity: number;
  unit_price: string;
  tax: string;
  reason: string;
  condition: ProductCondition;
  refund_amount: string;
}

export interface Return {
  id: number;
  return_number: string;
  bill: number;
  bill_number: string;
  return_type: ReturnType;
  reason: string;
  subtotal: string;
  tax_total: string;
  refund_amount: string;
  refund_method: RefundMethod;
  status: ReturnStatus;
  return_date: string;
  notes?: string;
  customer_name?: string;
  customer_id?: string;
  processed_by?: number | null;
  processed_at?: string | null;
  created_at: string;
  updated_at: string;
  items: ReturnItem[];
}

export interface ReturnsListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Return[];
}

const toCamel = (str: string) =>
  str.replace(/_([a-z])/g, (_, char) => char.toUpperCase());

const camelizeKeys = <T extends Record<string, any>>(obj: T): any => {
  if (Array.isArray(obj)) return obj.map(camelizeKeys);
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [toCamel(key), camelizeKeys(value)])
    );
  }
  return obj;
};

// --- API FUNCTIONS ---
export const createReturn = async (payload: CreateReturnPayload): Promise<Return> => {
  try {
    const response = await axiosInstance.post(`${RETURNS_URL}`, payload);
    return response.data;
  } catch (error: any) {
    console.error('Error creating return:', error);
    throw new Error(error?.response?.data?.detail || 'Failed to create return.');
  }
};

export const getReturn = async (id: number): Promise<Return> => {
  try {
    const response = await axiosInstance.get(`${RETURNS_URL}${id}/`);
    return response.data;
  } catch (error: any) {
    console.error('Error fetching return:', error);
    throw new Error(error?.response?.data?.detail || 'Failed to fetch return.');
  }
};

export const listReturns = async (
  params: Record<string, any> = {}
): Promise<ReturnsListResponse> => {
  try {
    const response = await axiosInstance.get(`${RETURNS_URL}`, { params });
    const camelized = camelizeKeys(response.data);
    return camelized;
  } catch (error: any) {
    console.error('Error fetching returns list:', error);
    throw new Error(error?.response?.data?.detail || 'Failed to fetch return list.');
  }
};

export const approveReturn = async (id: number): Promise<Return> => {
  try {
    const response = await axiosInstance.post(`${RETURNS_URL}${id}/approve/`);
    return response.data;
  } catch (error: any) {
    console.error('Error approving return:', error);
    throw new Error(error?.response?.data?.detail || 'Failed to approve return.');
  }
};

export const rejectReturn = async (id: number): Promise<Return> => {
  try {
    const response = await axiosInstance.post(`${RETURNS_URL}${id}/reject/`);
    return response.data;
  } catch (error: any) {
    console.error('Error rejecting return:', error);
    throw new Error(error?.response?.data?.detail || 'Failed to reject return.');
  }
};

export const completeReturn = async (id: number): Promise<Return> => {
  try {
    const response = await axiosInstance.post(`${RETURNS_URL}${id}/complete/`);
    return response.data;
  } catch (error: any) {
    console.error('Error completing return:', error);
    throw new Error(error?.response?.data?.detail || 'Failed to complete return.');
  }
};

export const deleteReturn = async (id: number): Promise<void> => {
  try {
    await axiosInstance.delete(`${RETURNS_URL}${id}/`);
  } catch (error: any) {
    console.error('Error deleting return:', error);
    throw new Error(error?.response?.data?.detail || 'Failed to delete return.');
  }
};

export const updateReturn = async (
  id: number,
  payload: Partial<CreateReturnPayload>
): Promise<Return> => {
  try {
    const response = await axiosInstance.patch(`${RETURNS_URL}${id}/`, payload);
    return response.data;
  } catch (error: any) {
    console.error('Error updating return:', error);
    throw new Error(error?.response?.data?.detail || 'Failed to update return.');
  }
};
