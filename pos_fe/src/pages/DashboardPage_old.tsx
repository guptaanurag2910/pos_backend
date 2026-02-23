import { useEffect } from 'react';
import { 
  TrendingUp, 
  ShoppingBag, 
  AlertTriangle, 
  Package, 
  DollarSign,
} from 'lucide-react';
import { useDashboardStore } from '../stores/dashboardStore';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  Title, 
  Tooltip, 
  Legend,
  ArcElement
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { useAuthStore } from '../stores/authStore';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const DashboardCard = ({ 
  title, 
  value, 
  icon, 
  iconBgColor, 
  trend
}: { 
  title: string; 
  value: string; 
  icon: React.ReactNode;
  iconBgColor: string;
  trend?: { value: string; isPositive: boolean };
}) => {
  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm animate-fade-in">
      <div className="flex justify-between">
        <div>
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</h3>
          <p className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mt-1">{value}</p>
          {trend && (
            <div className={`flex items-center mt-2 ${trend.isPositive ? 'text-success-700 dark:text-success-500' : 'text-error-700 dark:text-error-500'}`}>
              <TrendingUp size={16} className="mr-1" />
              <span className="text-xs font-medium">{trend.value}</span>
            </div>
          )}
        </div>
        <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${iconBgColor}`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

const DashboardPage = () => {
  const { dashboardData, isLoading, loadDashboardData } = useDashboardStore();
  const { settings } = useAuthStore();
  const isDarkMode = settings.general.theme === 'dark';

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

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

  // Chart options with dark mode support
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
        labels: {
          color: isDarkMode ? '#D1D5DB' : '#374151',
        },
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

  // Only prepare chart data after confirming dashboardData exists
  const salesChartData = {
    labels: (dashboardData.topProducts || []).map(p => p.productName),
    datasets: [
      {
        label: 'Sales Amount',
        data: (dashboardData.topProducts || []).map(p => p.amount),
        backgroundColor: isDarkMode ? 'rgba(96, 165, 250, 0.7)' : 'rgba(59, 130, 246, 0.7)',
        borderColor: isDarkMode ? 'rgba(96, 165, 250, 1)' : 'rgba(59, 130, 246, 1)',
        borderWidth: 1,
      },
    ],
  };

  const inventoryChartData = {
    labels: ['In Stock', 'Low Stock', 'Out of Stock'],
    datasets: [
      {
        data: [
          (dashboardData.inventorySummary?.totalItems || 0) - 
          (dashboardData.inventorySummary?.lowStock || 0) - 
          (dashboardData.inventorySummary?.outOfStock || 0),
          dashboardData.inventorySummary?.lowStock || 0,
          dashboardData.inventorySummary?.outOfStock || 0,
        ],
        backgroundColor: isDarkMode ? [
          'rgba(20, 184, 166, 0.8)',
          'rgba(234, 179, 8, 0.8)',
          'rgba(239, 68, 68, 0.8)',
        ] : [
          'rgba(20, 184, 166, 0.7)',
          'rgba(234, 179, 8, 0.7)',
          'rgba(239, 68, 68, 0.7)',
        ],
        borderColor: isDarkMode ? [
          'rgba(20, 184, 166, 1)',
          'rgba(234, 179, 8, 1)',
          'rgba(239, 68, 68, 1)',
        ] : [
          'rgba(20, 184, 166, 1)',
          'rgba(234, 179, 8, 1)',
          'rgba(239, 68, 68, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400">Welcome to your store overview</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardCard 
          title="Today's Sales" 
          value={`₹${(dashboardData.salesSummary?.today || 0).toLocaleString('en-IN')}`} 
          icon={<DollarSign size={24} className="text-white" />}
          iconBgColor="bg-primary-600 dark:bg-primary-500"
          trend={{ value: "+5.2% from yesterday", isPositive: true }}
        />
        <DashboardCard 
          title="Monthly Sales" 
          value={`₹${(dashboardData.salesSummary?.thisMonth || 0).toLocaleString('en-IN')}`} 
          icon={<ShoppingBag size={24} className="text-white" />}
          iconBgColor="bg-secondary-600 dark:bg-secondary-500"
          trend={{ value: "+12.5% from last month", isPositive: true }}
        />
        <DashboardCard 
          title="Total Products" 
          value={(dashboardData.inventorySummary?.totalItems || 0).toString()} 
          icon={<Package size={24} className="text-white" />}
          iconBgColor="bg-accent-600 dark:bg-accent-500"
        />
        <DashboardCard 
          title="Low Stock Items" 
          value={(dashboardData.inventorySummary?.lowStock || 0).toString()} 
          icon={<AlertTriangle size={24} className="text-white" />}
          iconBgColor="bg-warning-500 dark:bg-warning-600"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Top Selling Products</h2>
          <div className="h-64">
            <Bar 
              data={salesChartData} 
              options={chartOptions}
            />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Inventory Status</h2>
          <div className="h-64 flex items-center justify-center">
            <Doughnut 
              data={inventoryChartData} 
              options={{
                ...chartOptions,
                cutout: '70%',
              }}
            />
          </div>
        </div>
      </div>

      {/* Recent Sales */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
        <div className="p-6 border-b dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Recent Transactions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Bill #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Payment
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    <span className="capitalize">{sale.paymentMethod}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      sale.status === 'completed' 
                        ? 'bg-success-100 dark:bg-success-900/50 text-success-700 dark:text-success-400' 
                        : 'bg-warning-100 dark:bg-warning-900/50 text-warning-700 dark:text-warning-400'
                    }`}>
                      {sale.status}
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
};

export default DashboardPage;