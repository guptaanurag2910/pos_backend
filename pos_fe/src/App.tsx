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
import InitialDataUploadPage from './pages/InitialDataUploadPage';
import Layout from './components/layout/Layout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AdminRoute from './components/auth/AdminRoute';
import RoleRoute from './components/auth/RoleRoute';
import { Toaster } from 'react-hot-toast';


import ReturnsPage from './pages/ReturnsPage';
import PurchaseRequisitionsPage from './pages/purchase/PurchaseRequisitionsPage';
import PurchaseOrdersPage from './pages/purchase/PurchaseOrdersPage';
import GoodsReceiptPage from './pages/purchase/GoodsReceiptPage';
import SupplierInvoicesPage from './pages/purchase/SupplierInvoicesPage';
import SupplierPaymentsPage from './pages/purchase/SupplierPaymentsPage';

function App() {
  const { isAuthenticated, loadUserFromToken, settings, user } = useAuthStore();
  const { loadProducts } = usePOSStore();
  const isDarkMode = settings.general.theme === 'dark';
  const homePath = user?.role === 'cashier' ? '/billing' : '/dashboard';

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
            <Route index element={<Navigate to={homePath} replace />} />
            <Route
              path="dashboard"
              element={
                <RoleRoute allowedRoles={['admin', 'manager']}>
                  <DashboardPage />
                </RoleRoute>
              }
            />
            <Route
              path="billing"
              element={
                <RoleRoute allowedRoles={['admin', 'manager', 'cashier']}>
                  <BillingPage />
                </RoleRoute>
              }
            />
            <Route
              path="returns"
              element={
                <RoleRoute allowedRoles={['admin', 'manager', 'cashier']}>
                  <ReturnsPage />
                </RoleRoute>
              }
            />
            <Route
              path="inventory"
              element={
                <RoleRoute allowedRoles={['admin', 'manager']}>
                  <InventoryPage />
                </RoleRoute>
              }
            />

             {/* Purchase Management Routes */}
            <Route
              path="purchase/requisitions"
              element={
                <RoleRoute allowedRoles={['admin', 'manager']}>
                  <PurchaseRequisitionsPage />
                </RoleRoute>
              }
            />
            <Route
              path="purchase/orders"
              element={
                <RoleRoute allowedRoles={['admin', 'manager']}>
                  <PurchaseOrdersPage />
                </RoleRoute>
              }
            />
            <Route
              path="purchase/grn"
              element={
                <RoleRoute allowedRoles={['admin', 'manager']}>
                  <GoodsReceiptPage />
                </RoleRoute>
              }
            />
            <Route
              path="purchase/invoices"
              element={
                <RoleRoute allowedRoles={['admin', 'manager']}>
                  <SupplierInvoicesPage />
                </RoleRoute>
              }
            />
            <Route
              path="purchase/payments"
              element={
                <RoleRoute allowedRoles={['admin', 'manager']}>
                  <SupplierPaymentsPage />
                </RoleRoute>
              }
            />


            {/* Legacy purchase invoice route - keeping for backward compatibility */}

            <Route
              path="purchase-orders/:poId"
              element={
                <RoleRoute allowedRoles={['admin', 'manager']}>
                  <PurchaseOrderPage />
                </RoleRoute>
              }
            />
            <Route
              path="purchase-orders"
              element={
                <RoleRoute allowedRoles={['admin', 'manager']}>
                  <PurchaseOrderPage />
                </RoleRoute>
              }
            />
            <Route
              path="grns/:grnId"
              element={
                <RoleRoute allowedRoles={['admin', 'manager']}>
                  <GRNPage />
                </RoleRoute>
              }
            />
            <Route
              path="grns"
              element={
                <RoleRoute allowedRoles={['admin', 'manager']}>
                  <GRNPage />
                </RoleRoute>
              }
            />

            <Route
              path="customers"
              element={
                <RoleRoute allowedRoles={['admin', 'manager']}>
                  <CustomersPage />
                </RoleRoute>
              }
            />
            <Route
              path="reports"
              element={
                <RoleRoute allowedRoles={['admin', 'manager']}>
                  <ReportsPage />
                </RoleRoute>
              }
            />
            <Route
              path="settings"
              element={
                <RoleRoute allowedRoles={['admin']}>
                  <SettingsPage />
                </RoleRoute>
              }
            />
            <Route
              path="initial-upload"
              element={
                <RoleRoute allowedRoles={['admin']}>
                  <InitialDataUploadPage />
                </RoleRoute>
              }
            />
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
