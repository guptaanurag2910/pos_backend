import axiosInstance from '../utils/axiosInstance';

const SUPPLIER_BASE_URL = '/api/suppliers/';

// -----------------------------
// Supplier APIs
// -----------------------------

// Fetch all suppliers
export const listSuppliers = async () => {
  const res = await axiosInstance.get(`${SUPPLIER_BASE_URL}suppliers/`);
  return res.data.results || res.data;
};

// Get details of a single supplier
export const getSupplier = async (id: number) => {
  const res = await axiosInstance.get(`${SUPPLIER_BASE_URL}suppliers/${id}/`);
  return res.data;
};

// Create a new supplier
export const createSupplier = async (data: any) => {
  const res = await axiosInstance.post(`${SUPPLIER_BASE_URL}suppliers/`, data);
  return res.data;
};

// Update an existing supplier
export const updateSupplier = async (id: number, data: any) => {
  const res = await axiosInstance.put(`${SUPPLIER_BASE_URL}suppliers/${id}/`, data);
  return res.data;
};

// Delete a supplier
export const deleteSupplier = async (id: number) => {
  return axiosInstance.delete(`${SUPPLIER_BASE_URL}suppliers/${id}/`);
};

// Search suppliers by query
export const searchSuppliers = async (query: string) => {
  const res = await axiosInstance.get(`${SUPPLIER_BASE_URL}suppliers/`, {
    params: { search: query },
  });
  return res.data.results || res.data;
};

// Get purchase order history of a supplier
export const getSupplierPurchaseHistory = async (id: number) => {
  const res = await axiosInstance.get(`${SUPPLIER_BASE_URL}suppliers/${id}/purchase_history/`);
  return res.data;
};

// Get payment history of a supplier
export const getSupplierPaymentHistory = async (id: number) => {
  const res = await axiosInstance.get(`${SUPPLIER_BASE_URL}suppliers/${id}/payment_history/`);
  return res.data;
};

// -----------------------------
// Purchase Order APIs
// -----------------------------

export const listPurchaseOrders = async (params = {}) => {
  const res = await axiosInstance.get(`${SUPPLIER_BASE_URL}purchase-orders/`, { params });
  return res.data;
};

export const getPurchaseOrder = async (id: number) => {
  const res = await axiosInstance.get(`${SUPPLIER_BASE_URL}purchase-orders/${id}/`);
  return res.data;
};

export const createPurchaseOrder = async (data: any) => {
  const res = await axiosInstance.post(`${SUPPLIER_BASE_URL}purchase-orders/`, data);
  return res.data;
};

export const updatePurchaseOrder = async (id: number, data: any) => {
  const res = await axiosInstance.put(`${SUPPLIER_BASE_URL}purchase-orders/${id}/`, data);
  return res.data;
};

export const deletePurchaseOrder = async (id: number) => {
  return axiosInstance.delete(`${SUPPLIER_BASE_URL}purchase-orders/${id}/`);
};

export const updatePurchaseOrderStatus = async (id: number, status: string) => {
  const res = await axiosInstance.post(
    `${SUPPLIER_BASE_URL}purchase-orders/${id}/update_status/`,
    { status }
  );
  return res.data;
};

// -----------------------------
// Purchase Order Item APIs
// -----------------------------

export const addPurchaseOrderItem = async (poId: number, item: any) => {
  const res = await axiosInstance.post(
    `${SUPPLIER_BASE_URL}purchase-orders/${poId}/items/`,
    item
  );
  return res.data;
};

export const updatePurchaseOrderItem = async (poId: number, itemId: number, item: any) => {
  const res = await axiosInstance.put(
    `${SUPPLIER_BASE_URL}purchase-orders/${poId}/items/${itemId}/`,
    item
  );
  return res.data;
};

export const deletePurchaseOrderItem = async (poId: number, itemId: number) => {
  return axiosInstance.delete(
    `${SUPPLIER_BASE_URL}purchase-orders/${poId}/items/${itemId}/`
  );
};

// -----------------------------
// Goods Receipt Note (GRN) APIs
// -----------------------------

export const listGRNs = async (params = {}) => {
  const res = await axiosInstance.get(`${SUPPLIER_BASE_URL}grn/`, { params });
  return res.data;
};

export const getGRN = async (id: number) => {
  const res = await axiosInstance.get(`${SUPPLIER_BASE_URL}grn/${id}/`);
  return res.data;
};

export const createGRN = async (data: any) => {
  const res = await axiosInstance.post(`${SUPPLIER_BASE_URL}grn/`, data);
  return res.data;
};

export const updateGRN = async (id: number, data: any) => {
  const res = await axiosInstance.put(`${SUPPLIER_BASE_URL}grn/${id}/`, data);
  return res.data;
};

export const deleteGRN = async (id: number) => {
  return axiosInstance.delete(`${SUPPLIER_BASE_URL}grn/${id}/`);
};

export const completeGRN = async (id: number) => {
  const res = await axiosInstance.post(`${SUPPLIER_BASE_URL}grn/${id}/complete/`);
  return res.data;
};

// -----------------------------
// GRN Item APIs
// -----------------------------

export const addGRNItem = async (grnId: number, item: any) => {
  const res = await axiosInstance.post(`${SUPPLIER_BASE_URL}grn/${grnId}/items/`, item);
  return res.data;
};

export const updateGRNItem = async (grnId: number, itemId: number, item: any) => {
  const res = await axiosInstance.put(`${SUPPLIER_BASE_URL}grn/${grnId}/items/${itemId}/`, item);
  return res.data;
};

export const deleteGRNItem = async (grnId: number, itemId: number) => {
  return axiosInstance.delete(`${SUPPLIER_BASE_URL}grn/${grnId}/items/${itemId}/`);
};

// -----------------------------
// Supplier Payment APIs
// -----------------------------

export const listSupplierPayments = async (params = {}) => {
  const res = await axiosInstance.get(`${SUPPLIER_BASE_URL}payments/`, { params });
  return res.data;
};

export const getSupplierPayment = async (id: number) => {
  const res = await axiosInstance.get(`${SUPPLIER_BASE_URL}payments/${id}/`);
  return res.data;
};

export const createSupplierPayment = async (data: any) => {
  const res = await axiosInstance.post(`${SUPPLIER_BASE_URL}payments/`, data);
  return res.data;
};

export const updateSupplierPayment = async (id: number, data: any) => {
  const res = await axiosInstance.put(`${SUPPLIER_BASE_URL}payments/${id}/`, data);
  return res.data;
};

export const partialUpdateSupplierPayment = async (id: number, data: any) => {
  const res = await axiosInstance.patch(`${SUPPLIER_BASE_URL}payments/${id}/`, data);
  return res.data;
};

export const deleteSupplierPayment = async (id: number) => {
  return axiosInstance.delete(`${SUPPLIER_BASE_URL}payments/${id}/`);
};

// -----------------------------
// Supplier Invoice APIs
// -----------------------------

export const listSupplierInvoices = async (params = {}) => {
  const res = await axiosInstance.get(`${SUPPLIER_BASE_URL}supplier-invoices/`, { params });
  return res.data;
};

export const getSupplierInvoice = async (id: number) => {
  const res = await axiosInstance.get(`${SUPPLIER_BASE_URL}supplier-invoices/${id}/`);
  return res.data;
};

export const createSupplierInvoice = async (data: any) => {
  const res = await axiosInstance.post(`${SUPPLIER_BASE_URL}supplier-invoices/`, data);
  return res.data;
};

export const updateSupplierInvoice = async (id: number, data: any) => {
  const res = await axiosInstance.put(`${SUPPLIER_BASE_URL}supplier-invoices/${id}/`, data);
  return res.data;
};

export const deleteSupplierInvoice = async (id: number) => {
  return axiosInstance.delete(`${SUPPLIER_BASE_URL}supplier-invoices/${id}/`);
};

// -----------------------------
// Supplier Invoice Item APIs
// -----------------------------

export const addSupplierInvoiceItem = async (invoiceId: number, item: any) => {
  const res = await axiosInstance.post(`${SUPPLIER_BASE_URL}supplier-invoices/${invoiceId}/items/`, item);
  return res.data;
};

export const updateSupplierInvoiceItem = async (invoiceId: number, itemId: number, item: any) => {
  const res = await axiosInstance.put(`${SUPPLIER_BASE_URL}supplier-invoices/${invoiceId}/items/${itemId}/`, item);
  return res.data;
};

export const deleteSupplierInvoiceItem = async (invoiceId: number, itemId: number) => {
  return axiosInstance.delete(`${SUPPLIER_BASE_URL}supplier-invoices/${invoiceId}/items/${itemId}/`);
};
