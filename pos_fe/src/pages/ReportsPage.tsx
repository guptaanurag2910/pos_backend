import { useState } from 'react';
import { 
  LineChart, 
  BarChart,
  Download,
  Calendar,
  FileText,
  Filter,
  ChevronDown
} from 'lucide-react';
import { usePOSStore } from '../stores/posStore';
import { useAuthStore } from '../stores/authStore';

const ReportsPage = () => {
  const { completedBills } = usePOSStore();
  const { settings } = useAuthStore();
  const isDarkMode = settings.general.theme === 'dark';
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reportType, setReportType] = useState('sales');

  const generateReport = () => {
    if (!startDate || !endDate) {
      alert('Please select both start and end dates');
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Filter bills within date range
    const filteredBills = completedBills.filter(bill => {
      const billDate = new Date(bill.createdAt);
      return billDate >= start && billDate <= end;
    });

    let csvContent = '';
    let filename = '';

    switch (reportType) {
      case 'sales':
        // Sales Report
        csvContent = 'Date,Bill Number,Customer,Items,Subtotal,Tax,Discount,Total,Payment Method\n';
        filteredBills.forEach(bill => {
          csvContent += `${new Date(bill.createdAt).toLocaleDateString()},${bill.billNumber},${bill.customerName || 'Walk-in'},${bill.items.length},${bill.subtotal},${bill.taxTotal},${bill.discount},${bill.total},${bill.paymentMethod}\n`;
        });
        filename = 'sales_report';
        break;

      case 'inventory':
        // Inventory Report
        const productSales = new Map();
        filteredBills.forEach(bill => {
          bill.items.forEach(item => {
            const existing = productSales.get(item.productId) || { quantity: 0, revenue: 0 };
            existing.quantity += item.quantity;
            existing.revenue += item.total;
            productSales.set(item.productId, existing);
          });
        });

        csvContent = 'Product,Quantity Sold,Revenue\n';
        productSales.forEach((value, key) => {
          const product = completedBills.find(b => b.items.find(i => i.productId === key))?.items.find(i => i.productId === key);
          if (product) {
            csvContent += `${product.productName},${value.quantity},${value.revenue}\n`;
          }
        });
        filename = 'inventory_report';
        break;

      case 'customers':
        // Customer Report
        const customerSales = new Map();
        filteredBills.forEach(bill => {
          if (bill.customerId) {
            const existing = customerSales.get(bill.customerId) || { visits: 0, total: 0 };
            existing.visits++;
            existing.total += bill.total;
            customerSales.set(bill.customerId, existing);
          }
        });

        csvContent = 'Customer,Visits,Total Spent\n';
        customerSales.forEach((value, key) => {
          const customer = completedBills.find(b => b.customerId === key);
          if (customer) {
            csvContent += `${customer.customerName},${value.visits},${value.total}\n`;
          }
        });
        filename = 'customer_report';
        break;
    }

    // Download the CSV file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${startDate}_${endDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Reports & Analytics</h1>
          <p className="text-gray-600 dark:text-gray-400">Generate and analyze business data</p>
        </div>
        
        <button
          onClick={generateReport}
          disabled={!startDate || !endDate}
          className={`flex items-center px-4 py-2 rounded-lg ${
            !startDate || !endDate
              ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed'
              : 'bg-primary-600 dark:bg-primary-500 text-white hover:bg-primary-700 dark:hover:bg-primary-600'
          }`}
        >
          <Download size={18} className="mr-2" />
          Generate Report
        </button>
      </div>

      {/* Report Configuration */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Report Configuration</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Report Type
            </label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="sales">Sales Report</option>
              <option value="inventory">Inventory Report</option>
              <option value="customers">Customer Report</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Start Date
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Calendar size={16} className="text-gray-400 dark:text-gray-500" />
              </div>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              End Date
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Calendar size={16} className="text-gray-400 dark:text-gray-500" />
              </div>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Report Preview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <LineChart className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Sales Trend</h2>
          </div>
          <div className="h-64 bg-gray-50 dark:bg-gray-700 rounded-lg flex items-center justify-center">
            <p className="text-gray-500 dark:text-gray-400">Select date range to preview sales trend</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart className="w-6 h-6 text-green-600 dark:text-green-400" />
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Revenue Analysis</h2>
          </div>
          <div className="h-64 bg-gray-50 dark:bg-gray-700 rounded-lg flex items-center justify-center">
            <p className="text-gray-500 dark:text-gray-400">Select date range to preview revenue analysis</p>
          </div>
        </div>
      </div>

      {/* Report Types */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Sales Report</h3>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Detailed analysis of sales transactions, revenue, and payment methods.
          </p>
          <ul className="text-sm text-gray-500 dark:text-gray-400 space-y-2">
            <li>• Daily sales summary</li>
            <li>• Payment method breakdown</li>
            <li>• Top selling products</li>
          </ul>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="w-6 h-6 text-secondary-600 dark:text-secondary-400" />
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Inventory Report</h3>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Stock levels, movement analysis, and product performance metrics.
          </p>
          <ul className="text-sm text-gray-500 dark:text-gray-400 space-y-2">
            <li>• Stock movement analysis</li>
            <li>• Low stock alerts</li>
            <li>• Product performance</li>
          </ul>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="w-6 h-6 text-accent-600 dark:text-accent-400" />
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Customer Report</h3>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Customer behavior, loyalty metrics, and purchase patterns.
          </p>
          <ul className="text-sm text-gray-500 dark:text-gray-400 space-y-2">
            <li>• Customer purchase history</li>
            <li>• Loyalty program analysis</li>
            <li>• Customer retention metrics</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;