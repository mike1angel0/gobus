import { useContext } from 'react';
import { AuthContext, type AuthContextValue } from '@/contexts/auth-types';

/**
 * Returns authentication state and actions from the nearest {@link AuthProvider}.
 *
 * Provides the current user, auth status, and methods for login, register,
 * logout, password change, forgot/reset password.
 *
 * @throws {Error} If used outside of an `AuthProvider`.
 *
 * @example
 * ```tsx
 * function Dashboard() {
 *   const { user, isAuthenticated, logout } = useAuth();
 *   if (!isAuthenticated) return <Navigate to="/auth/login" />;
 *   return <p>Hello, {user?.name}</p>;
 * }
 * ```
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
