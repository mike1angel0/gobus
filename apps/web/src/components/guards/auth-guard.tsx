import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

/**
 * Route guard that requires authentication.
 *
 * Renders child routes via `<Outlet />` if the user is authenticated.
 * Redirects unauthenticated users to `/auth/login` with a `from` state
 * so they can be returned after login.
 *
 * While auth status is loading, renders nothing to prevent flash of
 * protected content.
 */
export function AuthGuard() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location.pathname }} replace />;
  }

  return <Outlet />;
}
