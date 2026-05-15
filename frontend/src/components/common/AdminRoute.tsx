import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

export function AdminRoute() {
  const isAdmin = useAuthStore((s) => s.isAdmin);
  if (!isAdmin) {
    return <Navigate to="/gallery" replace />;
  }
  return <Outlet />;
}
