import { usePageTitle } from '@/hooks/use-page-title';

/**
 * Temporary placeholder page displayed for routes not yet implemented.
 * Will be replaced with actual page components in later tasks.
 */
export default function PlaceholderPage() {
  usePageTitle('Coming Soon');

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="glass-card p-8 text-center">
        <h1 className="mb-2 text-2xl font-bold text-white">Coming Soon</h1>
        <p className="text-dark-300">This page is under construction.</p>
      </div>
    </div>
  );
}
