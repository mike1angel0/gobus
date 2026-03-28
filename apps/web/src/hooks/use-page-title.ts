import { useEffect } from 'react';

const APP_NAME = 'GoBus';

/**
 * Sets the document title on mount and reverts to the app name on unmount.
 *
 * @param title - The page-specific title segment (e.g. "Search"). Will be displayed as "Search | GoBus".
 */
export function usePageTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} | ${APP_NAME}`;

    return () => {
      document.title = APP_NAME;
    };
  }, [title]);
}
