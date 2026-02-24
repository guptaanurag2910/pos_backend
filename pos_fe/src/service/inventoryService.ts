import axiosInstance from '../utils/axiosInstance';

const INVENTORY_URL = '/api/inventory/';

// ---------------------------
// Categories
// ---------------------------
export const listCategories = async () => {
  const res = await axiosInstance.get(`${INVENTORY_URL}categories/`);
  if (Array.isArray(res.data)) {
    return { results: res.data, count: res.data.length };
  }
  return {
    ...res.data,
    results: Array.isArray(res.data?.results) ? res.data.results : [],
  };
};

export const getCategory = async (id: number) => {
  const res = await axiosInstance.get(`${INVENTORY_URL}categories/${id}/`);
  return res.data;
};

export const createCategory = async (data: any) => {
  const res = await axiosInstance.post(`${INVENTORY_URL}categories/`, data);
  return res.data;
};

export const updateCategory = async (id: number, data: any) => {
  const res = await axiosInstance.put(`${INVENTORY_URL}categories/${id}/`, data);
  return res.data;
};

export const deleteCategory = async (id: number) => {
  return axiosInstance.delete(`${INVENTORY_URL}categories/${id}/`);
};

// ---------------------------
// Products
// ---------------------------
interface ProductFilterParams {
  search?: string;
  category?: number;
}

export const listProducts = async (params: ProductFilterParams = {}) => {
  // Only include defined filters
  const cleanParams: Record<string, string | number> = {};
  if (params.search) cleanParams.search = params.search;
  if (params.category) cleanParams.category = params.category;

  const res = await axiosInstance.get(`${INVENTORY_URL}products/`, { params: cleanParams });
  if (Array.isArray(res.data)) {
    return { results: res.data, count: res.data.length };
  }
  return {
    ...res.data,
    results: Array.isArray(res.data?.results) ? res.data.results : [],
  };
};

export const getProduct = async (id: number) => {
  const res = await axiosInstance.get(`${INVENTORY_URL}products/${id}/`);
  return res.data;
};

export const createProduct = async (data: any) => {
  const res = await axiosInstance.post(`${INVENTORY_URL}products/`, data);
  return res.data;
};

export const updateProduct = async (id: number, data: any) => {
  const res = await axiosInstance.put(`${INVENTORY_URL}products/${id}/`, data);
  return res.data;
};

export const deleteProduct = async (id: number) => {
  return axiosInstance.delete(`${INVENTORY_URL}products/${id}/`);
};

export const getProductStockLevels = async (id: number) => {
  const res = await axiosInstance.get(`${INVENTORY_URL}products/${id}/stock_levels/`);
  return res.data;
};

export const getProductStockHistory = async (id: number) => {
  const res = await axiosInstance.get(`${INVENTORY_URL}products/${id}/stock_history/`);
  return res.data;
};

export const adjustProductStock = async (
  id: number,
  data: { store: number; quantity: number; reason?: string }
) => {
  const res = await axiosInstance.post(`${INVENTORY_URL}products/${id}/adjust_stock/`, data);
  return res.data;
};

// ---------------------------
// Stock Records
// ---------------------------
export const listStockRecords = async (params: any = {}) => {
  const res = await axiosInstance.get(`${INVENTORY_URL}stock-records/`, { params });
  return res.data;
};

// ---------------------------
// Stock Levels
// ---------------------------
export const listStockLevels = async (params: any = {}) => {
  const res = await axiosInstance.get(`${INVENTORY_URL}stock-levels/`, { params });
  return res.data;
};

export const listLowStockLevels = async () => {
  const res = await axiosInstance.get(`${INVENTORY_URL}stock-levels/low_stock/`);
  return res.data;
};

// ---------------------------
// Stock Transfers
// ---------------------------
export const listTransfers = async (params: any = {}) => {
  const res = await axiosInstance.get(`${INVENTORY_URL}stock-transfers/`, { params });
  return res.data;
};

export const getTransfer = async (id: number) => {
  const res = await axiosInstance.get(`${INVENTORY_URL}stock-transfers/${id}/`);
  return res.data;
};

export const createTransfer = async (data: any) => {
  const res = await axiosInstance.post(`${INVENTORY_URL}stock-transfers/`, data);
  return res.data;
};

export const updateTransferStatus = async (id: number, status: string) => {
  const res = await axiosInstance.post(`${INVENTORY_URL}stock-transfers/${id}/update_status/`, {
    status,
  });
  return res.data;
};

// ---------------------------
// Transfer Items
// ---------------------------
export const listTransferItems = async (transferId: number) => {
  const res = await axiosInstance.get(`${INVENTORY_URL}stock-transfers/${transferId}/items/`);
  return res.data;
};

export const addTransferItem = async (transferId: number, data: any) => {
  const res = await axiosInstance.post(`${INVENTORY_URL}stock-transfers/${transferId}/items/`, data);
  return res.data;
};

export const updateTransferItem = async (
  transferId: number,
  itemId: number,
  data: any
) => {
  const res = await axiosInstance.put(
    `${INVENTORY_URL}stock-transfers/${transferId}/items/${itemId}/`,
    data
  );
  return res.data;
};

export const deleteTransferItem = async (transferId: number, itemId: number) => {
  return axiosInstance.delete(`${INVENTORY_URL}stock-transfers/${transferId}/items/${itemId}/`);
};
