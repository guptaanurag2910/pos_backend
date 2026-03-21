// services/salesService.ts
import axiosInstance from '../utils/axiosInstance';

const SALES_URL = '/api/sales/';

export interface BillItemPayload {
  product_id: number;
  quantity: number;
  rate?: number;
  tax_rate?: number;
  discount_rate?: number;
}

export interface CreateBillPayload {
  customer_id?: number | null;
  notes?: string;
  items: BillItemPayload[];
  points_to_redeem?: number;
}

export interface Bill {
  id: number;
  bill_number: string;
  customer_name: string;
  store_name: string;
  cashier_name: string;
  subtotal: string;
  tax_total: string;
  discount: string;
  round_off: string;
  total: string;
  payment_status: string;
  payment_method: string;
  status: string;
  notes: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  points_earned: number;
  points_redeemed: number;
}

export const createBill = async (payload: CreateBillPayload): Promise<Bill> => {
  const res = await axiosInstance.post(`${SALES_URL}bills/`, payload);
  return res.data;
};

export const getBill = async (billId: number): Promise<Bill> => {
  const res = await axiosInstance.get(`${SALES_URL}bills/${billId}/`);
  return res.data;
};

export const completeBill = async (
  billId: number,
  payment_method: string
): Promise<Bill> => {
  const res = await axiosInstance.post(`${SALES_URL}bills/${billId}/complete/`, {
    payment_method,
  });
  return res.data;
};

export const cancelBill = async (billId: number): Promise<Bill> => {
  const res = await axiosInstance.post(`${SALES_URL}bills/${billId}/cancel/`);
  return res.data;
};

export const holdBill = async (billId: number): Promise<Bill> => {
  const res = await axiosInstance.post(`${SALES_URL}bills/${billId}/hold/`);
  return res.data;
};

export const listHeldBills = async (): Promise<Bill[]> => {
  const res = await axiosInstance.get(`${SALES_URL}bills/`, {
    params: { status: 'on_hold' }
  });
  return res.data.results;
};

export const resumeBill = async (billId: number): Promise<Bill> => {
  const res = await axiosInstance.post(`${SALES_URL}bills/${billId}/resume/`);
  return res.data;
};

export const deleteBill = async (billId: number) => {
  return axiosInstance.delete(`${SALES_URL}bills/${billId}/`);
};

export const addBillItem = async (
  billId: number,
  item: BillItemPayload
): Promise<any> => {
  const res = await axiosInstance.post(
    `${SALES_URL}bills/${billId}/items/`,
    item
  );
  return res.data;
};

export const updateBillItem = async (
  billId: number,
  itemId: number,
  item: BillItemPayload
): Promise<any> => {
  const res = await axiosInstance.put(
    `${SALES_URL}bills/${billId}/items/${itemId}/`,
    item
  );
  return res.data;
};

export const deleteBillItem = async (billId: number, itemId: number) => {
  return axiosInstance.delete(`${SALES_URL}bills/${billId}/items/${itemId}/`);
};

export interface PaymentPayload {
  bill: number;
  amount: number;
  payment_method: string;
  transaction_id?: string;
  payment_details?: Record<string, any>;
}

export const addPayment = async (payload: PaymentPayload): Promise<any> => {
  const res = await axiosInstance.post(`${SALES_URL}payments/`, payload);
  return res.data;
};

export const refundPayment = async (paymentId: number): Promise<any> => {
  const res = await axiosInstance.post(`${SALES_URL}payments/${paymentId}/refund/`);
  return res.data;
};

export const listBills = async (params = {}) => {
  const res = await axiosInstance.get(`${SALES_URL}bills/`, { params });
  return res.data;
};

export const listPayments = async (params = {}) => {
  const res = await axiosInstance.get(`${SALES_URL}payments/`, { params });
  return res.data;
};
