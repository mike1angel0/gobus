/**
 * User entity representing a user profile.
 * Matches the OpenAPI User schema exactly — this is the shape returned in API responses.
 * Internal fields (passwordHash, failedLoginAttempts, lockedUntil) are excluded.
 */
export interface UserEntity {
  /** Unique user identifier (cuid). */
  id: string;
  /** User's email address. */
  email: string;
  /** User's full name. */
  name: string;
  /** User role determining access level. */
  role: 'PASSENGER' | 'PROVIDER' | 'DRIVER' | 'ADMIN';
  /** User's phone number. */
  phone: string | null;
  /** URL to user's avatar image. */
  avatarUrl: string | null;
  /** User notification and display preferences. */
  preferences: UserPreferences | null;
  /** Associated provider ID (for PROVIDER and DRIVER roles). */
  providerId: string | null;
  /** Account status affecting login ability. */
  status: 'ACTIVE' | 'SUSPENDED' | 'LOCKED';
  /** Account creation timestamp. */
  createdAt: Date;
  /** Last update timestamp. */
  updatedAt: Date;
}

/**
 * User notification and display preferences.
 * Matches the OpenAPI UserPreferences schema.
 */
export interface UserPreferences {
  /** Preferred language code (e.g., en, ro). */
  language?: string;
  /** Whether to receive push notifications. */
  notifications?: boolean;
  /** Whether to receive email notifications. */
  emailNotifications?: boolean;
}

/**
 * Data for updating a user profile. All fields are optional.
 * Matches the OpenAPI UserUpdate schema.
 */
export interface UserUpdateData {
  /** User's full name. */
  name?: string;
  /** Phone number. */
  phone?: string;
  /** URL to user's avatar image. */
  avatarUrl?: string;
  /** User notification and display preferences. */
  preferences?: UserPreferences;
}
