import { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  ShoppingBag, 
  AlertTriangle, 
  Package, 
  DollarSign,
  Users,
  BarChart3,
  PieChart,
  Activity,
  Calendar,
  Target,
  Zap
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
  const { dashboardData, isLoading, loadDashboardData } = useDashboardStore();
  const { settings } = useAuthStore();
  const isDarkMode = settings.general.theme === 'dark';
  const [selectedDashboard, setSelectedDashboard] = useState('overview');

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

  const dashboardTabs = [
    { id: 'overview', name: 'Overview', icon: <BarChart3 size={18} /> },
    { id: 'sales', name: 'Sales Analytics', icon: <DollarSign size={18} /> },
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

  // Mock data for different dashboards
  const salesTrendData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [
      {
        label: 'Sales',
        data: [65000, 78000, 85000, 92000, 88000, 95000],
        borderColor: isDarkMode ? 'rgba(96, 165, 250, 1)' : 'rgba(59, 130, 246, 1)',
        backgroundColor: isDarkMode ? 'rgba(96, 165, 250, 0.1)' : 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const categoryPerformanceData = {
    labels: ['Electronics', 'Clothing', 'Food', 'Books', 'Home'],
    datasets: [
      {
        data: [35, 25, 20, 12, 8],
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

  const hourlyTrafficData = {
    labels: ['6AM', '9AM', '12PM', '3PM', '6PM', '9PM'],
    datasets: [
      {
        label: 'Customers',
        data: [12, 35, 58, 42, 67, 28],
        backgroundColor: isDarkMode ? 'rgba(34, 197, 94, 0.8)' : 'rgba(34, 197, 94, 0.8)',
        borderColor: isDarkMode ? 'rgba(34, 197, 94, 1)' : 'rgba(34, 197, 94, 1)',
        borderWidth: 2,
        borderRadius: 8,
      },
    ],
  };

  const inventoryStatusData = {
    labels: ['In Stock', 'Low Stock', 'Out of Stock', 'Overstocked'],
    datasets: [
      {
        data: [65, 20, 8, 7],
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

  const renderOverviewDashboard = () => (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <DashboardCard 
          title="Today's Sales" 
          value={`₹${(dashboardData.salesSummary?.today || 0).toLocaleString('en-IN')}`} 
          icon={<DollarSign size={24} className="text-white" />}
          iconBgColor="bg-gradient-to-br from-primary-500 to-primary-600"
          trend={{ value: "+5.2% from yesterday", isPositive: true }}
          subtitle="Daily revenue"
        />
        <DashboardCard 
          title="Monthly Sales" 
          value={`₹${(dashboardData.salesSummary?.thisMonth || 0).toLocaleString('en-IN')}`} 
          icon={<ShoppingBag size={24} className="text-white" />}
          iconBgColor="bg-gradient-to-br from-secondary-500 to-secondary-600"
          trend={{ value: "+12.5% from last month", isPositive: true }}
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
          value="1,234" 
          icon={<Users size={24} className="text-white" />}
          iconBgColor="bg-gradient-to-br from-purple-500 to-purple-600"
          trend={{ value: "+8.1% this month", isPositive: true }}
          subtitle="Registered users"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Sales Trend</h2>
          <div className="h-64">
            <Line data={salesTrendData} options={chartOptions} />
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Category Performance</h2>
          <div className="h-64">
            <Doughnut data={categoryPerformanceData} options={{...chartOptions, cutout: '60%'}} />
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
          value="₹2,45,680" 
          icon={<DollarSign size={24} className="text-white" />}
          iconBgColor="bg-gradient-to-br from-green-500 to-green-600"
          trend={{ value: "+15.3% vs last month", isPositive: true }}
        />
        <DashboardCard 
          title="Average Order Value" 
          value="₹1,250" 
          icon={<Target size={24} className="text-white" />}
          iconBgColor="bg-gradient-to-br from-blue-500 to-blue-600"
          trend={{ value: "+8.2% vs last month", isPositive: true }}
        />
        <DashboardCard 
          title="Total Orders" 
          value="1,847" 
          icon={<ShoppingBag size={24} className="text-white" />}
          iconBgColor="bg-gradient-to-br from-purple-500 to-purple-600"
          trend={{ value: "+12.1% vs last month", isPositive: true }}
        />
        <DashboardCard 
          title="Conversion Rate" 
          value="68.5%" 
          icon={<Zap size={24} className="text-white" />}
          iconBgColor="bg-gradient-to-br from-orange-500 to-orange-600"
          trend={{ value: "+2.3% vs last month", isPositive: true }}
        />
      </div>

      {/* Sales Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Revenue Trend</h2>
          <div className="h-80">
            <Line data={salesTrendData} options={chartOptions} />
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Hourly Traffic</h2>
          <div className="h-80">
            <Bar data={hourlyTrafficData} options={chartOptions} />
          </div>
        </div>
      </div>

      {/* Top Products */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Top Selling Products</h2>
        <div className="space-y-4">
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
          value="₹8,45,230" 
          icon={<DollarSign size={24} className="text-white" />}
          iconBgColor="bg-gradient-to-br from-green-500 to-green-600"
        />
      </div>

      {/* Inventory Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Inventory Status</h2>
          <div className="h-80">
            <Pie data={inventoryStatusData} options={chartOptions} />
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Category Distribution</h2>
          <div className="h-80">
            <Doughnut data={categoryPerformanceData} options={{...chartOptions, cutout: '50%'}} />
          </div>
        </div>
      </div>

      {/* Stock Alerts */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Stock Alerts</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <div className="flex items-center">
              <AlertTriangle size={20} className="text-red-600 dark:text-red-400 mr-3" />
              <div>
                <p className="font-medium text-red-800 dark:text-red-200">Organic Milk 1L</p>
                <p className="text-sm text-red-600 dark:text-red-400">Out of stock</p>
              </div>
            </div>
            <button className="px-3 py-1 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">
              Reorder
            </button>
          </div>
          
          <div className="flex items-center justify-between p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <div className="flex items-center">
              <AlertTriangle size={20} className="text-yellow-600 dark:text-yellow-400 mr-3" />
              <div>
                <p className="font-medium text-yellow-800 dark:text-yellow-200">Whole Wheat Bread</p>
                <p className="text-sm text-yellow-600 dark:text-yellow-400">Low stock: 5 remaining</p>
              </div>
            </div>
            <button className="px-3 py-1 bg-yellow-600 text-white rounded-lg text-sm hover:bg-yellow-700">
              Reorder
            </button>
          </div>
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
          value="2,847" 
          icon={<Users size={24} className="text-white" />}
          iconBgColor="bg-gradient-to-br from-purple-500 to-purple-600"
          trend={{ value: "+12.5% this month", isPositive: true }}
        />
        <DashboardCard 
          title="New Customers" 
          value="156" 
          icon={<Users size={24} className="text-white" />}
          iconBgColor="bg-gradient-to-br from-green-500 to-green-600"
          trend={{ value: "+8.3% vs last month", isPositive: true }}
        />
        <DashboardCard 
          title="Returning Customers" 
          value="1,234" 
          icon={<Users size={24} className="text-white" />}
          iconBgColor="bg-gradient-to-br from-blue-500 to-blue-600"
          trend={{ value: "+15.2% vs last month", isPositive: true }}
        />
        <DashboardCard 
          title="Customer Lifetime Value" 
          value="₹4,250" 
          icon={<DollarSign size={24} className="text-white" />}
          iconBgColor="bg-gradient-to-br from-orange-500 to-orange-600"
          trend={{ value: "+5.8% vs last month", isPositive: true }}
        />
      </div>

      {/* Customer Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Customer Acquisition</h2>
          <div className="h-80">
            <Line data={salesTrendData} options={chartOptions} />
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Customer Segments</h2>
          <div className="h-80">
            <Doughnut data={{
              labels: ['VIP', 'Regular', 'New', 'Inactive'],
              datasets: [{
                data: [15, 45, 25, 15],
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
          {[
            { name: 'Rajesh Kumar', purchases: 45, amount: 28500, loyalty: 'Gold' },
            { name: 'Priya Sharma', purchases: 32, amount: 19200, loyalty: 'Silver' },
            { name: 'Amit Singh', purchases: 58, amount: 36500, loyalty: 'Gold' },
            { name: 'Sunita Patel', purchases: 23, amount: 15600, loyalty: 'Silver' },
          ].map((customer, index) => (
            <div key={index} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <div className="flex items-center">
                <div className="h-10 w-10 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold mr-4">
                  {customer.name.charAt(0)}
                </div>
                <div>
                  <p className="font-medium text-gray-800 dark:text-gray-100">{customer.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{customer.purchases} purchases</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-gray-800 dark:text-gray-100">₹{customer.amount.toLocaleString('en-IN')}</p>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  customer.loyalty === 'Gold' 
                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-400'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                }`}>
                  {customer.loyalty}
                </span>
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
          value="85%" 
          icon={<Target size={24} className="text-white" />}
          iconBgColor="bg-gradient-to-br from-green-500 to-green-600"
          trend={{ value: "+5% vs yesterday", isPositive: true }}
        />
        <DashboardCard 
          title="Monthly Target" 
          value="92%" 
          icon={<Target size={24} className="text-white" />}
          iconBgColor="bg-gradient-to-br from-blue-500 to-blue-600"
          trend={{ value: "+12% vs last month", isPositive: true }}
        />
        <DashboardCard 
          title="Profit Margin" 
          value="24.5%" 
          icon={<TrendingUp size={24} className="text-white" />}
          iconBgColor="bg-gradient-to-br from-purple-500 to-purple-600"
          trend={{ value: "+2.1% vs last month", isPositive: true }}
        />
        <DashboardCard 
          title="Efficiency Score" 
          value="88%" 
          icon={<Activity size={24} className="text-white" />}
          iconBgColor="bg-gradient-to-br from-orange-500 to-orange-600"
          trend={{ value: "+3.2% vs last month", isPositive: true }}
        />
      </div>

      {/* Performance Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Target vs Achievement</h2>
          <div className="h-80">
            <Bar data={{
              labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
              datasets: [
                {
                  label: 'Target',
                  data: [100, 100, 100, 100],
                  backgroundColor: 'rgba(156, 163, 175, 0.5)',
                },
                {
                  label: 'Achievement',
                  data: [85, 92, 88, 95],
                  backgroundColor: 'rgba(34, 197, 94, 0.8)',
                },
              ],
            }} options={chartOptions} />
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Performance Metrics</h2>
          <div className="space-y-6">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Sales Target</span>
                <span className="text-sm text-gray-500 dark:text-gray-400">85%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full" style={{ width: '85%' }}></div>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Customer Satisfaction</span>
                <span className="text-sm text-gray-500 dark:text-gray-400">92%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{ width: '92%' }}></div>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Inventory Turnover</span>
                <span className="text-sm text-gray-500 dark:text-gray-400">78%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div className="bg-purple-500 h-2 rounded-full" style={{ width: '78%' }}></div>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Operational Efficiency</span>
                <span className="text-sm text-gray-500 dark:text-gray-400">88%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div className="bg-orange-500 h-2 rounded-full" style={{ width: '88%' }}></div>
              </div>
            </div>
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
          value="15.3%" 
          icon={<TrendingUp size={24} className="text-white" />}
          iconBgColor="bg-gradient-to-br from-green-500 to-green-600"
          trend={{ value: "+2.1% vs last quarter", isPositive: true }}
        />
        <DashboardCard 
          title="Market Share" 
          value="12.8%" 
          icon={<PieChart size={24} className="text-white" />}
          iconBgColor="bg-gradient-to-br from-blue-500 to-blue-600"
          trend={{ value: "+0.8% vs last quarter", isPositive: true }}
        />
        <DashboardCard 
          title="Seasonal Index" 
          value="1.25" 
          icon={<Calendar size={24} className="text-white" />}
          iconBgColor="bg-gradient-to-br from-purple-500 to-purple-600"
          trend={{ value: "+0.15 vs last year", isPositive: true }}
        />
        <DashboardCard 
          title="Forecast Accuracy" 
          value="94.2%" 
          icon={<Activity size={24} className="text-white" />}
          iconBgColor="bg-gradient-to-br from-orange-500 to-orange-600"
          trend={{ value: "+1.8% vs last month", isPositive: true }}
        />
      </div>

      {/* Trend Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Yearly Growth Trend</h2>
          <div className="h-80">
            <Line data={{
              labels: ['2020', '2021', '2022', '2023', '2024'],
              datasets: [{
                label: 'Revenue Growth',
                data: [100, 115, 132, 148, 171],
                borderColor: 'rgba(34, 197, 94, 1)',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                fill: true,
                tension: 0.4,
              }]
            }} options={chartOptions} />
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Seasonal Patterns</h2>
          <div className="h-80">
            <Bar data={{
              labels: ['Q1', 'Q2', 'Q3', 'Q4'],
              datasets: [{
                label: 'Sales Volume',
                data: [85, 92, 78, 105],
                backgroundColor: [
                  'rgba(59, 130, 246, 0.8)',
                  'rgba(34, 197, 94, 0.8)',
                  'rgba(251, 191, 36, 0.8)',
                  'rgba(239, 68, 68, 0.8)',
                ],
              }]
            }} options={chartOptions} />
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
              Revenue has grown consistently by 15% quarter-over-quarter
            </p>
          </div>
          
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center mb-2">
              <Calendar size={20} className="text-blue-600 dark:text-blue-400 mr-2" />
              <h3 className="font-medium text-blue-800 dark:text-blue-200">Seasonal Peak</h3>
            </div>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Q4 shows 25% higher sales due to holiday season
            </p>
          </div>
          
          <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
            <div className="flex items-center mb-2">
              <Target size={20} className="text-purple-600 dark:text-purple-400 mr-2" />
              <h3 className="font-medium text-purple-800 dark:text-purple-200">Market Expansion</h3>
            </div>
            <p className="text-sm text-purple-700 dark:text-purple-300">
              Market share increased by 0.8% this quarter
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
        </div>
        
        <div className="mt-4 sm:mt-0">
          <select className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100">
            <option>Last 30 days</option>
            <option>Last 7 days</option>
            <option>Last 90 days</option>
            <option>This year</option>
          </select>
        </div>
      </div>

      {/* Dashboard Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {dashboardTabs.map((tab) => (
            <button
              key={tab.id}
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