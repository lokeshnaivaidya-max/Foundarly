import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { isUserAdmin, isSuperAdmin, UserRole, getUserEffectiveRole } from '@/lib/authorization';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/PageLoader';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireSuperAdmin?: boolean;
  allowedRoles?: UserRole[];
}

export default function ProtectedRoute({ 
  children, 
  requireAdmin = false,
  requireSuperAdmin = false,
  allowedRoles
}: ProtectedRouteProps) {
  const { user, profile, isAdmin, isSuperAdmin: authIsSuperAdmin, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (loading) {
    return <PageLoader text="Authenticating..." />;
  }

  // Not authenticated at all
  if (!user) {
    if (requireAdmin || requireSuperAdmin) {
      return <Navigate to="/admin/login" replace state={{ from: location }} />;
    }
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const effectiveIsSuper = Boolean(authIsSuperAdmin || isSuperAdmin(user, profile));
  const effectiveIsAdmin = Boolean(isAdmin || isUserAdmin(user, profile));

  // 1. Strict Super Admin requirement
  if (requireSuperAdmin) {
    if (!effectiveIsSuper) {
      if (effectiveIsAdmin) {
        // Authenticated as Developer Admin, but section requires Super Admin
        return (
          <div className="min-h-[70vh] flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-card border border-destructive/30 rounded-xl p-8 text-center space-y-4 shadow-xl">
              <div className="w-14 h-14 rounded-full bg-destructive/15 text-destructive flex items-center justify-center mx-auto">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-display font-bold text-foreground">
                Super Admin Privileges Required
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                You are currently signed in as a <span className="font-semibold text-sky-400">Developer Admin</span>. 
                This operational section involves sensitive executive, financial, or user security controls reserved exclusively for <span className="font-semibold text-amber-400">Super Administrators</span>.
              </p>
              <div className="pt-2 flex flex-col gap-2">
                <Button 
                  onClick={() => navigate('/admin/developer')} 
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Go to Developer Portal
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => navigate(-1)} 
                  className="w-full"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Go Back
                </Button>
              </div>
            </div>
          </div>
        );
      }

      // Non-admin user attempting access
      return <Navigate to="/my-bookings" replace state={{ accessDenied: true, from: location }} />;
    }
    return <>{children}</>;
  }

  // 2. General Admin requirement (Super Admin or Developer Admin)
  if (requireAdmin) {
    if (!effectiveIsAdmin) {
      return <Navigate to="/my-bookings" replace state={{ accessDenied: true, from: location }} />;
    }
    return <>{children}</>;
  }

  // 3. Specific allowed roles check
  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = getUserEffectiveRole(user, profile);
    const hasAllowedRole = allowedRoles.includes(userRole) || 
      (allowedRoles.includes('admin') && effectiveIsAdmin) ||
      (allowedRoles.includes('super_admin') && effectiveIsSuper);

    if (!hasAllowedRole) {
      if (effectiveIsSuper) {
        return <Navigate to="/admin" replace />;
      }
      if (effectiveIsAdmin) {
        return <Navigate to="/admin/developer" replace />;
      }
      if (userRole === 'consultant') {
        return <Navigate to="/consultant/dashboard" replace />;
      }
      return <Navigate to="/my-bookings" replace />;
    }
  }

  return <>{children}</>;
}
