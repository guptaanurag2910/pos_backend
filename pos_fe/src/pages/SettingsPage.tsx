import { useState } from 'react';
import { 
  Settings, 
  Users, 
  Store, 
  CreditCard, 
  Printer, 
  Shield, 
  FileText,
  Database,
  ChevronRight
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

const settingSections = [
  {
    id: 'general',
    name: 'General Settings',
    icon: <Settings size={20} className="text-gray-500" />,
    description: 'Basic store information and preferences'
  },
  {
    id: 'users',
    name: 'Users & Permissions',
    icon: <Users size={20} className="text-gray-500" />,
    description: 'Manage user accounts and access control'
  },
  {
    id: 'store',
    name: 'Store Configuration',
    icon: <Store size={20} className="text-gray-500" />,
    description: 'Branch details and configuration'
  },
  {
    id: 'payment',
    name: 'Payment Methods',
    icon: <CreditCard size={20} className="text-gray-500" />,
    description: 'Configure payment gateways and options'
  },
  {
    id: 'billing',
    name: 'Billing & Invoices',
    icon: <FileText size={20} className="text-gray-500" />,
    description: 'Invoice format and GST settings'
  },
  {
    id: 'hardware',
    name: 'Hardware Integration',
    icon: <Printer size={20} className="text-gray-500" />,
    description: 'Printers, barcode scanners, and other hardware'
  },
  {
    id: 'security',
    name: 'Security Settings',
    icon: <Shield size={20} className="text-gray-500" />,
    description: 'Security policies and backup options'
  },
  {
    id: 'database',
    name: 'Database & Sync',
    icon: <Database size={20} className="text-gray-500" />,
    description: 'Database configuration and synchronization'
  }
];

const SettingsPage = () => {
  const { user } = useAuthStore();
  const [activeSetting, setActiveSetting] = useState('general');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Settings</h1>
        <p className="text-gray-600">Configure system preferences and options</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings Menu */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-gray-800">Settings Menu</h2>
            </div>
            
            <div className="divide-y divide-gray-100">
              {settingSections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSetting(section.id)}
                  className={`w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors ${
                    activeSetting === section.id ? 'bg-primary-50' : ''
                  }`}
                >
                  <div className="flex items-center">
                    <div className={`${activeSetting === section.id ? 'text-primary-600' : ''}`}>
                      {section.icon}
                    </div>
                    <div className="ml-3 text-left">
                      <p className={`font-medium ${activeSetting === section.id ? 'text-primary-700' : 'text-gray-800'}`}>
                        {section.name}
                      </p>
                      <p className="text-xs text-gray-500">{section.description}</p>
                    </div>
                  </div>
                  <ChevronRight size={16} className={`${activeSetting === section.id ? 'text-primary-600' : 'text-gray-400'}`} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Settings Content */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-gray-800">
                {settingSections.find((s) => s.id === activeSetting)?.name || 'Settings'}
              </h2>
            </div>
            
            {activeSetting === 'general' && (
              <div className="p-6">
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Store Name
                    </label>
                    <input
                      type="text"
                      defaultValue="Main Store"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contact Email
                    </label>
                    <input
                      type="email"
                      defaultValue="info@yourstore.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contact Phone
                    </label>
                    <input
                      type="tel"
                      defaultValue="+91 9876543210"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Currency Format
                    </label>
                    <select
                      defaultValue="inr"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="inr">Indian Rupee (₹)</option>
                      <option value="usd">US Dollar ($)</option>
                      <option value="eur">Euro (€)</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date Format
                    </label>
                    <select
                      defaultValue="dd/mm/yyyy"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="dd/mm/yyyy">DD/MM/YYYY</option>
                      <option value="mm/dd/yyyy">MM/DD/YYYY</option>
                      <option value="yyyy-mm-dd">YYYY-MM-DD</option>
                    </select>
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      id="tax_inclusive"
                      type="checkbox"
                      defaultChecked
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <label htmlFor="tax_inclusive" className="ml-2 block text-sm text-gray-700">
                      Show prices inclusive of tax
                    </label>
                  </div>
                  
                  <div className="pt-4 border-t">
                    <button
                      type="button"
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {activeSetting === 'users' && (
              <div className="p-6">
                <div className="space-y-6">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Email
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Role
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        <tr className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-medium">
                                A
                              </div>
                              <div className="ml-3">
                                <div className="text-sm font-medium text-gray-900">Admin User</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            admin@example.com
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-primary-100 text-primary-800">
                              Admin
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-success-100 text-success-800">
                              Active
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button className="text-primary-600 hover:text-primary-800">
                              Edit
                            </button>
                          </td>
                        </tr>
                        <tr className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-medium">
                                M
                              </div>
                              <div className="ml-3">
                                <div className="text-sm font-medium text-gray-900">Manager User</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            manager@example.com
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-secondary-100 text-secondary-800">
                              Manager
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-success-100 text-success-800">
                              Active
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button className="text-primary-600 hover:text-primary-800">
                              Edit
                            </button>
                          </td>
                        </tr>
                        <tr className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-medium">
                                C
                              </div>
                              <div className="ml-3">
                                <div className="text-sm font-medium text-gray-900">Cashier User</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            cashier@example.com
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                              Cashier
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-success-100 text-success-800">
                              Active
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button className="text-primary-600 hover:text-primary-800">
                              Edit
                            </button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  
                  <div className="pt-4">
                    <button
                      type="button"
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                    >
                      Add New User
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {activeSetting !== 'general' && activeSetting !== 'users' && (
              <div className="p-6">
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 mb-4">
                    <Settings size={32} />
                  </div>
                  <p className="text-gray-700 font-medium mb-2">
                    {settingSections.find((s) => s.id === activeSetting)?.name}
                  </p>
                  <p className="text-gray-500 text-sm mb-4">
                    This settings section is not yet available in the demo version.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;