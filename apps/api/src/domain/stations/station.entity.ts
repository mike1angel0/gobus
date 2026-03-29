/** Station type classification matching Prisma StationType enum and OpenAPI StationType schema. */
export type StationType = 'HUB' | 'STATION' | 'STOP';

/** Facility available at a station matching OpenAPI StationFacility schema. */
export type StationFacility =
  | 'WIFI'
  | 'PARKING'
  | 'WAITING_ROOM'
  | 'RESTROOM'
  | 'TICKET_OFFICE'
  | 'LUGGAGE_STORAGE';

/**
 * Station entity representing a bus station, hub, or stop.
 * Matches the OpenAPI Station schema — this is the shape returned in API responses.
 */
export interface StationEntity {
  /** Unique station identifier (cuid). */
  id: string;
  /** Station display name (e.g., Autogara Nord). */
  name: string;
  /** City where the station is located. */
  cityName: string;
  /** Station type classification. */
  type: StationType;
  /** Full street address. */
  address: string;
  /** Latitude coordinate. */
  lat: number;
  /** Longitude coordinate. */
  lng: number;
  /** List of facilities available at this station. */
  facilities: StationFacility[];
  /** Station contact phone number. */
  phone: string | null;
  /** Station contact email address. */
  email: string | null;
  /** Number of bus platforms/bays. */
  platformCount: number | null;
  /** Whether the station is currently active. */
  isActive: boolean;
  /** ID of the user who created this station. */
  createdBy: string;
  /** Station creation timestamp. */
  createdAt: Date;
  /** Station last update timestamp. */
  updatedAt: Date;
}

/**
 * Input data for creating a station.
 * Matches the OpenAPI CreateStationRequest schema.
 */
export interface CreateStationData {
  /** Station display name. */
  name: string;
  /** City where the station is located. */
  cityName: string;
  /** Station type classification. */
  type: StationType;
  /** Full street address. */
  address: string;
  /** Latitude coordinate. */
  lat: number;
  /** Longitude coordinate. */
  lng: number;
  /** List of facilities available at this station. */
  facilities?: StationFacility[];
  /** Station contact phone number. */
  phone?: string;
  /** Station contact email address. */
  email?: string;
  /** Number of bus platforms/bays. */
  platformCount?: number;
}

/**
 * Input data for updating a station. All fields are optional.
 * Matches the OpenAPI UpdateStationRequest schema.
 */
export interface UpdateStationData {
  /** Station display name. */
  name?: string;
  /** City where the station is located. */
  cityName?: string;
  /** Station type classification. */
  type?: StationType;
  /** Full street address. */
  address?: string;
  /** Latitude coordinate. */
  lat?: number;
  /** Longitude coordinate. */
  lng?: number;
  /** List of facilities available at this station. */
  facilities?: StationFacility[];
  /** Station contact phone number. */
  phone?: string | null;
  /** Station contact email address. */
  email?: string | null;
  /** Number of bus platforms/bays. */
  platformCount?: number | null;
  /** Whether the station is currently active. */
  isActive?: boolean;
}
