import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '@/api/hooks';
import { providerProfileKeys } from '@/api/keys';

/**
 * React Query hook that fetches the authenticated provider's own profile.
 *
 * Calls `GET /api/v1/providers/me` using the typed API client.
 * The query uses a 60-second stale time since provider profile data changes infrequently.
 *
 * @returns A React Query result with the provider profile data.
 *
 * @example
 * ```tsx
 * const { data, isLoading, isError, refetch } = useProviderProfile();
 * const provider = data?.data;
 * ```
 */
export function useProviderProfile() {
  const client = useApiClient();

  return useQuery({
    queryKey: providerProfileKeys.me(),
    queryFn: async () => {
      const { data } = await client.GET('/api/v1/providers/me');
      return data;
    },
    staleTime: 60 * 1000,
  });
}
