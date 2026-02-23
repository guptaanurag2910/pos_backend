import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search,
  Users,
  Plus,
  Filter,
  Mail,
  Phone,
  ChevronDown,
  ChevronUp,
  Award,
  Download,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { customerService } from '../service/customerService';

interface CustomerRow {
  id: number;
  name: string;
  phone: string;
  email?: string;
  loyaltyPoints: number;
  totalPurchases: number;
  lastPurchase?: string;
}

interface ApiCustomer {
  id: number;
  name: string;
  phone: string;
  email?: string | null;
  loyalty_points?: number | string | null;
  total_purchases?: number | string | null;
  last_purchase?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  address?: string | null;
  notes?: string | null;
}

interface CustomerFormData {
  name: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  pincode: string;
  address: string;
  notes: string;
}

interface PurchaseHistoryRow {
  id: number;
  bill_number?: string;
  created_at?: string;
  status?: string;
  total?: number | string;
}

interface ApiErrorLike {
  response?: {
    data?: unknown;
  };
}

const PAGE_SIZE = 20;
const HISTORY_PAGE_SIZE = 10;

const normalizeCustomer = (row: ApiCustomer): CustomerRow => ({
  id: row.id,
  name: row.name,
  phone: row.phone,
  email: row.email || undefined,
  loyaltyPoints: Number(row.loyalty_points || 0),
  totalPurchases: Number(row.total_purchases || 0),
  lastPurchase: row.last_purchase || undefined,
});

const CustomersPage = () => {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<keyof CustomerRow>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [loyaltyFilter, setLoyaltyFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof CustomerFormData, string>>>({});
  const [editingCustomerId, setEditingCustomerId] = useState<number | null>(null);
  const [deletingCustomerId, setDeletingCustomerId] = useState<number | null>(null);
  const [deletingCustomerName, setDeletingCustomerName] = useState('');
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyCustomerName, setHistoryCustomerName] = useState('');
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseHistoryRow[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [formData, setFormData] = useState<CustomerFormData>({
    name: '',
    phone: '',
    email: '',
    city: '',
    state: '',
    pincode: '',
    address: '',
    notes: '',
  });

  const backendOrdering = useMemo(() => {
    const fieldMap: Record<keyof CustomerRow, string> = {
      id: 'id',
      name: 'name',
      phone: 'phone',
      email: 'email',
      loyaltyPoints: 'loyalty_points',
      totalPurchases: 'total_purchases',
      lastPurchase: 'last_purchase',
    };
    const backendField = fieldMap[sortField] || 'name';
    return sortDirection === 'desc' ? `-${backendField}` : backendField;
  }, [sortField, sortDirection]);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await customerService.list({
        page_size: PAGE_SIZE,
        page,
        search: searchQuery.trim() || undefined,
        ordering: backendOrdering,
      });
      const rows = Array.isArray(response?.results) ? response.results : [];
      setCustomers(rows.map((row: ApiCustomer) => normalizeCustomer(row)));
      const count = Number(response?.count || 0);
      setTotalCount(count);
      const maxPage = Math.max(1, Math.ceil(count / PAGE_SIZE));
      if (page > maxPage) {
        setPage(maxPage);
      }
    } catch (error) {
      console.error('Failed to load customers:', error);
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [backendOrdering, page, searchQuery]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
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
            if (!customer.lastPurchase) return false;
            const lastPurchaseDate = new Date(customer.lastPurchase);
            const today = new Date();
            const daysDiff = Math.floor((today.getTime() - lastPurchaseDate.getTime()) / (1000 * 60 * 60 * 24));

            return (
              (dateFilter === '7days' && daysDiff <= 7) ||
              (dateFilter === '30days' && daysDiff <= 30) ||
              (dateFilter === '90days' && daysDiff <= 90)
            );
          })()
        : true;

      return matchesSearch && matchesLoyalty && matchesDate;
    });
  }, [customers, searchQuery, loyaltyFilter, dateFilter]);

  const sortedCustomers = filteredCustomers;

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const handleSort = (field: keyof CustomerRow) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setPage(1);
  };

  const renderSortIcon = (field: keyof CustomerRow) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ChevronUp size={16} className="ml-1" /> : <ChevronDown size={16} className="ml-1" />;
  };

  const generateReport = () => {
    const headers = ['Name', 'Phone', 'Email', 'Loyalty Points', 'Total Purchases', 'Last Purchase'];
    const rows = sortedCustomers.map((customer) => [
      customer.name,
      customer.phone,
      customer.email || '',
      customer.loyaltyPoints.toString(),
      customer.totalPurchases.toString(),
      customer.lastPurchase || '',
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

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

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      email: '',
      city: '',
      state: '',
      pincode: '',
      address: '',
      notes: '',
    });
    setEditingCustomerId(null);
    setFormErrors({});
  };

  const openCreateModal = () => {
    resetForm();
    setShowCustomerModal(true);
  };

  const openEditModal = async (customerId: number) => {
    try {
      const row = await customerService.get(customerId);
      setEditingCustomerId(customerId);
      setFormData({
        name: row.name || '',
        phone: row.phone || '',
        email: row.email || '',
        city: row.city || '',
        state: row.state || '',
        pincode: row.pincode || '',
        address: row.address || '',
        notes: row.notes || '',
      });
      setFormErrors({});
      setShowCustomerModal(true);
    } catch (error) {
      console.error('Failed to load customer details:', error);
      toast.error('Failed to load customer details');
    }
  };

  const validateForm = () => {
    const errors: Partial<Record<keyof CustomerFormData, string>> = {};
    if (!formData.name.trim()) errors.name = 'Name is required';
    if (!formData.phone.trim()) {
      errors.phone = 'Phone is required';
    } else if (!/^\d{7,15}$/.test(formData.phone.trim())) {
      errors.phone = 'Phone must be 7 to 15 digits';
    }
    if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = 'Enter a valid email';
    }
    if (formData.pincode.trim() && !/^\d{4,10}$/.test(formData.pincode.trim())) {
      errors.pincode = 'Pincode must be 4 to 10 digits';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveCustomer = async () => {
    if (!validateForm()) {
      toast.error('Please fix validation errors');
      return;
    }

    const payload = {
      name: formData.name.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim() || undefined,
      city: formData.city.trim() || undefined,
      state: formData.state.trim() || undefined,
      pincode: formData.pincode.trim() || undefined,
      address: formData.address.trim() || undefined,
      notes: formData.notes.trim() || undefined,
    };

    setSavingCustomer(true);
    try {
      if (editingCustomerId) {
        await customerService.update(editingCustomerId, payload);
        toast.success('Customer updated');
      } else {
        await customerService.create(payload);
        toast.success('Customer created');
      }
      setShowCustomerModal(false);
      resetForm();
      await loadCustomers();
    } catch (error: unknown) {
      console.error('Failed to save customer:', error);
      const err = error as ApiErrorLike;
      const responseData = err.response?.data;
      const message =
        (typeof responseData === 'object' &&
        responseData !== null &&
        'detail' in responseData &&
        typeof (responseData as { detail?: unknown }).detail === 'string'
          ? (responseData as { detail: string }).detail
          : null) ||
        (typeof responseData === 'object' ? JSON.stringify(responseData) : null) ||
        'Failed to save customer';
      toast.error(message);
    } finally {
      setSavingCustomer(false);
    }
  };

  const handleViewPurchaseHistory = async (customer: CustomerRow) => {
    setShowHistoryModal(true);
    setHistoryCustomerName(customer.name);
    setHistoryPage(1);
    setPurchaseHistory([]);
    setHistoryLoading(true);
    try {
      const rows = await customerService.getPurchaseHistory(customer.id);
      setPurchaseHistory(Array.isArray(rows) ? rows : []);
    } catch (error) {
      console.error('Failed to load purchase history:', error);
      toast.error('Failed to load purchase history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleDeactivateCustomer = async () => {
    if (!deletingCustomerId) return;
    try {
      await customerService.delete(deletingCustomerId);
      toast.success('Customer deactivated');
      setDeletingCustomerId(null);
      setDeletingCustomerName('');
      await loadCustomers();
    } catch (error) {
      console.error('Failed to deactivate customer:', error);
      toast.error('Failed to deactivate customer');
    }
  };

  const paginatedPurchaseHistory = useMemo(() => {
    const start = (historyPage - 1) * HISTORY_PAGE_SIZE;
    return purchaseHistory.slice(start, start + HISTORY_PAGE_SIZE);
  }, [purchaseHistory, historyPage]);

  const historyTotalPages = Math.max(1, Math.ceil(purchaseHistory.length / HISTORY_PAGE_SIZE));

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
          <button onClick={openCreateModal} className="flex items-center py-2 px-4 bg-primary-600 dark:bg-primary-500 text-white rounded-lg hover:bg-primary-700 dark:hover:bg-primary-600">
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
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setPage(1);
                }}
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Loyalty Status</label>
                  <select
                    value={loyaltyFilter}
                    onChange={(e) => {
                      setLoyaltyFilter(e.target.value);
                      setPage(1);
                    }}
                    className="w-full py-2 px-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg"
                  >
                    <option value="">All</option>
                    <option value="gold">Gold (500+ points)</option>
                    <option value="silver">Silver (200-499 points)</option>
                    <option value="bronze">Bronze (0-199 points)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Purchase</label>
                  <select
                    value={dateFilter}
                    onChange={(e) => {
                      setDateFilter(e.target.value);
                      setPage(1);
                    }}
                    className="w-full py-2 px-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg"
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
                      setPage(1);
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

        {loading ? (
          <div className="p-10 text-center text-gray-500 dark:text-gray-400">Loading customers...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('name')}>
                    <div className="flex items-center">Customer {renderSortIcon('name')}</div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('loyaltyPoints')}>
                    <div className="flex items-center">Loyalty {renderSortIcon('loyaltyPoints')}</div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('totalPurchases')}>
                    <div className="flex items-center">Total Purchases {renderSortIcon('totalPurchases')}</div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Last Purchase</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
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
                        <Award
                          size={16}
                          className={`mr-2 ${
                            customer.loyaltyPoints >= 500
                              ? 'text-yellow-500 dark:text-yellow-400'
                              : customer.loyaltyPoints >= 200
                              ? 'text-gray-400 dark:text-gray-500'
                              : 'text-amber-700 dark:text-amber-600'
                          }`}
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{customer.loyaltyPoints} points</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">₹{customer.totalPurchases.toLocaleString('en-IN')}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-gray-100">
                        {customer.lastPurchase ? new Date(customer.lastPurchase).toLocaleDateString() : 'Never'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button onClick={() => openEditModal(customer.id)} className="text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 mr-3">Edit</button>
                      <button onClick={() => handleViewPurchaseHistory(customer)} className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 mr-3">View</button>
                      <button
                        onClick={() => {
                          setDeletingCustomerId(customer.id);
                          setDeletingCustomerName(customer.name);
                        }}
                        className="text-red-600 hover:text-red-800"
                      >
                        Deactivate
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
              </div>
            )}

            {sortedCustomers.length > 0 && (
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Page {page} of {totalPages} | Total {totalCount} customers
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-3 py-1 border rounded disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="px-3 py-1 border rounded disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showCustomerModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white dark:bg-gray-800 rounded-lg shadow-lg">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {editingCustomerId ? 'Edit Customer' : 'Add Customer'}
              </h2>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
              <input value={formData.name} onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} placeholder="Name *" className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100" />
              {formErrors.name && <p className="text-xs text-red-600 -mt-2">{formErrors.name}</p>}
              <input value={formData.phone} onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))} placeholder="Phone *" className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100" />
              {formErrors.phone && <p className="text-xs text-red-600 -mt-2">{formErrors.phone}</p>}
              <input value={formData.email} onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))} placeholder="Email" className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100" />
              {formErrors.email && <p className="text-xs text-red-600 -mt-2">{formErrors.email}</p>}
              <input value={formData.city} onChange={(e) => setFormData((p) => ({ ...p, city: e.target.value }))} placeholder="City" className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100" />
              <input value={formData.state} onChange={(e) => setFormData((p) => ({ ...p, state: e.target.value }))} placeholder="State" className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100" />
              <input value={formData.pincode} onChange={(e) => setFormData((p) => ({ ...p, pincode: e.target.value }))} placeholder="Pincode" className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100" />
              {formErrors.pincode && <p className="text-xs text-red-600 -mt-2">{formErrors.pincode}</p>}
              <textarea value={formData.address} onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))} placeholder="Address" rows={2} className="md:col-span-2 px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100" />
              <textarea value={formData.notes} onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))} placeholder="Notes" rows={2} className="md:col-span-2 px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100" />
            </div>
            <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCustomerModal(false);
                  resetForm();
                }}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCustomer}
                disabled={savingCustomer}
                className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60"
              >
                {savingCustomer ? 'Saving...' : editingCustomerId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-lg shadow-lg">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Purchase History: {historyCustomerName}
              </h2>
              <button onClick={() => setShowHistoryModal(false)} className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">Close</button>
            </div>
            <div className="p-5 max-h-[60vh] overflow-auto">
              {historyLoading ? (
                <p className="text-gray-500 dark:text-gray-400">Loading history...</p>
              ) : purchaseHistory.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400">No purchase history found.</p>
              ) : (
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Bill</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {paginatedPurchaseHistory.map((bill) => (
                      <tr key={bill.id}>
                        <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{bill.bill_number || `#${bill.id}`}</td>
                        <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">{bill.created_at ? new Date(bill.created_at).toLocaleString() : '--'}</td>
                        <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">{bill.status || '--'}</td>
                        <td className="px-3 py-2 text-sm text-right text-gray-900 dark:text-gray-100">₹{Number(bill.total || 0).toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {!historyLoading && purchaseHistory.length > 0 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Page {historyPage} of {historyTotalPages} | {purchaseHistory.length} bills
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                      disabled={historyPage <= 1}
                      className="px-3 py-1 border rounded disabled:opacity-50"
                    >
                      Prev
                    </button>
                    <button
                      onClick={() => setHistoryPage((p) => Math.min(historyTotalPages, p + 1))}
                      disabled={historyPage >= historyTotalPages}
                      className="px-3 py-1 border rounded disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {deletingCustomerId !== null && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-lg">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Deactivate Customer</h2>
            </div>
            <div className="px-5 py-4 text-sm text-gray-700 dark:text-gray-300">
              Are you sure you want to deactivate <span className="font-semibold">{deletingCustomerName}</span>?
            </div>
            <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => {
                  setDeletingCustomerId(null);
                  setDeletingCustomerName('');
                }}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleDeactivateCustomer}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
              >
                Deactivate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomersPage;
