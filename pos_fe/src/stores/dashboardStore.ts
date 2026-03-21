import { create } from 'zustand';
import { DashboardData } from '../types';
import { fetchDashboard } from '../service/reportService';

interface DashboardStore {
  dashboardData: DashboardData | null;
  isLoading: boolean;
  selectedTimeRange: string;
  customStartDate: string;
  customEndDate: string;
  loadDashboardData: () => Promise<void>;
  setTimeRange: (range: string) => void;
  setCustomDateRange: (startDate: string, endDate: string) => void;
  getAdvancedMetrics: () => any;
}

export const useDashboardStore = create<DashboardStore>((set, get) => ({
  dashboardData: null,
  isLoading: false,
  selectedTimeRange: 'last30days',
  customStartDate: '',
  customEndDate: '',
  
  loadDashboardData: async () => {
    try {
      set({ isLoading: true });

      const selectedTimeRange = get().selectedTimeRange;
      const state = get();
      const today = new Date();
      const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const daysAgoIso = (days: number) => {
        const d = new Date(today);
        d.setDate(today.getDate() - days);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      };
      const thisYearStartIso = `${today.getFullYear()}-01-01`;
      const params =
        selectedTimeRange === 'alltime'
          ? { all_time: true }
          : selectedTimeRange === 'today'
            ? { start_date: todayIso, end_date: todayIso }
            : selectedTimeRange === 'custom' && state.customStartDate && state.customEndDate
              ? { start_date: state.customStartDate, end_date: state.customEndDate }
              : selectedTimeRange === 'last7days'
                ? { start_date: daysAgoIso(6), end_date: todayIso }
                : selectedTimeRange === 'last30days'
                  ? { start_date: daysAgoIso(29), end_date: todayIso }
                  : selectedTimeRange === 'last90days'
                    ? { start_date: daysAgoIso(89), end_date: todayIso }
                    : selectedTimeRange === 'thisyear'
                      ? { start_date: thisYearStartIso, end_date: todayIso }
                      : { start_date: daysAgoIso(29), end_date: todayIso };

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
    if (range === 'custom') {
      const state = get();
      if (!(state.customStartDate && state.customEndDate)) {
        return;
      }
    }
    get().loadDashboardData();
  },

  setCustomDateRange: (startDate: string, endDate: string) => {
    set({
      selectedTimeRange: 'custom',
      customStartDate: startDate,
      customEndDate: endDate,
    });
    get().loadDashboardData();
  },

  getAdvancedMetrics: () => {
    const { dashboardData } = get();
    return dashboardData?.advancedMetrics || {};
  }
}));
