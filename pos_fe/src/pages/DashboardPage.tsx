import { useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, 
  ShoppingBag, 
  AlertTriangle, 
  Package, 
  IndianRupee,
  Users,
  BarChart3,
  PieChart,
  Activity,
  Calendar,
  Target,
  Zap,
  Download,
  ChevronDown
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import axiosInstance from '../utils/axiosInstance';
import { useDashboardStore } from '../stores/dashboardStore';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  Title, 
  Tooltip, 
  Legend,
  ArcElement,
  LineElement,
  PointElement,
  Filler
} from 'chart.js';
import { Bar, Doughnut, Line, Pie } from 'react-chartjs-2';
import { useAuthStore } from '../stores/authStore';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
);

const DashboardCard = ({ 
  title, 
  value, 
  icon, 
  iconBgColor, 
  trend,
  subtitle
}: { 
  title: string; 
  value: string; 
  icon: React.ReactNode;
  iconBgColor: string;
  trend?: { value: string; isPositive: boolean };
  subtitle?: string;
}) => {
  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow animate-fade-in border border-gray-100 dark:border-gray-700">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{title}</h3>
          <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
          )}
          {trend && (
            <div className={`flex items-center mt-2 ${trend.isPositive ? 'text-success-700 dark:text-success-500' : 'text-error-700 dark:text-error-500'}`}>
              <TrendingUp size={14} className={`mr-1 ${!trend.isPositive ? 'rotate-180' : ''}`} />
              <span className="text-xs font-medium">{trend.value}</span>
            </div>
          )}
        </div>
        <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${iconBgColor} shadow-sm`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

const DashboardPage = () => {
  const navigate = useNavigate();
  const { dashboardData, isLoading, loadDashboardData, selectedTimeRange, setTimeRange } = useDashboardStore();
  const { settings, user } = useAuthStore();
  const isDarkMode = settings.general.theme === 'dark';
  const [selectedDashboard, setSelectedDashboard] = useState('overview');
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const dashboardContentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleDownloadStoreExcel = async () => {
    setIsExporting(true);
    setDownloadOpen(false);
    try {
      const res = await axiosInstance.get('/api/reports/dashboard/export-bootstrap/', {
        responseType: 'blob',
      });
      const blob = new Blob(
        [res.data],
        { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
      );
      const fileUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateTag = new Date().toISOString().slice(0, 10);
      a.href = fileUrl;
      a.download = `store_bootstrap_live_${dateTag}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(fileUrl);
    } catch (err) {
      console.error('Failed to download store excel export', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadDashboardSnapshot = async () => {
    setIsExporting(true);
    setDownloadOpen(false);
    try {
      if (!dashboardContentRef.current) return;
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const imgWidth = pageWidth - margin * 2;
      const sectionY = 16;
      const tabDefs = [
        { id: 'overview', title: 'Overview' },
        { id: 'sales', title: 'Sales Analytics' },
        { id: 'inventory', title: 'Inventory' },
        { id: 'customers', title: 'Customers' },
        { id: 'performance', title: 'Performance' },
        { id: 'trends', title: 'Trends' },
      ];
      const previousTab = selectedDashboard;
      let firstSection = true;

      const waitForTabPaint = async (tabId: string) => {
        const start = Date.now();
        while (Date.now() - start < 2200) {
          const root = dashboardContentRef.current;
          const active = root?.getAttribute('data-active-tab') === tabId;
          if (active) {
            await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            await new Promise((resolve) => setTimeout(resolve, 220));
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, 70));
        }
      };

      const addCanvasPages = (canvas: HTMLCanvasElement, title: string) => {
        const imgData = canvas.toDataURL('image/png');
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        const firstPageUsable = pageHeight - sectionY - margin;
        const continuationUsable = pageHeight - margin * 2;

        let heightLeft = imgHeight;
        let yPos = sectionY;

        if (!firstSection) {
          pdf.addPage();
        }
        firstSection = false;
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(20, 20, 20);
        pdf.setFontSize(11);
        pdf.text(`Analytics Dashboard - ${title}`, margin, 10);
        pdf.addImage(imgData, 'PNG', margin, yPos, imgWidth, imgHeight);
        heightLeft -= firstPageUsable;

        while (heightLeft > 0) {
          pdf.addPage();
          yPos = margin - (imgHeight - heightLeft);
          pdf.addImage(imgData, 'PNG', margin, yPos, imgWidth, imgHeight);
          heightLeft -= continuationUsable;
        }
      };

      for (const tab of tabDefs) {
        flushSync(() => {
          setSelectedDashboard(tab.id);
        });
        await waitForTabPaint(tab.id);
        if (!dashboardContentRef.current) continue;

        window.scrollTo({ top: 0, behavior: 'auto' });

        const canvas = await html2canvas(dashboardContentRef.current, {
          scale: Math.min(2, Math.max(1.4, window.devicePixelRatio || 1.6)),
          useCORS: true,
          backgroundColor: null,
          scrollY: -window.scrollY,
          logging: false,
        });
        addCanvasPages(canvas, tab.title);
      }

      flushSync(() => {
        setSelectedDashboard(previousTab);
      });

      const dateTag = new Date().toISOString().slice(0, 10);
      pdf.save(`dashboard_snapshot_all_tabs_${dateTag}.pdf`);
    } catch (err) {
      console.error('Failed to export dashboard snapshot PDF', err);
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading || !dashboardData) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="h-16 w-16 mx-auto bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center text-primary-600 dark:text-primary-400 mb-4">
            <ShoppingBag size={32} />
          </div>
          <p className="text-gray-600 dark:text-gray-400">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  const dashboardTabs = [
    { id: 'overview', name: 'Overview', icon: <BarChart3 size={18} /> },
    { id: 'sales', name: 'Sales Analytics', icon: <IndianRupee size={18} /> },
    { id: 'inventory', name: 'Inventory', icon: <Package size={18} /> },
    { id: 'customers', name: 'Customers', icon: <Users size={18} /> },
    { id: 'performance', name: 'Performance', icon: <Activity size={18} /> },
    { id: 'trends', name: 'Trends', icon: <TrendingUp size={18} /> }
  ];

  // Chart options with dark mode support
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'bottom' as const,
        labels: {
          color: isDarkMode ? '#D1D5DB' : '#374151',
          usePointStyle: true,
          padding: 20,
        },
      },
      tooltip: {
        backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
        titleColor: isDarkMode ? '#F9FAFB' : '#111827',
        bodyColor: isDarkMode ? '#D1D5DB' : '#374151',
        borderColor: isDarkMode ? '#374151' : '#E5E7EB',
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        grid: {
          color: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        },
        ticks: {
          color: isDarkMode ? '#D1D5DB' : '#374151',
        },
      },
      y: {
        grid: {
          color: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        },
        ticks: {
          color: isDarkMode ? '#D1D5DB' : '#374151',
        },
      },
    },
  };

  const salesTrendRows = (dashboardData as any).salesTrend || [];
  const salesTrendData = {
    labels: salesTrendRows.map((row: any) => row.period),
    datasets: [
      {
        label: 'Sales',
        data: salesTrendRows.map((row: any) => row.value),
        borderColor: isDarkMode ? 'rgba(96, 165, 250, 1)' : 'rgba(59, 130, 246, 1)',
        backgroundColor: isDarkMode ? 'rgba(96, 165, 250, 0.1)' : 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const categoryRows = (dashboardData as any).categoryPerformance || [];
  const categoryPerformanceData = {
    labels: categoryRows.map((row: any) => row.category),
    datasets: [
      {
        data: categoryRows.map((row: any) => row.sales),
        backgroundColor: [
          isDarkMode ? 'rgba(96, 165, 250, 0.8)' : 'rgba(59, 130, 246, 0.8)',
          isDarkMode ? 'rgba(34, 197, 94, 0.8)' : 'rgba(34, 197, 94, 0.8)',
          isDarkMode ? 'rgba(251, 191, 36, 0.8)' : 'rgba(251, 191, 36, 0.8)',
          isDarkMode ? 'rgba(239, 68, 68, 0.8)' : 'rgba(239, 68, 68, 0.8)',
          isDarkMode ? 'rgba(168, 85, 247, 0.8)' : 'rgba(168, 85, 247, 0.8)',
        ],
        borderWidth: 0,
      },
    ],
  };

  const hourlyRows = (dashboardData as any).hourlyTraffic || [];
  const hourlyTrafficData = {
    labels: hourlyRows.map((row: any) => row.label),
    datasets: [
      {
        label: 'Customers',
        data: hourlyRows.map((row: any) => row.customers),
        backgroundColor: isDarkMode ? 'rgba(34, 197, 94, 0.8)' : 'rgba(34, 197, 94, 0.8)',
        borderColor: isDarkMode ? 'rgba(34, 197, 94, 1)' : 'rgba(34, 197, 94, 1)',
        borderWidth: 2,
        borderRadius: 8,
      },
    ],
  };

  const inventoryStatus = (dashboardData as any).inventoryStatus || {};
  const inventoryStatusData = {
    labels: ['In Stock', 'Low Stock', 'Out of Stock', 'Overstocked'],
    datasets: [
      {
        data: [
          inventoryStatus.inStock ?? 65,
          inventoryStatus.lowStock ?? 20,
          inventoryStatus.outOfStock ?? 8,
          inventoryStatus.overstocked ?? 7
        ],
        backgroundColor: [
          isDarkMode ? 'rgba(34, 197, 94, 0.8)' : 'rgba(34, 197, 94, 0.8)',
          isDarkMode ? 'rgba(251, 191, 36, 0.8)' : 'rgba(251, 191, 36, 0.8)',
          isDarkMode ? 'rgba(239, 68, 68, 0.8)' : 'rgba(239, 68, 68, 0.8)',
          isDarkMode ? 'rgba(96, 165, 250, 0.8)' : 'rgba(59, 130, 246, 0.8)',
        ],
        borderWidth: 0,
      },
    ],
  };

  const growthRate = Number((dashboardData as any).trendMetrics?.growthRate || 0);
  const growthTrend = {
    value: `${growthRate >= 0 ? '+' : ''}${growthRate.toFixed(1)}% vs previous period`,
    isPositive: growthRate >= 0,
  };
  const performance = (dashboardData as any).performance || {};
  const customerSummary = (dashboardData as any).customerSummary || {};
  const customerTotal = Number(customerSummary.totalCustomers || 0);
  const customerNew = Number(customerSummary.newCustomers || 0);
  const customerActive = Number(customerSummary.activeCustomers || 0);
  const customerInactive = Math.max(0, customerTotal - customerActive);
  const customerVip = Math.min(customerTotal, Math.max(0, Math.round(customerTotal * 0.1)));
  const customerRegular = Math.max(0, customerActive - customerVip);

  const performanceBars = [
    { label: 'Daily Target', value: Math.max(0, Math.min(100, Number(performance.dailyTarget || 0))), color: 'bg-green-500' },
    { label: 'Monthly Target', value: Math.max(0, Math.min(100, Number(performance.monthlyTarget || 0))), color: 'bg-blue-500' },
    { label: 'Profit Margin', value: Math.max(0, Math.min(100, Number(performance.profitMargin || 0))), color: 'bg-purple-500' },
    { label: 'Efficiency Score', value: Math.max(0, Math.min(100, Number(performance.efficiencyScore || 0))), color: 'bg-orange-500' },
  ];
  const totalInventoryItems = Number(dashboardData.inventorySummary?.totalItems || 0);
  const showInitialUploadBanner = user?.role === 'admin' && totalInventoryItems === 0;

  const renderOverviewDashboard = () => (
    <div ref={dashboardContentRef} data-dashboard-capture="true" data-active-tab={selectedDashboard} className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <DashboardCard 
          title="Today's Sales" 
          value={`₹${(dashboardData.salesSummary?.today || 0).toLocaleString('en-IN')}`} 
          icon={<IndianRupee size={24} className="text-white" />}
          iconBgColor="bg-gradient-to-br from-primary-500 to-primary-600"
          trend={{ value: "+5.2% from yesterday", isPositive: true }}
          subtitle="Daily revenue"
        />
        <DashboardCard 
          title="Monthly Sales" 
          value={`₹${(dashboardData.salesSummary?.thisMonth || 0).toLocaleString('en-IN')}`} 
          icon={<ShoppingBag size={24} className="text-white" />}
          iconBgColor="bg-gradient-to-br from-secondary-500 to-secondary-600"
          trend={growthTrend}
          subtitle="Monthly revenue"
        />
        <DashboardCard 
          title="Total Products" 
          value={(dashboardData.inventorySummary?.totalItems || 0).toString()} 
          icon={<Package size={24} className="text-white" />}
          iconBgColor="bg-gradient-to-br from-accent-500 to-accent-600"
          subtitle="In inventory"
        />
        <DashboardCard 
          title="Active Customers" 
          value={((dashboardData as any).customerSummary?.activeCustomers || 0).toString()} 
          icon={<Users size={24} className="text-white" />}
          iconBgColor="bg-gradient-to-br from-purple-500 to-purple-600"
          trend={growthTrend}
          subtitle="Registered users"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Sales Trend</h2>
          <div className="h-64">
            {salesTrendRows.length ? (
              <Line data={salesTrendData} options={chartOptions} />
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">No sales trend data</div>
            )}
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Category Performance</h2>
          <div className="h-64">
            {categoryRows.length ? (
              <Doughnut data={categoryPerformanceData} options={{...chartOptions, cutout: '60%'}} />
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">No category data</div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="p-6 border-b dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Recent Transactions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Bill #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {!(dashboardData.recentSales || []).length && (
                <tr>
                  <td colSpan={5} className="px-6 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                    No recent transactions for selected range.
                  </td>
                </tr>
              )}
              {(dashboardData.recentSales || []).map((sale) => (
                <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                    {sale.billNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {sale.customerName || 'Walk-in Customer'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {new Date(sale.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                    ₹{sale.total.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-success-100 dark:bg-success-900/50 text-success-700 dark:text-success-400">
                      Completed
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderSalesDashboard = () => (
    <div className="space-y-6">
      {/* Sales KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <DashboardCard 
          title="Total Revenue" 
          value={`₹${((dashboardData.salesSummary?.thisMonth || 0) as number).toLocaleString('en-IN')}`} 
          icon={<IndianRupee size={24} className="text-white" />}
          iconBgColor="bg-gradient-to-br from-green-500 to-green-600"
          trend={growthTrend}
        />
        <DashboardCard 
          title="Average Order Value" 
          value={`₹${Number((dashboardData as any).performance?.averageOrderValue || 0).toLocaleString('en-IN')}`} 
          icon={<Target size={24} className="text-white" />}
          iconBgColor="bg-gradient-to-br from-blue-500 to-blue-600"
          trend={{ value: "+8.2% vs last month", isPositive: true }}
        />
        <DashboardCard 
          title="Total Orders" 
          value={Number((dashboardData as any).performance?.totalOrders || 0).toString()} 
          icon={<ShoppingBag size={24} className="text-white" />}
          iconBgColor="bg-gradient-to-br from-purple-500 to-purple-600"
          trend={growthTrend}
        />
        <DashboardCard 
          title="Conversion Rate" 
          value={`${Number((dashboardData as any).trendMetrics?.growthRate || 0).toFixed(1)}%`} 
          icon={<Zap size={24} className="text-white" />}
          iconBgColor="bg-gradient-to-br from-orange-500 to-orange-600"
          trend={growthTrend}
        />
      </div>

      {/* Sales Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Revenue Trend</h2>
          <div className="h-80">
            {salesTrendRows.length ? (
              <Line data={salesTrendData} options={chartOptions} />
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">No revenue trend data</div>
            )}
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Hourly Traffic</h2>
          <div className="h-80">
            {hourlyRows.length ? (
              <Bar data={hourlyTrafficData} options={chartOptions} />
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">No hourly traffic data</div>
            )}
          </div>
        </div>
      </div>

      {/* Top Products */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Top Selling Products</h2>
        <div className="space-y-4">
          {!(dashboardData.topProducts || []).length && (
            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg text-sm text-gray-500 dark:text-gray-400">
              No top product data for selected range.
            </div>
          )}
          {(dashboardData.topProducts || []).map((product, index) => (
            <div key={index} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <div className="flex items-center">
                <div className="h-10 w-10 bg-primary-100 dark:bg-primary-900 rounded-lg flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold mr-4">
                  {index + 1}
                </div>
                <div>
                  <p className="font-medium text-gray-800 dark:text-gray-100">{product.productName}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{product.quantity} units sold</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-gray-800 dark:text-gray-100">₹{product.amount.toLocaleString('en-IN')}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Revenue</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderInventoryDashboard = () => (
    <div className="space-y-6">
      {/* Inventory KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <DashboardCard 
          title="Total Items" 
          value={(dashboardData.inventorySummary?.totalItems || 0).toString()} 
          icon={<Package size={24} className="text-white" />}
          iconBgColor="bg-gradient-to-br from-blue-500 to-blue-600"
        />
        <DashboardCard 
          title="Low Stock Items" 
          value={(dashboardData.inventorySummary?.lowStock || 0).toString()} 
          icon={<AlertTriangle size={24} className="text-white" />}
          iconBgColor="bg-gradient-to-br from-yellow-500 to-yellow-600"
        />
        <DashboardCard 
          title="Out of Stock" 
          value={(dashboardData.inventorySummary?.outOfStock || 0).toString()} 
          icon={<AlertTriangle size={24} className="text-white" />}
          iconBgColor="bg-gradient-to-br from-red-500 to-red-600"
        />
        <DashboardCard 
          title="Inventory Value" 
          value={`₹${Number((dashboardData as any).inventorySummary?.inventoryValue || 0).toLocaleString('en-IN')}`} 
          icon={<IndianRupee size={24} className="text-white" />}
          iconBgColor="bg-gradient-to-br from-green-500 to-green-600"
        />
      </div>

      {/* Inventory Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Inventory Status</h2>
          <div className="h-80">
            {Number((dashboardData.inventorySummary?.totalItems || 0)) > 0 ? (
              <Pie data={inventoryStatusData} options={chartOptions} />
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">No inventory data</div>
            )}
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Category Distribution</h2>
          <div className="h-80">
            {categoryRows.length ? (
              <Doughnut data={categoryPerformanceData} options={{...chartOptions, cutout: '50%'}} />
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">No category distribution data</div>
            )}
          </div>
        </div>
      </div>

      {/* Stock Alerts */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Stock Alerts</h2>
        <div className="space-y-3">
          {!((dashboardData as any).stockAlerts || []).length && (
            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg text-sm text-gray-500 dark:text-gray-400">
              No stock alerts for selected range.
            </div>
          )}
          {((dashboardData as any).stockAlerts || []).slice(0, 6).map((alert: any, idx: number) => {
            const isOut = alert.status === 'out_of_stock';
            return (
              <div
                key={`${alert.productName}-${idx}`}
                className={`flex items-center justify-between p-4 rounded-lg border ${
                  isOut
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                    : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                }`}
              >
                <div className="flex items-center">
                  <AlertTriangle
                    size={20}
                    className={isOut ? 'text-red-600 dark:text-red-400 mr-3' : 'text-yellow-600 dark:text-yellow-400 mr-3'}
                  />
                  <div>
                    <p className={isOut ? 'font-medium text-red-800 dark:text-red-200' : 'font-medium text-yellow-800 dark:text-yellow-200'}>
                      {alert.productName}
                    </p>
                    <p className={isOut ? 'text-sm text-red-600 dark:text-red-400' : 'text-sm text-yellow-600 dark:text-yellow-400'}>
                      {isOut ? 'Out of stock' : `Low stock: ${alert.quantity} remaining`}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderCustomersDashboard = () => (
    <div className="space-y-6">
      {/* Customer KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <DashboardCard 
          title="Total Customers" 
          value={Number((dashboardData as any).customerSummary?.totalCustomers || 0).toString()} 
          icon={<Users size={24} className="text-white" />}
          iconBgColor="bg-gradient-to-br from-purple-500 to-purple-600"
          trend={growthTrend}
        />
        <DashboardCard 
          title="New Customers" 
          value={Number((dashboardData as any).customerSummary?.newCustomers || 0).toString()} 
          icon={<Users size={24} className="text-white" />}
          iconBgColor="bg-gradient-to-br from-green-500 to-green-600"
          trend={growthTrend}
        />
        <DashboardCard 
          title="Returning Customers" 
          value={Number((dashboardData as any).customerSummary?.activeCustomers || 0).toString()} 
          icon={<Users size={24} className="text-white" />}
          iconBgColor="bg-gradient-to-br from-blue-500 to-blue-600"
          trend={growthTrend}
        />
        <DashboardCard 
          title="Customer Lifetime Value" 
          value={`₹${Number((dashboardData as any).customerSummary?.customerLifetimeValue || 0).toLocaleString('en-IN')}`} 
          icon={<IndianRupee size={24} className="text-white" />}
          iconBgColor="bg-gradient-to-br from-orange-500 to-orange-600"
          trend={growthTrend}
        />
      </div>

      {/* Customer Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Customer Acquisition</h2>
          <div className="h-80">
            {salesTrendRows.length ? (
              <Line data={salesTrendData} options={chartOptions} />
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">No customer trend data</div>
            )}
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Customer Segments</h2>
          <div className="h-80">
            <Doughnut data={{
              labels: ['VIP', 'Regular', 'New', 'Inactive'],
              datasets: [{
                data: [customerVip, customerRegular, customerNew, customerInactive],
                backgroundColor: [
                  'rgba(251, 191, 36, 0.8)',
                  'rgba(34, 197, 94, 0.8)',
                  'rgba(59, 130, 246, 0.8)',
                  'rgba(156, 163, 175, 0.8)',
                ],
              }]
            }} options={{...chartOptions, cutout: '60%'}} />
          </div>
        </div>
      </div>

      {/* Top Customers */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Top Customers</h2>
        <div className="space-y-4">
          {!((dashboardData as any).topCustomers || []).length && (
            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg text-sm text-gray-500 dark:text-gray-400">
              No top customer data for selected range.
            </div>
          )}
          {((dashboardData as any).topCustomers || []).slice(0, 10).map((customer: any, index: number) => (
            <div key={index} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <div className="flex items-center">
                <div className="h-10 w-10 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold mr-4">
                  {(customer.name || '?').charAt(0)}
                </div>
                <div>
                  <p className="font-medium text-gray-800 dark:text-gray-100">{customer.name || 'Unnamed Customer'}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{Number(customer.purchases || 0)} purchases</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-gray-800 dark:text-gray-100">₹{Number(customer.amount || 0).toLocaleString('en-IN')}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderPerformanceDashboard = () => (
    <div className="space-y-6">
      {/* Performance KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <DashboardCard 
          title="Daily Target" 
          value={`${Number((dashboardData as any).performance?.dailyTarget || 0).toFixed(0)}%`} 
          icon={<Target size={24} className="text-white" />}
          iconBgColor="bg-gradient-to-br from-green-500 to-green-600"
          trend={growthTrend}
        />
        <DashboardCard 
          title="Monthly Target" 
          value={`${Number((dashboardData as any).performance?.monthlyTarget || 0).toFixed(0)}%`} 
          icon={<Target size={24} className="text-white" />}
          iconBgColor="bg-gradient-to-br from-blue-500 to-blue-600"
          trend={growthTrend}
        />
        <DashboardCard 
          title="Profit Margin" 
          value={`${Number((dashboardData as any).performance?.profitMargin || 0).toFixed(1)}%`} 
          icon={<TrendingUp size={24} className="text-white" />}
          iconBgColor="bg-gradient-to-br from-purple-500 to-purple-600"
          trend={growthTrend}
        />
        <DashboardCard 
          title="Efficiency Score" 
          value={`${Number((dashboardData as any).performance?.efficiencyScore || 0).toFixed(0)}%`} 
          icon={<Activity size={24} className="text-white" />}
          iconBgColor="bg-gradient-to-br from-orange-500 to-orange-600"
          trend={growthTrend}
        />
      </div>

      {/* Performance Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Target vs Achievement</h2>
          <div className="h-80">
            <Bar data={{
              labels: performanceBars.map((row) => row.label),
              datasets: [
                {
                  label: 'Target',
                  data: performanceBars.map(() => 100),
                  backgroundColor: 'rgba(156, 163, 175, 0.5)',
                },
                {
                  label: 'Achievement',
                  data: performanceBars.map((row) => row.value),
                  backgroundColor: 'rgba(34, 197, 94, 0.8)',
                },
              ],
            }} options={chartOptions} />
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Performance Metrics</h2>
          <div className="space-y-6">
            {performanceBars.map((row) => (
              <div key={row.label}>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{row.label}</span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">{row.value.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div className={`${row.color} h-2 rounded-full`} style={{ width: `${row.value}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderTrendsDashboard = () => (
    <div className="space-y-6">
      {/* Trend KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <DashboardCard 
          title="Growth Rate" 
          value={`${Number((dashboardData as any).trendMetrics?.growthRate || 0).toFixed(1)}%`} 
          icon={<TrendingUp size={24} className="text-white" />}
          iconBgColor="bg-gradient-to-br from-green-500 to-green-600"
          trend={growthTrend}
        />
        <DashboardCard 
          title="Market Share" 
          value={`${Number((dashboardData as any).trendMetrics?.marketShare || 0).toFixed(1)}%`} 
          icon={<PieChart size={24} className="text-white" />}
          iconBgColor="bg-gradient-to-br from-blue-500 to-blue-600"
          trend={growthTrend}
        />
        <DashboardCard 
          title="Seasonal Index" 
          value={`${Number((dashboardData as any).trendMetrics?.seasonalIndex || 0).toFixed(2)}`} 
          icon={<Calendar size={24} className="text-white" />}
          iconBgColor="bg-gradient-to-br from-purple-500 to-purple-600"
          trend={growthTrend}
        />
        <DashboardCard 
          title="Forecast Accuracy" 
          value={`${Number((dashboardData as any).trendMetrics?.forecastAccuracy || 0).toFixed(1)}%`} 
          icon={<Activity size={24} className="text-white" />}
          iconBgColor="bg-gradient-to-br from-orange-500 to-orange-600"
          trend={growthTrend}
        />
      </div>

      {/* Trend Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Yearly Growth Trend</h2>
          <div className="h-80">
            {salesTrendRows.length ? (
              <Line data={salesTrendData} options={chartOptions} />
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">No growth trend data</div>
            )}
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Seasonal Patterns</h2>
          <div className="h-80">
            {hourlyRows.length ? (
              <Bar data={hourlyTrafficData} options={chartOptions} />
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">No seasonal pattern data</div>
            )}
          </div>
        </div>
      </div>

      {/* Trend Insights */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Key Insights</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center mb-2">
              <TrendingUp size={20} className="text-green-600 dark:text-green-400 mr-2" />
              <h3 className="font-medium text-green-800 dark:text-green-200">Strong Growth</h3>
            </div>
            <p className="text-sm text-green-700 dark:text-green-300">
              Growth rate is {Number((dashboardData as any).trendMetrics?.growthRate || 0).toFixed(1)}% for selected range
            </p>
          </div>
          
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center mb-2">
              <Calendar size={20} className="text-blue-600 dark:text-blue-400 mr-2" />
              <h3 className="font-medium text-blue-800 dark:text-blue-200">Seasonal Peak</h3>
            </div>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Forecast accuracy is {Number((dashboardData as any).trendMetrics?.forecastAccuracy || 0).toFixed(1)}%
            </p>
          </div>
          
          <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
            <div className="flex items-center mb-2">
              <Target size={20} className="text-purple-600 dark:text-purple-400 mr-2" />
              <h3 className="font-medium text-purple-800 dark:text-purple-200">Market Expansion</h3>
            </div>
            <p className="text-sm text-purple-700 dark:text-purple-300">
              Active customers: {Number((dashboardData as any).customerSummary?.activeCustomers || 0).toLocaleString('en-IN')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderDashboardContent = () => {
    switch (selectedDashboard) {
      case 'overview': return renderOverviewDashboard();
      case 'sales': return renderSalesDashboard();
      case 'inventory': return renderInventoryDashboard();
      case 'customers': return renderCustomersDashboard();
      case 'performance': return renderPerformanceDashboard();
      case 'trends': return renderTrendsDashboard();
      default: return renderOverviewDashboard();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Analytics Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400">Comprehensive business insights and metrics</p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            Range: {(dashboardData as any)?.meta?.allTime
              ? 'All time'
              : `${(dashboardData as any)?.meta?.startDate || '-'} to ${(dashboardData as any)?.meta?.endDate || '-'}`}
          </p>
        </div>
        
        <div className="mt-4 sm:mt-0 flex items-center gap-2">
          <select
            value={selectedTimeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
          >
            <option value="alltime">All time</option>
            <option value="last30days">Last 30 days</option>
            <option value="last7days">Last 7 days</option>
            <option value="last90days">Last 90 days</option>
            <option value="thisyear">This year</option>
          </select>

          <div className="relative">
            <button
              onClick={() => setDownloadOpen((v) => !v)}
              disabled={isExporting}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-60"
            >
              <Download size={16} />
              {isExporting ? 'Preparing...' : 'Download'}
              <ChevronDown size={14} />
            </button>

            {downloadOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-30">
                <button
                  onClick={handleDownloadStoreExcel}
                  className="w-full text-left px-4 py-3 text-sm text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-t-lg"
                >
                  Download Store Data (Excel)
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Live DB export in bootstrap structure</div>
                </button>
                <button
                  onClick={handleDownloadDashboardSnapshot}
                  className="w-full text-left px-4 py-3 text-sm text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-b-lg border-t border-gray-100 dark:border-gray-700"
                >
                  Download Dashboard Snapshot (PDF)
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Shareable PDF of current dashboard view</div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showInitialUploadBanner && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
              Complete Initial Data Upload
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              No products found for this store. Upload the bootstrap Excel to start billing.
            </p>
          </div>
          <button
            onClick={() => navigate('/initial-upload')}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
          >
            Go to Initial Upload
          </button>
        </div>
      )}

      {/* Dashboard Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {dashboardTabs.map((tab) => (
            <button
              key={tab.id}
              data-dashboard-tab={tab.id}
              onClick={() => setSelectedDashboard(tab.id)}
              className={`flex items-center whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                selectedDashboard === tab.id
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {tab.icon}
              <span className="ml-2">{tab.name}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Dashboard Content */}
      {renderDashboardContent()}
    </div>
  );
};

export default DashboardPage;
