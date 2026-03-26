import { AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

interface ErrorFallbackProps {
  /** Error message to display. Defaults to a translated generic message. */
  message?: string;
  /** Callback invoked when the user clicks the retry button. */
  onRetry?: () => void;
}

/**
 * Generic error display with an icon, message, and optional retry button.
 * Used as the fallback UI inside error boundaries and for manual error states.
 */
export function ErrorFallback({ message, onRetry }: ErrorFallbackProps) {
  const { t } = useTranslation('common');

  return (
    <div className="flex flex-col items-center py-16 text-center" role="alert">
      <AlertCircle className="mb-4 h-16 w-16 text-destructive" aria-hidden="true" />
      <h2 className="mb-2 text-xl font-semibold">{t('errors.errorHeading')}</h2>
      <p className="mb-6 max-w-md text-muted-foreground">
        {message ?? t('errors.somethingWentWrongDefault')}
      </p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline">
          {t('buttons.retry')}
        </Button>
      )}
    </div>
  );
}
