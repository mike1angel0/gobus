import { FileQuestion } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

/**
 * 404 page shown when no route matches the current URL.
 * Includes a link back to the home page.
 */
export function NotFound() {
  const { t } = useTranslation('common');

  return (
    <div className="flex flex-col items-center py-16 text-center" role="alert">
      <FileQuestion className="mb-4 h-16 w-16 text-muted-foreground" aria-hidden="true" />
      <h1 className="mb-2 text-3xl font-bold">{t('errors.pageNotFound')}</h1>
      <p className="mb-6 max-w-md text-muted-foreground">
        {t('errors.pageNotFoundDescription')}
      </p>
      <Button asChild>
        <Link to="/">{t('errors.goHome')}</Link>
      </Button>
    </div>
  );
}

/** Default export for lazy-loading via React Router. */
export default NotFound;
