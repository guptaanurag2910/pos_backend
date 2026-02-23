import axiosInstance from '../utils/axiosInstance';

const BASE_URL = '/api/';

// Utility to get actual supplier list endpoint from root
const getSupplierListUrl = async () => {
  const linksRes = await axiosInstance.get(`${BASE_URL}suppliers/`);
  const supplierUrl = linksRes.data?.suppliers;
  if (!supplierUrl) throw new Error('Supplier endpoint not found in API root');
  return supplierUrl;
};

// -----------------------------
// Supplier APIs
// -----------------------------

// Fetch all suppliers
export const listSuppliers = async () => {
  const url = await getSupplierListUrl();
  const res = await axiosInstance.get(url);
  return res.data.results || res.data;
};

// Get details of a single supplier
export const getSupplier = async (id: number) => {
  const url = await getSupplierListUrl();
  const res = await axiosInstance.get(`${url}${id}/`);
  return res.data;
};

// Create a new supplier
export const createSupplier = async (data: any) => {
  const url = await getSupplierListUrl();
  const res = await axiosInstance.post(url, data);
  return res.data;
};

// Update an existing supplier
export const updateSupplier = async (id: number, data: any) => {
  const url = await getSupplierListUrl();
  const res = await axiosInstance.put(`${url}${id}/`, data);
  return res.data;
};

// Delete a supplier
export const deleteSupplier = async (id: number) => {
  const url = await getSupplierListUrl();
  return axiosInstance.delete(`${url}${id}/`);
};

// Search suppliers by query
export const searchSuppliers = async (query: string) => {
  const url = await getSupplierListUrl();
  const res = await axiosInstance.get(url, {
    params: { search: query },
  });
  return res.data.results || res.data;
};

// Get purchase order history of a supplier
export const getSupplierPurchaseHistory = async (id: number) => {
  const res = await axiosInstance.get(`${BASE_URL}suppliers/${id}/purchase_history/`);
  return res.data;
};

// Get payment history of a supplier
export const getSupplierPaymentHistory = async (id: number) => {
  const res = await axiosInstance.get(`${BASE_URL}suppliers/${id}/payment_history/`);
  return res.data;
};

// -----------------------------
// Purchase Order APIs
// -----------------------------

export const listPurchaseOrders = async (params = {}) => {
  const res = await axiosInstance.get(`${BASE_URL}suppliers/purchase-orders/`, { params });
  return res.data;
};

export const getPurchaseOrder = async (id: number) => {
  const res = await axiosInstance.get(`${BASE_URL}suppliers/purchase-orders/${id}/`);
  return res.data;
};

export const createPurchaseOrder = async (data: any) => {
  const res = await axiosInstance.post(`${BASE_URL}suppliers/purchase-orders/`, data);
  return res.data;
};

export const updatePurchaseOrder = async (id: number, data: any) => {
  const res = await axiosInstance.put(`${BASE_URL}suppliers/purchase-orders/${id}/`, data);
  return res.data;
};

export const deletePurchaseOrder = async (id: number) => {
  return axiosInstance.delete(`${BASE_URL}suppliers/purchase-orders/${id}/`);
};

export const updatePurchaseOrderStatus = async (id: number, status: string) => {
  const res = await axiosInstance.post(
    `${BASE_URL}suppliers/purchase-orders/${id}/update_status/`,
    { status }
  );
  return res.data;
};

// -----------------------------
// Purchase Order Item APIs
// -----------------------------

export const addPurchaseOrderItem = async (poId: number, item: any) => {
  const res = await axiosInstance.post(
    `${BASE_URL}suppliers/purchase-orders/${poId}/items/`,
    item
  );
  return res.data;
};

export const updatePurchaseOrderItem = async (poId: number, itemId: number, item: any) => {
  const res = await axiosInstance.put(
    `${BASE_URL}suppliers/purchase-orders/${poId}/items/${itemId}/`,
    item
  );
  return res.data;
};

export const deletePurchaseOrderItem = async (poId: number, itemId: number) => {
  return axiosInstance.delete(
    `${BASE_URL}suppliers/purchase-orders/${poId}/items/${itemId}/`
  );
};

// -----------------------------
// Goods Receipt Note (GRN) APIs
// -----------------------------

export const listGRNs = async (params = {}) => {
  const res = await axiosInstance.get(`/api/suppliers/grn/`, { params });
  return res.data;
};

export const getGRN = async (id: number) => {
  const res = await axiosInstance.get(`/api/suppliers/grn/${id}/`);
  return res.data;
};

export const createGRN = async (data: any) => {
  const res = await axiosInstance.post(`/api/suppliers/grn/`, data);
  return res.data;
};

export const updateGRN = async (id: number, data: any) => {
  const res = await axiosInstance.put(`/api/suppliers/grn/${id}/`, data);
  return res.data;
};

export const deleteGRN = async (id: number) => {
  return axiosInstance.delete(`/api/suppliers/grn/${id}/`);
};

export const completeGRN = async (id: number) => {
  const res = await axiosInstance.post(`/api/suppliers/grn/${id}/complete/`);
  return res.data;
};

// -----------------------------
// GRN Item APIs
// -----------------------------

export const addGRNItem = async (grnId: number, item: any) => {
  const res = await axiosInstance.post(`/api/suppliers/grn/${grnId}/items/`, item);
  return res.data;
};

export const updateGRNItem = async (grnId: number, itemId: number, item: any) => {
  const res = await axiosInstance.put(`/api/suppliers/grn/${grnId}/items/${itemId}/`, item);
  return res.data;
};

export const deleteGRNItem = async (grnId: number, itemId: number) => {
  return axiosInstance.delete(`/api/suppliers/grn/${grnId}/items/${itemId}/`);
};

// -----------------------------
// Supplier Payment APIs
// -----------------------------

export const listSupplierPayments = async (params = {}) => {
  const res = await axiosInstance.get(`${BASE_URL}payments/`, { params });
  return res.data;
};

export const getSupplierPayment = async (id: number) => {
  const res = await axiosInstance.get(`${BASE_URL}payments/${id}/`);
  return res.data;
};

export const createSupplierPayment = async (data: any) => {
  const res = await axiosInstance.post(`${BASE_URL}payments/`, data);
  return res.data;
};

export const updateSupplierPayment = async (id: number, data: any) => {
  const res = await axiosInstance.put(`${BASE_URL}payments/${id}/`, data);
  return res.data;
};

export const deleteSupplierPayment = async (id: number) => {
  return axiosInstance.delete(`${BASE_URL}payments/${id}/`);
};

// -----------------------------
// Supplier Invoice APIs
// -----------------------------

export const listSupplierInvoices = async (params = {}) => {
  const res = await axiosInstance.get(`${BASE_URL}suppliers/supplier-invoices/`, { params });
  return res.data;
};

export const getSupplierInvoice = async (id: number) => {
  const res = await axiosInstance.get(`${BASE_URL}suppliers/supplier-invoices/${id}/`);
  return res.data;
};

export const createSupplierInvoice = async (data: any) => {
  const res = await axiosInstance.post(`${BASE_URL}suppliers/supplier-invoices/`, data);
  return res.data;
};

export const updateSupplierInvoice = async (id: number, data: any) => {
  const res = await axiosInstance.put(`${BASE_URL}suppliers/supplier-invoices/${id}/`, data);
  return res.data;
};

export const deleteSupplierInvoice = async (id: number) => {
  return axiosInstance.delete(`${BASE_URL}suppliers/supplier-invoices/${id}/`);
};

// -----------------------------
// Supplier Invoice Item APIs
// -----------------------------

export const addSupplierInvoiceItem = async (invoiceId: number, item: any) => {
  const res = await axiosInstance.post(`${BASE_URL}suppliers/supplier-invoices/${invoiceId}/items/`, item);
  return res.data;
};

export const updateSupplierInvoiceItem = async (invoiceId: number, itemId: number, item: any) => {
  const res = await axiosInstance.put(`${BASE_URL}suppliers/supplier-invoices/${invoiceId}/items/${itemId}/`, item);
  return res.data;
};

export const deleteSupplierInvoiceItem = async (invoiceId: number, itemId: number) => {
  return axiosInstance.delete(`${BASE_URL}suppliers/supplier-invoices/${invoiceId}/items/${itemId}/`);
};
