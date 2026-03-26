import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorFallbackProps {
  /** Error message to display. Defaults to a generic message. */
  message?: string;
  /** Callback invoked when the user clicks the retry button. */
  onRetry?: () => void;
}

/**
 * Generic error display with an icon, message, and optional retry button.
 * Used as the fallback UI inside error boundaries and for manual error states.
 */
export function ErrorFallback({
  message = 'Something went wrong. Please try again.',
  onRetry,
}: ErrorFallbackProps) {
  return (
    <div className="flex flex-col items-center py-16 text-center" role="alert">
      <AlertCircle className="mb-4 h-16 w-16 text-destructive" aria-hidden="true" />
      <h2 className="mb-2 text-xl font-semibold">Error</h2>
      <p className="mb-6 max-w-md text-muted-foreground">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline">
          Try again
        </Button>
      )}
    </div>
  );
}
