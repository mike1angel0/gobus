/**
 * Provider entity representing a transport company profile.
 * Matches the OpenAPI Provider schema — this is the shape returned in API responses.
 */
export interface ProviderEntity {
  /** Unique provider identifier (cuid). */
  id: string;
  /** Provider company name. */
  name: string;
  /** URL to provider logo image. */
  logo: string | null;
  /** Provider contact email address. */
  contactEmail: string | null;
  /** Provider contact phone number. */
  contactPhone: string | null;
  /** Provider approval status. */
  status: 'APPROVED' | 'PENDING';
  /** Provider creation timestamp. */
  createdAt: Date;
  /** Last update timestamp. */
  updatedAt: Date;
}

/** Revenue breakdown for a single route. */
export interface RevenueByRoute {
  /** Route identifier. */
  routeId: string;
  /** Route name. */
  routeName: string;
  /** Total revenue for this route. */
  revenue: number;
}

/** Dashboard analytics for a provider. */
export interface ProviderAnalytics {
  /** Total number of confirmed bookings. */
  totalBookings: number;
  /** Total revenue from confirmed bookings. */
  totalRevenue: number;
  /** Average seat occupancy ratio (0 to 1). */
  averageOccupancy: number;
  /** Revenue breakdown per route. */
  revenueByRoute: RevenueByRoute[];
}

/**
 * Data for updating a provider profile. All fields are optional.
 */
export interface ProviderUpdateData {
  /** Provider company name. */
  name?: string;
  /** URL to provider logo image. */
  logo?: string | null;
  /** Provider contact email address. */
  contactEmail?: string | null;
  /** Provider contact phone number. */
  contactPhone?: string | null;
}
