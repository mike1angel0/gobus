import { FileQuestion } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

/**
 * 404 page shown when no route matches the current URL.
 * Includes a link back to the home page.
 */
export function NotFound() {
  return (
    <div className="flex flex-col items-center py-16 text-center" role="alert">
      <FileQuestion className="mb-4 h-16 w-16 text-muted-foreground" aria-hidden="true" />
      <h1 className="mb-2 text-3xl font-bold">Page not found</h1>
      <p className="mb-6 max-w-md text-muted-foreground">
        The page you are looking for does not exist or has been moved.
      </p>
      <Button asChild>
        <Link to="/">Go home</Link>
      </Button>
    </div>
  );
}

/** Default export for lazy-loading via React Router. */
export default NotFound;
