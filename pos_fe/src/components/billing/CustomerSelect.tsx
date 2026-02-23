import { useState, useEffect, useRef } from 'react';
import { Users, Loader, X, Plus } from 'lucide-react';
import { Customer } from '../../types';
import { customerService } from '../../service/customerService';
import CreateCustomerModal from './CreateCustomerModal'; // Ensure this component exists

interface CustomerSelectProps {
  selectedCustomerId?: string;
  selectedCustomerName?: string;
  onSelectCustomer: (customer: Customer | null) => void;
}

const CustomerSelect = ({
  selectedCustomerId,
  selectedCustomerName,
  onSelectCustomer,
}: CustomerSelectProps) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<Customer[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleSearch = async () => {
      if (query.trim().length === 0) {
        setResults([]);
        setIsOpen(false);
        return;
      }

      setIsLoading(true);
      try {
        const response = await customerService.list({ search: query });
        const searchResults = response.results || [];
        setResults(searchResults);
        setIsOpen(true);
      } catch (error) {
        console.error('Error searching customers:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const timer = setTimeout(handleSearch, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelectCustomer = (customer: Customer) => {
    onSelectCustomer(customer);
    setQuery('');
    setIsOpen(false);
  };

  const handleCustomerCreated = (customer: Customer) => {
    onSelectCustomer(customer);
    setShowCreateModal(false);
    setQuery('');
    setIsOpen(false);
  };

  const clearSelectedCustomer = () => {
    onSelectCustomer(null);
  };

  return (
    <div ref={searchRef} className="relative">
      {selectedCustomerId ? (
        <div className="flex items-center justify-between p-2 border border-gray-300 rounded-lg bg-gray-50">
          <div className="flex items-center">
            <div className="bg-primary-100 h-8 w-8 rounded-full flex items-center justify-center text-primary-600 mr-2">
              {selectedCustomerName?.charAt(0) || 'C'}
            </div>
            <div>
              <p className="text-sm font-medium">{selectedCustomerName}</p>
            </div>
          </div>
          <button onClick={clearSelectedCustomer} className="p-1 rounded-full hover:bg-gray-200">
            <X size={16} className="text-gray-500" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            {isLoading ? (
              <Loader size={18} className="text-gray-400 animate-spin" />
            ) : (
              <Users size={18} className="text-gray-400" />
            )}
          </div>

          <input
            type="text"
            placeholder="Search customer by name or phone..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
      )}

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white rounded-md shadow-lg max-h-60 overflow-y-auto">
          <ul className="py-1">
            {results.map((customer) => (
              <li
                key={customer.id}
                onClick={() => handleSelectCustomer(customer)}
                className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{customer.name}</p>
                    <p className="text-xs text-gray-500">
                      {customer.phone} • Points: {customer.loyaltyPoints}
                    </p>
                  </div>
                  <button
                    className="p-1 bg-primary-100 text-primary-600 rounded-full hover:bg-primary-200"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectCustomer(customer);
                    }}
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </li>
            ))}

            {results.length === 0 && query.length >= 5 && (
              <li className="px-4 py-2 text-sm text-gray-500">
                No customers found.
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="ml-2 text-primary-600 font-medium underline"
                >
                  Create New Customer
                </button>
              </li>
            )}
          </ul>
        </div>
      )}

      {showCreateModal && (
        <CreateCustomerModal
          phone={query}
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCustomerCreated}
        />
      )}
    </div>
  );
};

export default CustomerSelect;
