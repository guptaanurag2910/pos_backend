import { useState } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  FileText, 
  Clock, 
  CheckCircle, 
  XCircle,
  AlertTriangle,
  Eye,
  Edit,
  Trash2
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import RequisitionModal from '../../components/purchase/modals/RequisitionModal';

const PurchaseRequisitionsPage = () => {
  const { user, settings } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [showRequisitionModal, setShowRequisitionModal] = useState(false);
  const [editingRequisition, setEditingRequisition] = useState<any>(null);
  const [requisitions, setRequisitions] = useState([
    {
      id: 'req1',
      requisitionNumber: 'REQ-2024-001',
      requestedBy: 'Store Manager',
      department: 'Retail',
      requestDate: '2024-01-15',
      requiredDate: '2024-01-25',
      priority: 'high',
      status: 'pending',
      itemsCount: 5,
      estimatedValue: 25000
    },
    {
      id: 'req2',
      requisitionNumber: 'REQ-2024-002',
      requestedBy: 'Inventory Manager',
      department: 'Warehouse',
      requestDate: '2024-01-14',
      requiredDate: '2024-01-20',
      priority: 'urgent',
      status: 'approved',
      itemsCount: 3,
      estimatedValue: 15000
    },
    {
      id: 'req3',
      requisitionNumber: 'REQ-2024-003',
      requestedBy: 'Sales Team',
      department: 'Sales',
      requestDate: '2024-01-13',
      requiredDate: '2024-01-30',
      priority: 'medium',
      status: 'converted',
      itemsCount: 8,
      estimatedValue: 45000
    }
  ]);

  const handleSaveRequisition = (requisitionData: any) => {
    if (editingRequisition) {
      setRequisitions(prev => prev.map(req => 
        req.id === editingRequisition.id ? { ...req, ...requisitionData } : req
      ));
    } else {
      const newRequisition = {
        ...requisitionData,
        id: `req_${Date.now()}`,
        itemsCount: requisitionData.items?.length || 0
      };
      setRequisitions(prev => [newRequisition, ...prev]);
    }
    setEditingRequisition(null);
  };

  const handleEditRequisition = (requisition: any) => {
    setEditingRequisition(requisition);
    setShowRequisitionModal(true);
  };

  const handleDeleteRequisition = (id: string) => {
    if (confirm('Are you sure you want to delete this requisition?')) {
      setRequisitions(prev => prev.filter(req => req.id !== id));
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock size={16} className="text-warning-600" />;
      case 'approved':
        return <CheckCircle size={16} className="text-success-600" />;
      case 'rejected':
        return <XCircle size={16} className="text-error-600" />;
      case 'converted':
        return <CheckCircle size={16} className="text-primary-600" />;
      default:
        return <FileText size={16} className="text-gray-600" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-error-100 text-error-800 dark:bg-error-900/50 dark:text-error-400';
      case 'high':
        return 'bg-warning-100 text-warning-800 dark:bg-warning-900/50 dark:text-warning-400';
      case 'medium':
        return 'bg-primary-100 text-primary-800 dark:bg-primary-900/50 dark:text-primary-400';
      case 'low':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-warning-100 text-warning-800 dark:bg-warning-900/50 dark:text-warning-400';
      case 'approved':
        return 'bg-success-100 text-success-800 dark:bg-success-900/50 dark:text-success-400';
      case 'rejected':
        return 'bg-error-100 text-error-800 dark:bg-error-900/50 dark:text-error-400';
      case 'converted':
        return 'bg-primary-100 text-primary-800 dark:bg-primary-900/50 dark:text-primary-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Purchase Requisitions</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage purchase requests and approvals</p>
        </div>
        
        <button 
          onClick={() => {
            setEditingRequisition(null);
            setShowRequisitionModal(true);
          }}
          className="flex items-center px-4 py-2 bg-primary-600 dark:bg-primary-500 text-white rounded-lg hover:bg-primary-700 dark:hover:bg-primary-600"
        >
          <Plus size={18} className="mr-2" />
          New Requisition
        </button>
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
              placeholder="Search requisitions..."
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
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="converted">Converted</option>
          </select>
          
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
          >
            <option value="all">All Priority</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          
          <button className="flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
            <Filter size={18} className="mr-2" />
            More Filters
          </button>
        </div>
      </div>

      {/* Requisitions List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Requisition
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Requested By
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Items
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Est. Value
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Required Date
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {requisitions.map((req) => (
                <tr key={req.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {req.requisitionNumber}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {req.department}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-gray-100">{req.requestedBy}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {new Date(req.requestDate).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getPriorityColor(req.priority)}`}>
                      {req.priority}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getStatusIcon(req.status)}
                      <span className={`ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(req.status)}`}>
                        {req.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {req.itemsCount} items
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                    ₹{req.estimatedValue.toLocaleString('en-IN')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {new Date(req.requiredDate).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button className="text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300">
                        <Eye size={16} />
                      </button>
                      <button 
                        onClick={() => handleEditRequisition(req)}
                        className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        onClick={() => handleDeleteRequisition(req.id)}
                        className="text-error-600 dark:text-error-400 hover:text-error-800 dark:hover:text-error-300"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Requisition Modal */}
      <RequisitionModal
        isOpen={showRequisitionModal}
        onClose={() => {
          setShowRequisitionModal(false);
          setEditingRequisition(null);
        }}
        onSave={handleSaveRequisition}
        initialData={editingRequisition}
      />
    </div>
  );
};

export default PurchaseRequisitionsPage;