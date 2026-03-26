import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { AuthProvider } from '@/contexts/auth-context';
import { AppQueryProvider } from '@/providers/query-provider';
import i18n from '@/i18n/config';

/**
 * Root layout that wraps the entire app with providers and Suspense.
 * Providers live here so they have access to the router context.
 * I18nextProvider supplies the i18n instance to all child components.
 */
export function RootLayout() {
  return (
    <I18nextProvider i18n={i18n}>
      <AppQueryProvider>
        <AuthProvider>
          <Suspense fallback={null}>
            <Outlet />
          </Suspense>
        </AuthProvider>
      </AppQueryProvider>
    </I18nextProvider>
  );
}
