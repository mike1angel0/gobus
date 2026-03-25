/**
 * Stop entity representing a location along a route.
 * Matches the OpenAPI Stop schema — this is the shape returned in API responses.
 */
export interface StopEntity {
  /** Unique stop identifier (cuid). */
  id: string;
  /** Stop name (city or station name). */
  name: string;
  /** Latitude coordinate. */
  lat: number;
  /** Longitude coordinate. */
  lng: number;
  /** Position in the route (0-based). */
  orderIndex: number;
}

/**
 * Route entity representing a transport route.
 * Matches the OpenAPI Route schema — this is the shape returned in list responses.
 */
export interface RouteEntity {
  /** Unique route identifier (cuid). */
  id: string;
  /** Route name (e.g., Bucharest - Cluj). */
  name: string;
  /** Provider who owns this route. */
  providerId: string;
  /** Route creation timestamp. */
  createdAt: Date;
}

/**
 * Route with its ordered list of stops.
 * Matches the OpenAPI RouteWithStops schema — this is the shape returned in detail responses.
 */
export interface RouteWithStops extends RouteEntity {
  /** Ordered list of stops on this route. */
  stops: StopEntity[];
}

/**
 * Input data for creating a stop on a route.
 * Matches the OpenAPI CreateStopInput schema.
 */
export interface CreateStopData {
  /** Stop name (city or station name). */
  name: string;
  /** Latitude coordinate (-90 to 90). */
  lat: number;
  /** Longitude coordinate (-180 to 180). */
  lng: number;
  /** Position in the route (0-based). */
  orderIndex: number;
}

/**
 * Input data for creating a route with stops.
 * Matches the OpenAPI CreateRouteRequest schema.
 */
export interface CreateRouteData {
  /** Route name (e.g., Bucharest - Cluj). */
  name: string;
  /** Ordered list of stops (minimum 2 for a valid route). */
  stops: CreateStopData[];
}
