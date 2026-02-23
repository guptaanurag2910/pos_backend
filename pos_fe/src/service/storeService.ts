import axiosInstance from '../utils/axiosInstance';

const STORE_URL = '/api/stores/';

export interface StoreSettings {
  id: number;
  store: number;
  store_logo: string | null;
  currency_symbol: string;
  decimal_places: number;
  date_format: string;
  theme: string;
  invoice_prefix: string;
  invoice_start_number: number;
  invoice_footer_text: string | null;
  show_tax_in_invoice: boolean;
  enable_invoice_email: boolean;
  allow_partial_payments: boolean;
  enable_discount: boolean;
  default_tax_rate: string;
  enable_round_off: boolean;
  printer_type: string;
  printer_address: string | null;
  enable_auto_print: boolean;
  enable_low_stock_alert: boolean;
  low_stock_threshold: number;
  enable_customer_points: boolean;
  points_conversion_rate: string;
  updated_at: string;
}

export interface Store {
  id: number;
  name: string;
  code: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string | null;
  gst_number: string | null;
  pan_number: string | null;
  opening_time: string | null;
  closing_time: string | null;
  is_main: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  settings: StoreSettings;
}

// List all stores (admin) or only user's store
export const listStores = async (): Promise<Store[]> => {
  const res = await axiosInstance.get(STORE_URL);
  return res.data;
};

// Get single store by ID
export const getStore = async (id: number): Promise<Store> => {
  const res = await axiosInstance.get(`${STORE_URL}${id}/`);
  return res.data;
};

// Create a new store (admin only)
export const createStore = async (data: Partial<Store>): Promise<Store> => {
  const res = await axiosInstance.post(STORE_URL, data);
  return res.data;
};

// Update store details (admin only)
export const updateStore = async (
  id: number,
  data: Partial<Store>
): Promise<Store> => {
  const res = await axiosInstance.put(`${STORE_URL}${id}/`, data);
  return res.data;
};

// Delete store (admin only)
export const deleteStore = async (id: number): Promise<void> => {
  await axiosInstance.delete(`${STORE_URL}${id}/`);
};

export const listActiveStores = async (): Promise<Store[]> => {
  const res = await axiosInstance.get(`${STORE_URL}active/`);
  return res.data;
};

export const activateStore = async (id: number): Promise<Store> => {
  const res = await axiosInstance.post(`${STORE_URL}${id}/activate/`);
  return res.data;
};

export const deactivateStore = async (id: number): Promise<Store> => {
  const res = await axiosInstance.post(`${STORE_URL}${id}/deactivate/`);
  return res.data;
};

export const setMainStore = async (id: number): Promise<Store> => {
  const res = await axiosInstance.post(`${STORE_URL}${id}/set_main/`);
  return res.data;
};

// Get store settings
export const getStoreSettings = async (
  storeId: number
): Promise<StoreSettings> => {
  const res = await axiosInstance.get(`${STORE_URL}${storeId}/settings/`);
  return res.data;
};

// Update store settings
export const updateStoreSettings = async (
  storeId: number,
  data: Partial<StoreSettings>
): Promise<StoreSettings> => {
  const res = await axiosInstance.put(
    `${STORE_URL}${storeId}/settings/`,
    data
  );
  return res.data;
};

// Partially update store settings
export const patchStoreSettings = async (
  storeId: number,
  data: Partial<StoreSettings>
): Promise<StoreSettings> => {
  const res = await axiosInstance.patch(
    `${STORE_URL}${storeId}/settings/`,
    data
  );
  return res.data;
};

export interface StoreBootstrapImportResponse {
  store_id: number;
  strict_mode: boolean;
  stats: Record<string, { processed: number; created: number; updated: number; failed: number }>;
  errors: Array<{ section: string; row: number; error: string }>;
  sheets_found: Record<string, boolean>;
}

export const bootstrapStoreImport = async (
  storeId: number,
  file: File,
  strict = true
): Promise<StoreBootstrapImportResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('strict', String(strict));

  const res = await axiosInstance.post(`${STORE_URL}${storeId}/bootstrap-import/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};
