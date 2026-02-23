import { create } from 'zustand';
import { DashboardData } from '../types';
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

      const selectedTimeRange = get().selectedTimeRange;
      const params =
        selectedTimeRange === 'alltime'
          ? { all_time: true }
          : { time_range: selectedTimeRange as 'last7days' | 'last30days' | 'last90days' | 'thisyear' };

      const apiData = await fetchDashboard(params);
      set({
        dashboardData: apiData as unknown as DashboardData,
        isLoading: false
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      set({
        dashboardData: null,
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
