import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '@/api/hooks';
import { providerAnalyticsKeys } from '@/api/keys';

/**
 * React Query hook that fetches analytics data for the authenticated provider.
 *
 * Calls `GET /api/v1/provider/analytics` using the typed API client.
 * Returns totalBookings, totalRevenue, averageOccupancy, and revenueByRoute.
 * Uses a 60-second stale time since analytics data changes infrequently.
 *
 * @returns A React Query result with the provider analytics data.
 *
 * @example
 * ```tsx
 * const { data, isLoading, isError, refetch } = useProviderAnalytics();
 * const analytics = data?.data;
 * ```
 */
export function useProviderAnalytics() {
  const client = useApiClient();

  return useQuery({
    queryKey: providerAnalyticsKeys.analytics(),
    queryFn: async () => {
      const { data } = await client.GET('/api/v1/provider/analytics');
      return data;
    },
    staleTime: 60 * 1000,
  });
}
