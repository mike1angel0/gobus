/**
 * Application-specific error codes matching the OpenAPI spec `code` field.
 * Use these constants in AppError instances for consistent error identification.
 */
export const ErrorCodes = {
  /** Invalid email or password during login. */
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  /** JWT access or refresh token has expired. */
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  /** Email address already registered. */
  AUTH_EMAIL_TAKEN: 'AUTH_EMAIL_TAKEN',
  /** Requested resource does not exist or caller lacks access. */
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  /** Request body or query parameters failed validation. */
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  /** Caller lacks permission for the requested action. */
  FORBIDDEN: 'FORBIDDEN',
  /** Resource state conflict (e.g. duplicate booking). */
  CONFLICT: 'CONFLICT',
  /** Seat already booked for the requested trip date. */
  SEAT_CONFLICT: 'SEAT_CONFLICT',
  /** Unexpected server error. */
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  /** Too many requests — rate limit exceeded. */
  RATE_LIMITED: 'RATE_LIMITED',
} as const;

/** Union type of all valid error code strings. */
export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
