import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Props for the {@link PageError} component. */
export interface PageErrorProps {
  /** Heading displayed above the message. Defaults to "Something went wrong". */
  title?: string;
  /** Descriptive message shown below the heading. */
  message?: string;
  /** Callback invoked when the user clicks the retry button. */
  onRetry: () => void;
}

/**
 * Full-width centred error state with icon, heading, message, and retry button.
 *
 * Used as the standard error UI across all pages and data-fetching sections.
 * Includes `role="alert"` so screen readers announce the error immediately.
 *
 * @example
 * ```tsx
 * <PageError
 *   title="Failed to load fleet"
 *   message="We couldn't load your buses. Please try again."
 *   onRetry={() => busesQuery.refetch()}
 * />
 * ```
 */
export function PageError({
  title = 'Something went wrong',
  message = 'An unexpected error occurred. Please try again.',
  onRetry,
}: PageErrorProps) {
  return (
    <div className="flex flex-col items-center py-16 text-center" role="alert">
      <AlertCircle className="mb-4 h-16 w-16 text-destructive" aria-hidden="true" />
      <h2 className="mb-2 text-xl font-semibold">{title}</h2>
      <p className="mb-6 max-w-md text-muted-foreground">{message}</p>
      <Button onClick={onRetry} variant="outline">
        Try again
      </Button>
    </div>
  );
}
