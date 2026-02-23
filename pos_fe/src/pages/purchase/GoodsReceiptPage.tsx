import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Filter,
  Clock,
  CheckCircle,
  AlertTriangle,
  Eye,
  Edit,
  Package,
  Truck,
} from 'lucide-react';
import { listGRNs } from '../../service/purchaseService';

const GoodsReceiptPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [grnRecords, setGrnRecords] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    listGRNs()
      .then((res) => setGrnRecords(res.results || []))
      .catch(console.error);
  }, []);

  const filteredRecords = grnRecords.filter((grn) => {
    const matchesSearch =
      grn.grn_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      grn.po_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      grn.supplier_name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' || grn.status?.toLowerCase() === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft':
        return <Clock size={16} className="text-gray-600" />;
      case 'completed':
        return <CheckCircle size={16} className="text-green-600" />;
      case 'discrepancy':
        return <AlertTriangle size={16} className="text-yellow-600" />;
      default:
        return <Package size={16} className="text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'discrepancy':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
            Welcome, Cashier User
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Today is {new Date().toLocaleDateString('en-GB')}
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => navigate('/grns/new?from_po=true')}
            className="flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <Truck size={18} className="mr-2" />
            From PO
          </button>
          <button
            onClick={() => navigate('/grns/new')}
            className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 dark:hover:bg-primary-600"
          >
            <Plus size={18} className="mr-2" />
            New GRN
          </button>
        </div>
      </div>

      {/* Title */}
      <div>
        <h1 className="text-3xl font-semibold text-gray-800 dark:text-gray-100">
          Goods Receipt Notes
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Record and verify received goods from suppliers
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-gray-400 dark:text-gray-500" />
            </div>
            <input
              type="text"
              placeholder="Search GRN records..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="completed">Completed</option>
            <option value="discrepancy">With Discrepancy</option>
          </select>

          <input
            type="date"
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
          />

          <button className="flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
            <Filter size={18} className="mr-2" />
            More Filters
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  GRN Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Purchase Order
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Supplier
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Items Received
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Received By
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredRecords.map((grn) => {
                const percentage =
                  grn.items_count > 0
                    ? Math.round((grn.received_items / grn.items_count) * 100)
                    : 0;
                const progressColor =
                  grn.discrepancies > 0 ? 'bg-yellow-500' : 'bg-green-500';

                return (
                  <tr key={grn.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {grn.grn_number}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(grn.grn_date).toLocaleDateString('en-GB')}
                      </div>
                    </td>
                    <td className="px-6 py-4">{grn.po_number || '-'}</td>
                    <td className="px-6 py-4">{grn.supplier_name}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        {getStatusIcon(grn.status)}
                        <span
                          className={`ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                            grn.status
                          )}`}
                        >
                          {grn.status}
                        </span>
                      </div>
                      {grn.discrepancies > 0 && (
                        <div className="text-xs text-yellow-600 mt-1">
                          {grn.discrepancies} discrepancies
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        {grn.received_items}/{grn.items_count} items
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-1">
                        <div
                          className={`h-2 rounded-full ${progressColor}`}
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </td>
                    <td className="px-6 py-4">{grn.received_by}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => navigate(`/grns/${grn.id}`)}
                          className="text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => navigate(`/grns/${grn.id}`)}
                          className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                        >
                          <Edit size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-gray-500 dark:text-gray-400">
                    No GRNs found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default GoodsReceiptPage;
