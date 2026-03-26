/**
 * Authentication domain types matching the OpenAPI spec auth schemas.
 * These types represent the auth-specific data structures used across the application.
 */

/** Roles that can self-register (PASSENGER or PROVIDER). */
export type RegisterRole = 'PASSENGER' | 'PROVIDER';

/**
 * Data required to register a new user account.
 * Matches the OpenAPI RegisterRequest schema.
 */
export interface RegisterData {
  /** User's email address (must be unique). */
  email: string;
  /** Password (min 8 chars, must contain uppercase + lowercase + digit). */
  password: string;
  /** User's full name. */
  name: string;
  /** Account type (only PASSENGER and PROVIDER can self-register). */
  role: RegisterRole;
  /** Optional phone number. */
  phone?: string;
  /** Required when role is PROVIDER. Name of the transport company. */
  providerName?: string;
}

/**
 * Credentials for user login.
 * Matches the OpenAPI LoginRequest schema.
 */
export interface LoginCredentials {
  /** Registered email address. */
  email: string;
  /** Account password. */
  password: string;
}

/**
 * JWT access token payload stored in the token claims.
 * Decoded from the access token on each authenticated request.
 */
export interface AuthTokenPayload {
  /** User's unique identifier. */
  sub: string;
  /** User's email address. */
  email: string;
  /** User's role determining access level. */
  role: 'PASSENGER' | 'PROVIDER' | 'DRIVER' | 'ADMIN';
  /** Associated provider ID (for PROVIDER and DRIVER roles). */
  providerId: string | null;
  /** Token issuer identifier. */
  iss: string;
  /** Token audience identifier. */
  aud: string;
  /** Unique token identifier for tracking. */
  jti: string;
  /** Not-before timestamp (seconds since epoch). */
  nbf: number;
  /** Token issued-at timestamp (seconds since epoch). */
  iat: number;
  /** Token expiration timestamp (seconds since epoch). */
  exp: number;
}

/**
 * Pair of access and refresh tokens returned after authentication.
 * Matches the OpenAPI LoginResponse (accessToken + refreshToken fields).
 */
export interface TokenPair {
  /** JWT access token (expires in 15 minutes). */
  accessToken: string;
  /** Refresh token (expires in 7 days). */
  refreshToken: string;
}

/**
 * Data for requesting a password reset.
 * Matches the OpenAPI ForgotPasswordRequest schema.
 */
export interface ForgotPasswordData {
  /** Email address associated with the account. */
  email: string;
}

/**
 * Data for resetting a password with a token.
 * Matches the OpenAPI ResetPasswordRequest schema.
 */
export interface ResetPasswordData {
  /** Password reset token received via email. */
  token: string;
  /** New password (min 8 chars, uppercase + lowercase + digit). */
  newPassword: string;
}

/**
 * Data for changing password while logged in.
 * Matches the OpenAPI ChangePasswordRequest schema.
 */
export interface ChangePasswordData {
  /** The user's current password for verification. */
  currentPassword: string;
  /** New password (min 8 chars, uppercase + lowercase + digit). */
  newPassword: string;
}
