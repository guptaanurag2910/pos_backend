import { create } from 'zustand';
import { DashboardData } from '../types';
import { mockDashboardData } from '../data/mockData';
import { fetchDashboard } from '../service/reportService';

interface DashboardStore {
  dashboardData: DashboardData | null;
  isLoading: boolean;
  selectedTimeRange: string;
  loadDashboardData: () => Promise<void>;
  setTimeRange: (range: string) => void;
  getAdvancedMetrics: () => any;
}

export const useDashboardStore = create<DashboardStore>((set, get) => ({
  dashboardData: null,
  isLoading: false,
  selectedTimeRange: 'last30days',
  
  loadDashboardData: async () => {
    try {
      set({ isLoading: true });

      const apiData = await fetchDashboard();
      set({
        dashboardData: apiData as unknown as DashboardData,
        isLoading: false
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      // Safe fallback to local mock data when API is unavailable.
      set({
        dashboardData: mockDashboardData as unknown as DashboardData,
        isLoading: false
      });
    }
  },

  setTimeRange: (range: string) => {
    set({ selectedTimeRange: range });
    // Reload data with new time range
    get().loadDashboardData();
  },

  getAdvancedMetrics: () => {
    const { dashboardData } = get();
    return dashboardData?.advancedMetrics || {};
  }
}));
