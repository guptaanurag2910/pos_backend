import axiosInstance from '../utils/axiosInstance';

const INVENTORY_URL = '/api/inventory/';

const sanitizeProductPayload = (input: any) => {
  if (!input || typeof input !== 'object') return input;
  const payload = { ...input };

  // Remove read-only/display-only fields that should never be sent to PUT/POST.
  delete payload.id;
  delete payload.created_at;
  delete payload.updated_at;
  delete payload.current_stock;
  delete payload.stock_details;
  delete payload.category_name;

  // Do not send image URL string in JSON requests.
  if (typeof payload.image === 'string') {
    delete payload.image;
  }

  // Normalize expiry date format.
  if (payload.expiry_date === '') payload.expiry_date = null;
  if (typeof payload.expiry_date === 'string' && payload.expiry_date.includes('T')) {
    payload.expiry_date = payload.expiry_date.split('T')[0];
  }

  return payload;
};

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
  page?: number;
  page_size?: number;
  in_stock_only?: boolean;
  stock_status?: 'in_stock' | 'out_of_stock' | 'all';
}

export const listProducts = async (params: ProductFilterParams = {}) => {
  // Only include defined filters
  const cleanParams: Record<string, string | number> = {};
  if (params.search) cleanParams.search = params.search;
  if (params.category) cleanParams.category = params.category;
  if (params.page) cleanParams.page = params.page;
  if (params.page_size) cleanParams.page_size = params.page_size;
  if (typeof params.in_stock_only === 'boolean') {
    cleanParams.in_stock_only = params.in_stock_only ? 'true' : 'false';
  }
  if (params.stock_status && params.stock_status !== 'all') {
    cleanParams.stock_status = params.stock_status;
  }

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
  const res = await axiosInstance.post(`${INVENTORY_URL}products/`, sanitizeProductPayload(data));
  return res.data;
};

export const updateProduct = async (id: number, data: any) => {
  const res = await axiosInstance.put(`${INVENTORY_URL}products/${id}/`, sanitizeProductPayload(data));
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

export const downloadInventorySheet = async (storeId?: number) => {
  const res = await axiosInstance.get(`${INVENTORY_URL}products/export_inventory_sheet/`, {
    params: storeId ? { store: storeId } : {},
    responseType: 'blob',
  });
  return res;
};

export const uploadInventorySheet = async (
  file: File,
  storeId?: number,
  override = true
) => {
  const formData = new FormData();
  formData.append('file', file);
  if (storeId) formData.append('store', String(storeId));
  formData.append('override', override ? 'true' : 'false');
  const res = await axiosInstance.post(
    `${INVENTORY_URL}products/import_inventory_sheet/`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
    }
  );
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
