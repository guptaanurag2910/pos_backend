import { useState } from 'react';
import { 
  Search, 
  Users, 
  Plus, 
  Filter, 
  Mail, 
  Phone, 
  Edit, 
  ChevronDown, 
  ChevronUp,
  Award,
  Download
} from 'lucide-react';
import { usePOSStore } from '../stores/posStore';
import { Customer } from '../types';
import { useAuthStore } from '../stores/authStore';

const CustomersPage = () => {
  const { customers } = usePOSStore();
  const { settings } = useAuthStore();
  const isDarkMode = settings.general.theme === 'dark';
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<keyof Customer>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showFilters, setShowFilters] = useState(false);
  const [loyaltyFilter, setLoyaltyFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Filter customers based on search query and filters
  const filteredCustomers = customers.filter(customer => {
    if (!searchQuery && !loyaltyFilter && !dateFilter) return true;
    
    const matchesSearch = searchQuery 
      ? customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customer.phone.includes(searchQuery) ||
        (customer.email && customer.email.toLowerCase().includes(searchQuery))
      : true;

    const matchesLoyalty = loyaltyFilter
      ? (loyaltyFilter === 'gold' && customer.loyaltyPoints >= 500) ||
        (loyaltyFilter === 'silver' && customer.loyaltyPoints >= 200 && customer.loyaltyPoints < 500) ||
        (loyaltyFilter === 'bronze' && customer.loyaltyPoints < 200)
      : true;

    const matchesDate = dateFilter
      ? (() => {
          const lastPurchaseDate = new Date(customer.lastPurchase);
          const today = new Date();
          const daysDiff = Math.floor((today.getTime() - lastPurchaseDate.getTime()) / (1000 * 60 * 60 * 24));
          
          return (dateFilter === '7days' && daysDiff <= 7) ||
                 (dateFilter === '30days' && daysDiff <= 30) ||
                 (dateFilter === '90days' && daysDiff <= 90);
        })()
      : true;

    return matchesSearch && matchesLoyalty && matchesDate;
  });

  // Sort customers
  const sortedCustomers = [...filteredCustomers].sort((a, b) => {
    const fieldA = a[sortField];
    const fieldB = b[sortField];
    
    if (typeof fieldA === 'string' && typeof fieldB === 'string') {
      return sortDirection === 'asc' 
        ? fieldA.localeCompare(fieldB) 
        : fieldB.localeCompare(fieldA);
    }
    
    if (typeof fieldA === 'number' && typeof fieldB === 'number') {
      return sortDirection === 'asc' 
        ? fieldA - fieldB 
        : fieldB - fieldA;
    }
    
    return 0;
  });

  const handleSort = (field: keyof Customer) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const renderSortIcon = (field: keyof Customer) => {
    if (sortField !== field) return null;
    
    return sortDirection === 'asc' 
      ? <ChevronUp size={16} className="ml-1" /> 
      : <ChevronDown size={16} className="ml-1" />;
  };

  const generateReport = () => {
    // Create CSV content
    const headers = ['Name', 'Phone', 'Email', 'Loyalty Points', 'Total Purchases', 'Last Purchase'];
    const rows = sortedCustomers.map(customer => [
      customer.name,
      customer.phone,
      customer.email || '',
      customer.loyaltyPoints.toString(),
      customer.totalPurchases.toString(),
      customer.lastPurchase
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customers_report_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Customers</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage customer information and loyalty</p>
        </div>
        
        <div className="mt-4 sm:mt-0 flex space-x-3">
          <button 
            onClick={generateReport}
            className="flex items-center py-2 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <Download size={18} className="mr-2" />
            Export
          </button>
          <button className="flex items-center py-2 px-4 bg-primary-600 dark:bg-primary-500 text-white rounded-lg hover:bg-primary-700 dark:hover:bg-primary-600">
            <Plus size={18} className="mr-2" />
            Add Customer
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b dark:border-gray-700">
          <div className="flex flex-col md:flex-row space-y-3 md:space-y-0 md:space-x-3">
            <div className="relative flex-grow">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={18} className="text-gray-400 dark:text-gray-500" />
              </div>
              
              <input
                type="text"
                placeholder="Search customers by name, phone or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-gray-900 dark:text-gray-100"
              />
            </div>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center justify-center py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 md:w-auto"
            >
              <Filter size={18} className="mr-2" />
              Filters
              <ChevronDown size={16} className={`ml-2 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
          </div>
          
          {showFilters && (
            <div className="mt-3 pt-3 border-t dark:border-gray-700">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Loyalty Status
                  </label>
                  <select
                    value={loyaltyFilter}
                    onChange={(e) => setLoyaltyFilter(e.target.value)}
                    className="w-full py-2 px-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">All</option>
                    <option value="gold">Gold (500+ points)</option>
                    <option value="silver">Silver (200-499 points)</option>
                    <option value="bronze">Bronze (0-199 points)</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Last Purchase
                  </label>
                  <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="w-full py-2 px-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">All</option>
                    <option value="7days">Last 7 days</option>
                    <option value="30days">Last 30 days</option>
                    <option value="90days">Last 90 days</option>
                  </select>
                </div>
                
                <div className="flex items-end">
                  <button 
                    onClick={() => {
                      setLoyaltyFilter('');
                      setDateFilter('');
                    }}
                    className="flex items-center py-2 px-4 bg-primary-600 dark:bg-primary-500 text-white rounded-lg hover:bg-primary-700 dark:hover:bg-primary-600"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center">
                    Customer {renderSortIcon('name')}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Contact
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('loyaltyPoints')}
                >
                  <div className="flex items-center">
                    Loyalty {renderSortIcon('loyaltyPoints')}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('totalPurchases')}
                >
                  <div className="flex items-center">
                    Total Purchases {renderSortIcon('totalPurchases')}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Last Purchase
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {sortedCustomers.map((customer) => (
                <tr key={customer.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-10 w-10 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-primary-600 dark:text-primary-400 font-medium">
                        {customer.name.charAt(0)}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{customer.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">ID: {customer.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col space-y-1">
                      <div className="flex items-center text-sm text-gray-900 dark:text-gray-100">
                        <Phone size={14} className="mr-1 text-gray-500 dark:text-gray-400" />
                        {customer.phone}
                      </div>
                      {customer.email && (
                        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                          <Mail size={14} className="mr-1" />
                          {customer.email}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Award size={16} className={`mr-2 ${
                        customer.loyaltyPoints >= 500 ? 'text-yellow-500 dark:text-yellow-400' : 
                        customer.loyaltyPoints >= 200 ? 'text-gray-400 dark:text-gray-500' : 
                        'text-amber-700 dark:text-amber-600'
                      }`} />
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{customer.loyaltyPoints} points</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {customer.loyaltyPoints >= 500 
                            ? 'Gold' 
                            : customer.loyaltyPoints >= 200 
                              ? 'Silver' 
                              : 'Bronze'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">₹{customer.totalPurchases.toLocaleString('en-IN')}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-gray-100">
                      {customer.lastPurchase 
                        ? new Date(customer.lastPurchase).toLocaleDateString() 
                        : 'Never'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button className="text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 mr-3">
                      Edit
                    </button>
                    <button className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredCustomers.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-16 w-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center text-gray-400 dark:text-gray-500 mb-4">
                <Users size={32} />
              </div>
              <p className="text-gray-500 dark:text-gray-400 font-medium">No customers found</p>
              <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
                {searchQuery || loyaltyFilter || dateFilter
                  ? 'Try adjusting your search or filters'
                  : 'Add customers to see them here'}
              </p>
            </div>
          )}
        </div>
        
        <div className="px-6 py-4 border-t dark:border-gray-700 flex items-center justify-between">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Showing <span className="font-medium">{filteredCustomers.length}</span> of{' '}
            <span className="font-medium">{customers.length}</span> customers
          </div>
          
          <div className="flex space-x-2">
            <button className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700">
              Previous
            </button>
            <button className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700">
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomersPage;