import { useMemo } from 'react';
import { apiClient } from '@/api/client';

/**
 * Returns the singleton typed API client.
 *
 * This hook exists so components can obtain the client via React's dependency
 * injection pattern, making it easy to swap or mock in tests.
 *
 * @returns The pre-configured `openapi-fetch` client with auth middleware.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const client = useApiClient();
 *   // client.GET('/api/v1/auth/me') — fully typed
 * }
 * ```
 */
export function useApiClient() {
  return useMemo(() => apiClient, []);
}
