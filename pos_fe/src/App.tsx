import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { usePOSStore } from './stores/posStore';
import LoginPage from './pages/LoginPage';
// import SignupPage from './pages/SignupPage';
import DashboardPage from './pages/DashboardPage';
import BillingPage from './pages/BillingPage';
import InventoryPage from './pages/InventoryPage';
import PurchaseOrderPage from './pages/PurchaseOrderPage';
import GRNPage from './pages/GRNPage';
import CustomersPage from './pages/CustomersPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import UsersPage from './pages/UsersPage';
import Layout from './components/layout/Layout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AdminRoute from './components/auth/AdminRoute';
import { Toaster } from 'react-hot-toast';


import ReturnsPage from './pages/ReturnsPage';
import PurchaseRequisitionsPage from './pages/purchase/PurchaseRequisitionsPage';
import PurchaseOrdersPage from './pages/purchase/PurchaseOrdersPage';
import GoodsReceiptPage from './pages/purchase/GoodsReceiptPage';
import SupplierInvoicesPage from './pages/purchase/SupplierInvoicesPage';
import SupplierPaymentsPage from './pages/purchase/SupplierPaymentsPage';

function App() {
  const { isAuthenticated, loadUserFromToken, settings } = useAuthStore();
  const { loadProducts } = usePOSStore();
  const isDarkMode = settings.general.theme === 'dark';

  useEffect(() => {
    loadUserFromToken();
  }, [loadUserFromToken]);

  useEffect(() => {
    if (isAuthenticated) {
      loadProducts();
    }
  }, [isAuthenticated, loadProducts]);

  return (
    <div className={isDarkMode ? 'dark' : ''}>
      <Router>
        {/* ✅ Toaster should be placed OUTSIDE Routes */}
        <Toaster position="top-right" />

        <Routes>
          <Route path="/login" element={<LoginPage />} />
          {/* <Route path="/signup" element={<SignupPage />} /> */}

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="billing" element={<BillingPage />} />
            <Route path="returns" element={<ReturnsPage />} />
            <Route path="inventory" element={<InventoryPage />} />

             {/* Purchase Management Routes */}
            <Route path="purchase/requisitions" element={<PurchaseRequisitionsPage />} />
            <Route path="purchase/orders" element={<PurchaseOrdersPage />} />
            <Route path="purchase/grn" element={<GoodsReceiptPage />} />
            <Route path="purchase/invoices" element={<SupplierInvoicesPage />} />
            <Route path="purchase/payments" element={<SupplierPaymentsPage />} />


            {/* Legacy purchase invoice route - keeping for backward compatibility */}

            <Route path="purchase-orders/:poId" element={<PurchaseOrderPage />} />
            <Route path="purchase-orders" element={<PurchaseOrderPage />} />
            <Route path="grns/:grnId" element={<GRNPage />} />
            <Route path="grns" element={<GRNPage />} />

            <Route path="customers" element={<CustomersPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route
              path="users"
              element={
                <AdminRoute>
                  <UsersPage />
                </AdminRoute>
              }
            />
          </Route>
        </Routes>
      </Router>
    </div>
  );
}

export default App;
