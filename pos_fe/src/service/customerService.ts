import axiosInstance from '../utils/axiosInstance';

const API_URL = '/api/customers/';

export interface CustomerData {
  id?: number;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  loyalty_points?: number;
  gst_number?: string;
  pan_number?: string;
  birthdate?: string;
  anniversary?: string;
  notes?: string;
}

export interface GroupData {
  id?: number;
  name: string;
  description?: string;
  special_discount?: number;
  is_active?: boolean;
}

// -----------------------------
// Customers
// -----------------------------

const customerService = {
  list: async (params = {}) => {
    const response = await axiosInstance.get(API_URL, { params });
    return response.data;
  },

  get: async (id: number) => {
    const response = await axiosInstance.get(`${API_URL}${id}/`);
    return response.data;
  },

  create: async (data: CustomerData) => {
    const response = await axiosInstance.post(API_URL, data);
    return response.data;
  },

  update: async (id: number, data: Partial<CustomerData>) => {
    const response = await axiosInstance.put(`${API_URL}${id}/`, data);
    return response.data;
  },

  delete: async (id: number) => {
    const response = await axiosInstance.delete(`${API_URL}${id}/`);
    return response.data;
  },

  addPoints: async (id: number, points: number, reason = 'Manual adjustment') => {
    const response = await axiosInstance.post(`${API_URL}${id}/add_points/`, {
      points,
      reason,
    });
    return response.data;
  },

  getPurchaseHistory: async (id: number) => {
    const response = await axiosInstance.get(`${API_URL}${id}/purchase_history/`);
    return response.data;
  },

  getStats: async () => {
    const response = await axiosInstance.get(`${API_URL}stats/`);
    return response.data;
  },
};

// -----------------------------
// Customer Groups
// -----------------------------

const customerGroupService = {
  list: async (params = {}) => {
    const response = await axiosInstance.get(`${API_URL}groups/`, { params });
    return response.data;
  },

  get: async (id: number) => {
    const response = await axiosInstance.get(`${API_URL}groups/${id}/`);
    return response.data;
  },

  create: async (data: GroupData) => {
    const response = await axiosInstance.post(`${API_URL}groups/`, data);
    return response.data;
  },

  update: async (id: number, data: Partial<GroupData>) => {
    const response = await axiosInstance.put(`${API_URL}groups/${id}/`, data);
    return response.data;
  },

  delete: async (id: number) => {
    const response = await axiosInstance.delete(`${API_URL}groups/${id}/`);
    return response.data;
  },

  addCustomers: async (groupId: number, customerIds: number[]) => {
    const response = await axiosInstance.post(`${API_URL}groups/${groupId}/add_customers/`, {
      customer_ids: customerIds,
    });
    return response.data;
  },

  removeCustomers: async (groupId: number, customerIds: number[]) => {
    const response = await axiosInstance.post(`${API_URL}groups/${groupId}/remove_customers/`, {
      customer_ids: customerIds,
    });
    return response.data;
  },
};

export { customerService, customerGroupService };
