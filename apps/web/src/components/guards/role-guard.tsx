import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import type { User } from '@/contexts/auth-types';

/** Props for {@link RoleGuard}. */
interface RoleGuardProps {
  /** Roles allowed to access the guarded routes. */
  allowedRoles: ReadonlyArray<User['role']>;
}

/**
 * Route guard that restricts access by user role.
 *
 * Must be nested inside an {@link AuthGuard} (assumes user is authenticated).
 * Renders child routes via `<Outlet />` if the user's role is in `allowedRoles`.
 * Redirects to `/` if the role does not match.
 */
export function RoleGuard({ allowedRoles }: RoleGuardProps) {
  const { user } = useAuth();

  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
