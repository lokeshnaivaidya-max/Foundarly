import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { isUserAdmin } from '@/lib/authorization';

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
    // Defense-in-depth: Must be authenticated AND have verified admin authorization
    const isAuthorized = Boolean(user && isUserAdmin(user, profile));

    if (!user) {
      // Unauthenticated user -> redirect to admin login
      return <Navigate to="/admin/login" replace state={{ from: location }} />;
    }

    if (!isAuthorized) {
      // Authenticated normal user attempting to access /admin -> access denied, redirect to client portal
      return <Navigate to="/my-bookings" replace state={{ accessDenied: true, from: location }} />;
    }

    return <>{children}</>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Check allowed roles list
  if (allowedRoles && allowedRoles.length > 0) {
    const isCurrentAdmin = isUserAdmin(user, profile);
    const userRole: 'admin' | 'consultant' | 'client' = isCurrentAdmin
      ? 'admin'
      : (profile?.role === 'consultant' || profile?.is_consultant)
        ? 'consultant'
        : 'client';

    if (!allowedRoles.includes(userRole)) {
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
