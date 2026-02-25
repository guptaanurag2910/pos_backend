import axiosInstance from '../utils/axiosInstance';

const AUTH_URL = '/api/auth/';

export interface AuthResponse {
  access: string;
  refresh: string;
  user: {
    user_id: number;
    email: string;
    name: string;
    role: string;
    store_id: number | null;
  };
}

export interface RegisterWithStorePayload {
  email: string;
  name: string;
  password: string;
  store: {
    name: string;
    code: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    phone: string;
    email?: string | null;
    is_main?: boolean;
    is_active?: boolean;
  };
}

export const loginAPI = async (email: string, password: string): Promise<AuthResponse> => {
  const res = await axiosInstance.post(`${AUTH_URL}token/`, { email, password });
  return {
    access: res.data.access,
    refresh: res.data.refresh,
    user: {
      user_id: res.data.user_id,
      email: res.data.email,
      name: res.data.name,
      role: res.data.role,
      store_id: res.data.store_id,
    },
  };
};

export const signupAPI = async (
  email: string,
  password: string,
  name: string
): Promise<AuthResponse> => {
  await axiosInstance.post(`${AUTH_URL}register/`, { email, password, name });
  return loginAPI(email, password); // Immediately login after signup
};

export const signupWithStoreAPI = async (
  payload: RegisterWithStorePayload
): Promise<AuthResponse & { store: { id: number } }> => {
  const res = await axiosInstance.post(`${AUTH_URL}register-with-store/`, payload);
  return {
    access: res.data.access,
    refresh: res.data.refresh,
    user: {
      user_id: res.data.user.user_id,
      email: res.data.user.email,
      name: res.data.user.name,
      role: res.data.user.role,
      store_id: res.data.user.store_id,
    },
    store: {
      id: res.data.store.id,
    },
  };
};

export const patchUser = async (
  userId: number,
  data: Partial<{ name: string; email: string; role: string; store: number | null; is_active: boolean }>
) => {
  const res = await axiosInstance.patch(`${AUTH_URL}users/${userId}/`, data);
  return res.data;
};

export const logoutAPI = async (): Promise<void> => {
  const refresh_token = localStorage.getItem('refresh_token');
  try {
    if (refresh_token) {
      await axiosInstance.post(`${AUTH_URL}logout/`, { refresh_token });
    }
  } catch {
    // Logout should be idempotent on client; token may already be expired/invalid.
  } finally {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }
};

export const refreshToken = async (): Promise<{ access: string }> => {
  const refresh = localStorage.getItem('refresh_token');
  const res = await axiosInstance.post(`${AUTH_URL}token/refresh/`, { refresh });
  localStorage.setItem('access_token', res.data.access);
  return res.data;
};

export const getProfile = async (): Promise<User> => {
  const res = await axiosInstance.get(`${AUTH_URL}users/me/`);
  return {
    user_id: res.data.user_id ?? res.data.id,
    email: res.data.email,
    name: res.data.name,
    role: res.data.role,
    store_id: res.data.store_id ?? res.data.store ?? null,
  };
};

export const changePassword = async (
  userId: number,
  oldPassword: string,
  newPassword: string
) => {
  return axiosInstance.post(`${AUTH_URL}users/${userId}/change_password/`, {
    old_password: oldPassword,
    new_password: newPassword,
  });
};

export const getUserById = async (userId: number) => {
  const res = await axiosInstance.get(`${AUTH_URL}users/${userId}/`);
  return res.data;
};

export const updateUser = async (
  userId: number,
  data: Partial<{ name: string; email: string; role: string }>
) => {
  const res = await axiosInstance.put(`${AUTH_URL}users/${userId}/`, data);
  return res.data;
};

export const deleteUser = async (userId: number) => {
  const res = await axiosInstance.delete(`${AUTH_URL}users/${userId}/`);
  return res.data;
};

export const listUsers = async () => {
  const res = await axiosInstance.get(`${AUTH_URL}users/`);
  return res.data;
};

export const getSessions = async () => {
  const res = await axiosInstance.get(`${AUTH_URL}sessions/`);
  return res.data;
};

export const getAuditLogs = async (params = {}) => {
  const res = await axiosInstance.get(`${AUTH_URL}audit-logs/`, { params });
  return res.data;
};
