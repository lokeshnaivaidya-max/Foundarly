import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  allowedRoles?: ('admin' | 'client' | 'consultant')[];
}

export default function ProtectedRoute({ 
  children, 
  requireAdmin = false,
  allowedRoles
}: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (requireAdmin) {
    const isAuthorized = user && profile?.role === 'admin';

    if (!isAuthorized) {
      return <Navigate to="/admin/login" replace state={{ from: location }} />;
    }

    return <>{children}</>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Check allowed roles list
  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = profile?.role || (profile?.is_consultant ? 'consultant' : 'client');
    if (!allowedRoles.includes(userRole as any)) {
      if (userRole === 'admin') {
        return <Navigate to="/admin" replace />;
      }
      if (userRole === 'consultant') {
        return <Navigate to="/consultant/dashboard" replace />;
      }
      return <Navigate to="/my-bookings" replace />;
    }
  }

  return <>{children}</>;
}
