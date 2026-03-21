import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Users, 
  BarChart2, 
  Settings,
  Menu, 
  X,
  Wallet,
  UserPlus,
  ShoppingBag,
  Truck,
  Receipt,
  CreditCard,
  UploadCloud,
  ChevronDown,
  ChevronRight,
  RotateCcw
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { canShowSidebarTab } from '../../config/roleTabs';

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick?: () => void;
}

const NavItem = ({ to, icon, label, active, onClick }: NavItemProps) => {
  return (
    <Link
      to={to}
      className={`flex items-center p-3 rounded-lg transition-colors ${
        active
          ? 'bg-primary-600 text-white dark:bg-primary-500'
          : 'text-gray-600 dark:text-gray-300 hover:bg-primary-50 dark:hover:bg-primary-900/50 hover:text-primary-600 dark:hover:text-primary-400'
      }`}
      onClick={onClick}
    >
      <span className="mr-3">{icon}</span>
      <span className="font-medium">{label}</span>
    </Link>
  );
};

interface NavGroupProps {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
}

const NavGroup = ({ label, icon, children, isOpen, onToggle }: NavGroupProps) => {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-primary-50 dark:hover:bg-primary-900/50 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
      >
        <div className="flex items-center">
          <span className="mr-3">{icon}</span>
          <span className="font-medium">{label}</span>
        </div>
        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      {isOpen && (
        <div className="ml-6 mt-2 space-y-1">
          {children}
        </div>
      )}
    </div>
  );
};

const Sidebar = () => {
  const location = useLocation();
  const { user } = useAuthStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isPurchaseOpen, setIsPurchaseOpen] = useState(
    location.pathname.startsWith('/purchase')
  );

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const isActive = (path: string) => location.pathname === path;
  const role = user?.role;
  const canSeeDashboard = canShowSidebarTab(role, 'dashboard');
  const canSeeBilling = canShowSidebarTab(role, 'billing');
  const canSeeReturns = canShowSidebarTab(role, 'returns');
  const canSeeInventory = canShowSidebarTab(role, 'inventory');
  const canSeePurchase = canShowSidebarTab(role, 'purchase');
  const canSeeCustomers = canShowSidebarTab(role, 'customers');
  const canSeeReports = canShowSidebarTab(role, 'reports');
  const canSeeInitialUpload = canShowSidebarTab(role, 'initialUpload');
  const canSeeUsers = canShowSidebarTab(role, 'users');
  const canSeeSettings = canShowSidebarTab(role, 'settings');

  return (
    <>
      {/* Mobile menu button */}
      <div className="fixed top-0 left-0 z-20 p-4 md:hidden">
        <button
          onClick={toggleMobileMenu}
          className="p-2 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          <Menu size={24} />
        </button>
      </div>

      {/* Sidebar - Desktop & Mobile */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 bg-white dark:bg-gray-800 shadow-lg transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <Wallet className="text-primary-600 dark:text-primary-400" size={28} />
            <div>
              <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">BillSathi</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">{user?.role.toUpperCase()}</p>
            </div>
          </div>
          
          {/* Close button for mobile */}
          <button
            onClick={closeMobileMenu}
            className="p-1 text-gray-500 dark:text-gray-400 md:hidden"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="p-4 space-y-2 overflow-y-auto h-full">
          {canSeeDashboard && (
            <NavItem
              to="/dashboard"
              icon={<LayoutDashboard size={20} />}
              label="Dashboard"
              active={isActive('/dashboard')}
              onClick={closeMobileMenu}
            />
          )}
          {canSeeBilling && (
            <NavItem
              to="/billing"
              icon={<ShoppingCart size={20} />}
              label="Billing"
              active={isActive('/billing')}
              onClick={closeMobileMenu}
            />
          )}
          {canSeeReturns && (
            <NavItem
              to="/returns"
              icon={<RotateCcw size={20} />}
              label="Returns & Refunds"
              active={isActive('/returns')}
              onClick={closeMobileMenu}
            />
          )}
          {canSeeInventory && (
            <NavItem
              to="/inventory"
              icon={<Package size={20} />}
              label="Inventory"
              active={isActive('/inventory')}
              onClick={closeMobileMenu}
            />
          )}


          {/* Purchase Management Group */}
          {canSeePurchase && (
            <NavGroup
              label="Purchase Management"
              icon={<ShoppingBag size={20} />}
              isOpen={isPurchaseOpen}
              onToggle={() => setIsPurchaseOpen(!isPurchaseOpen)}
            >
              <NavItem
                to="/purchase/orders"
                icon={<ShoppingBag size={16} />}
                label="Purchase Orders"
                active={isActive('/purchase/orders')}
                onClick={closeMobileMenu}
              />
              <NavItem
                to="/purchase/grn"
                icon={<Truck size={16} />}
                label="Goods Receipt"
                active={isActive('/purchase/grn')}
                onClick={closeMobileMenu}
              />
              <NavItem
                to="/purchase/invoices"
                icon={<Receipt size={16} />}
                label="Supplier Invoices"
                active={isActive('/purchase/invoices')}
                onClick={closeMobileMenu}
              />
              <NavItem
                to="/purchase/payments"
                icon={<CreditCard size={16} />}
                label="Payments"
                active={isActive('/purchase/payments')}
                onClick={closeMobileMenu}
              />
            </NavGroup>
          )}

          
          {canSeeCustomers && (
            <NavItem
              to="/customers"
              icon={<Users size={20} />}
              label="Customers"
              active={isActive('/customers')}
              onClick={closeMobileMenu}
            />
          )}
          {canSeeReports && (
            <NavItem
              to="/reports"
              icon={<BarChart2 size={20} />}
              label="Reports"
              active={isActive('/reports')}
              onClick={closeMobileMenu}
            />
          )}
          {canSeeInitialUpload && (
            <NavItem
              to="/initial-upload"
              icon={<UploadCloud size={20} />}
              label="Initial Upload"
              active={isActive('/initial-upload')}
              onClick={closeMobileMenu}
            />
          )}
          {canSeeUsers && (
            <NavItem
              to="/users"
              icon={<UserPlus size={20} />}
              label="Users"
              active={isActive('/users')}
              onClick={closeMobileMenu}
            />
          )}
          {canSeeSettings && (
            <NavItem
              to="/settings"
              icon={<Settings size={20} />}
              label="Settings"
              active={isActive('/settings')}
              onClick={closeMobileMenu}
            />
          )}
        </nav>

      </aside>

      {/* Overlay for mobile */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
          onClick={closeMobileMenu}
        />
      )}
    </>
  );
};

export default Sidebar;
