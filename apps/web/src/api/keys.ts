/**
 * Query key factories for TanStack React Query.
 *
 * Each factory produces structured, hierarchical keys that enable efficient
 * cache invalidation at any granularity level. Use `.all` to invalidate
 * everything for a resource, `.lists()` for filtered lists, or `.detail(id)`
 * for a single record.
 *
 * @example
 * ```ts
 * // Invalidate all routes
 * queryClient.invalidateQueries({ queryKey: routeKeys.all });
 *
 * // Invalidate a specific route detail
 * queryClient.invalidateQueries({ queryKey: routeKeys.detail('abc-123') });
 * ```
 *
 * @module
 */

/**
 * Creates a standard query key factory for a given resource scope.
 *
 * @param scope - The top-level resource name (e.g. `'routes'`).
 * @returns An object with `.all`, `.lists(filters?)`, and `.detail(id)` helpers.
 */
function createKeys<TFilters = Record<string, unknown>>(scope: string) {
  return {
    /** Matches all queries for this resource (broadest invalidation). */
    all: [scope] as const,
    /** Matches all list queries, optionally narrowed by filters. */
    lists: (filters?: TFilters) =>
      filters ? ([scope, 'list', filters] as const) : ([scope, 'list'] as const),
    /** Matches a single resource detail by ID. */
    detail: (id: string) => [scope, 'detail', id] as const,
  };
}

/** Query keys for authentication-related queries (current user profile). */
export const authKeys = {
  all: ['auth'] as const,
  /** Key for the current user's profile (`GET /auth/me`). */
  me: () => ['auth', 'me'] as const,
};

/** Query keys for route resources (`/routes`). */
export const routeKeys = createKeys<{ providerId?: string; page?: number; pageSize?: number }>(
  'routes',
);

/** Query keys for bus/fleet resources (`/buses`). */
export const busKeys = createKeys<{
  providerId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}>('buses');

/** Query keys for schedule resources (`/schedules`). */
export const scheduleKeys = createKeys<{
  routeId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}>('schedules');

/** Query keys for booking resources (`/bookings`). */
export const bookingKeys = createKeys<{ status?: string; page?: number; pageSize?: number }>(
  'bookings',
);

/** Query keys for live tracking resources (`/tracking`). */
export const trackingKeys = {
  all: ['tracking'] as const,
  /** Matches all tracking list queries, optionally narrowed by filters. */
  lists: (filters?: { busId?: string }) =>
    filters ? (['tracking', 'list', filters] as const) : (['tracking', 'list'] as const),
  /** Matches a specific bus's tracking data by bus ID. */
  detail: (busId: string) => ['tracking', 'detail', busId] as const,
};

/** Query keys for search resources (`/search`, `/trips`, `/cities`). */
export const searchKeys = {
  all: ['search'] as const,
  /** Matches search result queries, optionally narrowed by search filters. */
  lists: (filters?: { from?: string; to?: string; date?: string; passengers?: number }) =>
    filters ? (['search', 'list', filters] as const) : (['search', 'list'] as const),
  /** Matches a specific trip detail by schedule ID. */
  detail: (scheduleId: string) => ['search', 'detail', scheduleId] as const,
  /** Matches the cities list query. */
  cities: () => ['search', 'cities'] as const,
};

/** Query keys for driver resources (`/drivers`). */
export const driverKeys = createKeys<{ providerId?: string; page?: number; pageSize?: number }>(
  'drivers',
);

/** Query keys for delay resources (`/delays`). */
export const delayKeys = createKeys<{
  scheduleId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}>('delays');

/** Query keys for station resources (`/stations`). */
export const stationKeys = createKeys<{ search?: string; page?: number; pageSize?: number }>(
  'stations',
);

/** Query keys for admin resources (`/admin/*`). */
export const adminKeys = {
  all: ['admin'] as const,
  /** Matches admin bus list queries. */
  buses: (filters?: { page?: number; pageSize?: number }) =>
    filters ? (['admin', 'buses', filters] as const) : (['admin', 'buses'] as const),
  /** Matches admin user list queries. */
  users: (filters?: { role?: string; status?: string; page?: number; pageSize?: number }) =>
    filters ? (['admin', 'users', filters] as const) : (['admin', 'users'] as const),
  /** Matches a specific user's detail by ID. */
  userDetail: (id: string) => ['admin', 'users', 'detail', id] as const,
  /** Matches a specific user's sessions. */
  userSessions: (id: string) => ['admin', 'users', 'sessions', id] as const,
  /** Matches admin station list queries. */
  stations: (filters?: {
    type?: string;
    city?: string;
    isActive?: boolean;
    search?: string;
    page?: number;
    pageSize?: number;
  }) =>
    filters ? (['admin', 'stations', filters] as const) : (['admin', 'stations'] as const),
  /** Matches a specific station's detail by ID. */
  stationDetail: (id: string) => ['admin', 'stations', 'detail', id] as const,
  /** Matches admin audit log queries. */
  auditLogs: (filters?: {
    page?: number;
    pageSize?: number;
    userId?: string;
    action?: string;
    dateFrom?: string;
    dateTo?: string;
  }) =>
    filters ? (['admin', 'audit-logs', filters] as const) : (['admin', 'audit-logs'] as const),
};

/** Query keys for the authenticated provider's own profile (`/providers/me`). */
export const providerProfileKeys = {
  all: ['provider-profile'] as const,
  /** Key for the provider's own profile (`GET /providers/me`). */
  me: () => ['provider-profile', 'me'] as const,
};

/** Query keys for provider analytics (`/provider/analytics`). */
export const providerAnalyticsKeys = {
  all: ['provider-analytics'] as const,
  /** Key for the provider analytics query (`GET /provider/analytics`). */
  analytics: () => ['provider-analytics', 'analytics'] as const,
};

/** Query keys for driver trip resources (`/driver/trips`). */
export const driverTripKeys = {
  all: ['driver-trips'] as const,
  /** Matches driver trip list queries. */
  lists: (filters?: { date?: string; page?: number; pageSize?: number }) =>
    filters ? (['driver-trips', 'list', filters] as const) : (['driver-trips', 'list'] as const),
  /** Matches a specific driver trip detail by schedule ID. */
  detail: (scheduleId: string) => ['driver-trips', 'detail', scheduleId] as const,
  /** Matches a specific driver trip's passenger list. */
  passengers: (scheduleId: string, date?: string) =>
    date
      ? (['driver-trips', 'passengers', scheduleId, date] as const)
      : (['driver-trips', 'passengers', scheduleId] as const),
};
