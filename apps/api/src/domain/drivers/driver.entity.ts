/** Status values for a driver user account. */
export type DriverStatus = 'ACTIVE' | 'SUSPENDED' | 'LOCKED';

/**
 * Domain entity representing a driver as returned by API responses.
 * Drivers are User records with role=DRIVER linked to a provider.
 */
export interface DriverEntity {
  /** Unique driver identifier (cuid). */
  id: string;
  /** Driver email address. */
  email: string;
  /** Driver full name. */
  name: string;
  /** Always 'DRIVER' for driver entities. */
  role: 'DRIVER';
  /** Optional phone number. */
  phone: string | null;
  /** Account status. */
  status: DriverStatus;
  /** Provider this driver belongs to. */
  providerId: string;
  /** Number of schedules assigned to this driver. */
  assignedScheduleCount: number;
  /** Timestamp when the driver was created. */
  createdAt: Date;
}

/** Input data for creating a new driver. */
export interface CreateDriverData {
  /** Driver email address (must be unique). */
  email: string;
  /** Plain-text password (will be hashed). */
  password: string;
  /** Driver full name. */
  name: string;
  /** Optional phone number. */
  phone?: string;
}
