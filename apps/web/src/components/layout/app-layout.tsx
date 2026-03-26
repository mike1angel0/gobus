import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Navbar } from './navbar';
import { Toaster } from '@/components/ui/toaster';
import { ErrorBoundary } from '@/components/error/error-boundary';

/**
 * Application layout that wraps all pages with the Navbar and toast notifications.
 * Used as a layout route element in the router to provide consistent page structure.
 * An {@link ErrorBoundary} wraps the page outlet so a single page crash does not break the app.
 * Includes a skip-to-content link for keyboard accessibility (WCAG 2.1 AA).
 */
export function AppLayout() {
  const { t } = useTranslation('nav');

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-md focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        {t('a11y.skipToContent')}
      </a>
      <Navbar />
      <main id="main-content" className="flex-1">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
      <Toaster />
    </div>
  );
}
