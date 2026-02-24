import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

interface RoleRouteProps {
  children: ReactNode;
  allowedRoles: Array<'admin' | 'manager' | 'cashier'>;
}

const RoleRoute = ({ children, allowedRoles }: RoleRouteProps) => {
  const { user, isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!user || !allowedRoles.includes(user.role as 'admin' | 'manager' | 'cashier')) {
    const fallback = user?.role === 'cashier' ? '/billing' : '/dashboard';
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
};

export default RoleRoute;
