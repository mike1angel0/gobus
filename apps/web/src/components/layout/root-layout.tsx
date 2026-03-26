import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { AuthProvider } from '@/contexts/auth-context';
import { AppQueryProvider } from '@/providers/query-provider';

/**
 * Root layout that wraps the entire app with providers and Suspense.
 * Providers live here so they have access to the router context.
 */
export function RootLayout() {
  return (
    <AppQueryProvider>
      <AuthProvider>
        <Suspense fallback={null}>
          <Outlet />
        </Suspense>
      </AuthProvider>
    </AppQueryProvider>
  );
}
