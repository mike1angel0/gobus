import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './query-client';

/** Props for {@link AppQueryProvider}. */
interface AppQueryProviderProps {
  /** Child elements to render inside the provider. */
  children: ReactNode;
  /** Optional custom QueryClient (useful for testing). */
  client?: QueryClient;
}

/**
 * Wraps children in a TanStack QueryClientProvider with the application's
 * default QueryClient configuration.
 *
 * @example
 * ```tsx
 * <AppQueryProvider>
 *   <App />
 * </AppQueryProvider>
 * ```
 */
export function AppQueryProvider({ children, client }: AppQueryProviderProps) {
  return <QueryClientProvider client={client ?? queryClient}>{children}</QueryClientProvider>;
}
