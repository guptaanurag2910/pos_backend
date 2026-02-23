import { create } from 'zustand';
import { DashboardData } from '../types';
import { mockDashboardData } from '../data/mockData';

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
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Enhanced dashboard data with additional metrics
      const enhancedData = {
        ...mockDashboardData,
        advancedMetrics: {
          growthRate: 15.3,
          customerRetention: 68.5,
          averageOrderValue: 1250,
          conversionRate: 4.2,
          profitMargin: 24.5,
          inventoryTurnover: 6.8,
          customerLifetimeValue: 4250,
          seasonalIndex: 1.25,
          marketShare: 12.8,
          forecastAccuracy: 94.2
        },
        trends: {
          salesGrowth: [
            { period: 'Jan', value: 65000, growth: 5.2 },
            { period: 'Feb', value: 78000, growth: 8.1 },
            { period: 'Mar', value: 85000, growth: 12.3 },
            { period: 'Apr', value: 92000, growth: 15.8 },
            { period: 'May', value: 88000, growth: 11.2 },
            { period: 'Jun', value: 95000, growth: 18.5 }
          ],
          customerAcquisition: [
            { period: 'Week 1', new: 45, returning: 123 },
            { period: 'Week 2', new: 52, returning: 145 },
            { period: 'Week 3', new: 38, returning: 167 },
            { period: 'Week 4', new: 61, returning: 189 }
          ],
          categoryPerformance: [
            { category: 'Electronics', sales: 35, growth: 12.5 },
            { category: 'Clothing', sales: 25, growth: 8.2 },
            { category: 'Food', sales: 20, growth: 15.1 },
            { category: 'Books', sales: 12, growth: -2.3 },
            { category: 'Home', sales: 8, growth: 22.7 }
          ]
        },
        forecasts: {
          nextMonthSales: 105000,
          expectedGrowth: 18.2,
          riskFactors: ['Seasonal decline', 'Supply chain issues'],
          opportunities: ['New product launch', 'Market expansion']
        }
      };
      
      set({ 
        dashboardData: enhancedData, 
        isLoading: false 
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      set({ isLoading: false });
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