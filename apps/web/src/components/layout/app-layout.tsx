import { Outlet } from 'react-router-dom';
import { Navbar } from './navbar';
import { Toaster } from '@/components/ui/toaster';

/**
 * Application layout that wraps all pages with the Navbar and toast notifications.
 * Used as a layout route element in the router to provide consistent page structure.
 */
export function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Toaster />
    </div>
  );
}
