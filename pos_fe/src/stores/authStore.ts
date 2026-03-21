import { create } from 'zustand';
import { AuthState } from '../types';
import {
  loginAPI,
  logoutAPI,
  getProfile,
  listUsers,
  deleteUser,
  patchUser,
  resetUserPassword as resetUserPasswordAPI,
  signupAPI,
  signupWithStoreAPI,
} from '../service/authService';
import axiosInstance from '../utils/axiosInstance';

interface AuthStore extends AuthState {
  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, password: string) => Promise<boolean>;
  registerWithStore: (payload: {
    name: string;
    email: string;
    password: string;
    store: {
      name: string;
      code: string;
      address: string;
      city: string;
      state: string;
      pincode: string;
      phone: string;
      recovery_email: string;
      email?: string | null;
      is_main?: boolean;
      is_active?: boolean;
    };
  }) => Promise<{ ok: boolean; storeId?: number }>;
  logout: () => void;
  loadUserFromToken: () => Promise<void>;
  loadUsers: () => Promise<void>;
  addUser: (payload: { name: string; email: string; role: string; password?: string }) => Promise<{ email: string; password: string }>;
  updateUserDetails: (userId: string, payload: { name: string; email: string; role: string }) => Promise<void>;
  resetUserPassword: (userId: string, newPassword: string) => Promise<void>;
  toggleUserStatus: (userId: string) => Promise<void>;
  updateSettings: (settings: Partial<AuthState['settings']>) => void;
  toggleTheme: () => void;
  isAdmin: () => boolean;
  isCashier: () => boolean;
  hasRole: (role: string) => boolean;
}

const normalizeUser = (user: any) => ({
  id: String(user.id ?? user.user_id ?? ''),
  name: user.name || '',
  email: user.email || '',
  role: user.role || 'cashier',
  storeId: String(user.store ?? user.store_id ?? ''),
  active: user.is_active ?? user.active ?? true,
  createdAt: user.date_joined || user.created_at || new Date().toISOString(),
});

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  isAuthenticated: false,
  users: [],
  settings: {
    general: {
      theme: 'light',
    },
  },

  login: async (email, password) => {
    try {
      const response = await loginAPI(email, password);
      localStorage.setItem('access_token', response.access);
      localStorage.setItem('refresh_token', response.refresh);
      set({ user: normalizeUser(response.user), isAuthenticated: true });
      await get().loadUsers();
      return true;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  },

  register: async (name, email, password) => {
    try {
      const response = await signupAPI(email, password, name);
      localStorage.setItem('access_token', response.access);
      localStorage.setItem('refresh_token', response.refresh);
      set({ user: normalizeUser(response.user), isAuthenticated: true });
      await get().loadUsers();
      return true;
    } catch (error) {
      console.error('Register error:', error);
      return false;
    }
  },

  registerWithStore: async (payload) => {
    try {
      const response = await signupWithStoreAPI(payload);
      localStorage.setItem('access_token', response.access);
      localStorage.setItem('refresh_token', response.refresh);
      set({ user: normalizeUser(response.user), isAuthenticated: true });
      await get().loadUsers();
      return { ok: true, storeId: response.store.id };
    } catch (error) {
      console.error('Register with store error:', error);
      return { ok: false };
    }
  },

  logout: () => {
    logoutAPI().catch(() => null);
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    set({ user: null, isAuthenticated: false, users: [] });
  },

  loadUserFromToken: async () => {
    try {
      const profile = await getProfile();
      set({ user: normalizeUser(profile), isAuthenticated: true });
      await get().loadUsers();
    } catch (error) {
      console.error('Failed to load user from token:', error);
      set({ user: null, isAuthenticated: false, users: [] });
    }
  },

  loadUsers: async () => {
    try {
      const response = await listUsers();
      const rows = Array.isArray(response?.results) ? response.results : Array.isArray(response) ? response : [];
      set({ users: rows.map(normalizeUser) });
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  },

  addUser: async (payload) => {
    const token = localStorage.getItem('access_token');
    if (!token) throw new Error('Not authenticated');

    const body = {
      name: payload.name,
      email: payload.email,
      role: payload.role,
      password: payload.password || 'Temp@12345',
    };

    const res = await axiosInstance.post('/api/auth/users/create-store-user/', body);
    await get().loadUsers();
    return {
      email: res?.data?.credentials?.email || body.email,
      password: res?.data?.credentials?.password || body.password,
    };
  },

  updateUserDetails: async (userId, payload) => {
    await patchUser(Number(userId), {
      name: payload.name,
      email: payload.email,
      role: payload.role,
    });
    await get().loadUsers();
  },

  resetUserPassword: async (userId, newPassword) => {
    await resetUserPasswordAPI(Number(userId), newPassword);
  },

  toggleUserStatus: async (userId: string) => {
    const target = get().users.find((u) => String(u.id) === String(userId));
    if (!target) return;

    if (target.active) {
      await deleteUser(Number(userId));
    } else {
      await axiosInstance.patch(`/api/auth/users/${userId}/`, { is_active: true });
    }

    await get().loadUsers();
  },

  updateSettings: (newSettings) => {
    set((state) => ({
      settings: {
        ...state.settings,
        ...newSettings,
      },
    }));
  },

  toggleTheme: () => {
    set((state) => ({
      settings: {
        ...state.settings,
        general: {
          ...state.settings.general,
          theme: state.settings.general.theme === 'light' ? 'dark' : 'light',
        },
      },
    }));
  },

  isAdmin: () => get().user?.role === 'admin',
  isCashier: () => get().user?.role === 'cashier',
  hasRole: (role: string) => get().user?.role === role,
}));
