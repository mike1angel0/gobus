import { Outlet } from 'react-router-dom';
import { Navbar } from './navbar';
import { Toaster } from '@/components/ui/toaster';
import { ErrorBoundary } from '@/components/error/error-boundary';

/**
 * Application layout that wraps all pages with the Navbar and toast notifications.
 * Used as a layout route element in the router to provide consistent page structure.
 * An {@link ErrorBoundary} wraps the page outlet so a single page crash does not break the app.
 */
export function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
      <Toaster />
    </div>
  );
}
