import { create } from 'zustand';
import { AuthState, User } from '../types';
import {
  loginAPI,
  logoutAPI,
  getProfile,
} from '../service/authService'; // Adjust path if needed

interface AuthStore extends AuthState {
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  loadUserFromToken: () => Promise<void>;
  updateSettings: (settings: Partial<AuthState['settings']>) => void;
  toggleTheme: () => void;

  // Role-based access helpers
  isAdmin: () => boolean;
  isCashier: () => boolean;
  hasRole: (role: string) => boolean;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  isAuthenticated: false,
  settings: {
    general: {
      theme: 'light',
    },
  },

  // ✅ Login using API
  login: async (email, password) => {
    try {
      const response = await loginAPI(email, password);
      localStorage.setItem('access_token', response.access);
      localStorage.setItem('refresh_token', response.refresh);
      set({ user: response.user, isAuthenticated: true });
      return true;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  },

  // ✅ Logout using API
  logout: () => {
    logoutAPI().catch((err) => console.error('Logout failed:', err));
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    set({ user: null, isAuthenticated: false });
  },

  // ✅ Load user profile from stored token
  loadUserFromToken: async () => {
    try {
      const profile = await getProfile();
      set({ user: profile, isAuthenticated: true });
    } catch (error) {
      console.error('Failed to load user from token:', error);
      set({ user: null, isAuthenticated: false });
    }
  },

  // 🎨 Update UI settings (e.g., theme)
  updateSettings: (newSettings) => {
    set((state) => ({
      settings: {
        ...state.settings,
        ...newSettings,
      },
    }));
  },

  // 🌗 Toggle light/dark theme
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

  // 🔐 Role-based access helpers
  isAdmin: () => get().user?.role === 'admin',
  isCashier: () => get().user?.role === 'cashier',
  hasRole: (role: string) => get().user?.role === role,
}));
