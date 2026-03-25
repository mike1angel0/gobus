/**
 * All auditable actions in the system.
 * Used as the `action` field in AuditLog records.
 */
export const AuditActions = {
  // Auth events
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILURE: 'LOGIN_FAILURE',
  LOGIN_LOCKED: 'LOGIN_LOCKED',
  REGISTER: 'REGISTER',
  LOGOUT: 'LOGOUT',
  PASSWORD_RESET_REQUEST: 'PASSWORD_RESET_REQUEST',
  PASSWORD_RESET_COMPLETE: 'PASSWORD_RESET_COMPLETE',
  PASSWORD_CHANGE: 'PASSWORD_CHANGE',

  // Account status events
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  ACCOUNT_UNSUSPENDED: 'ACCOUNT_UNSUSPENDED',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  ACCOUNT_UNLOCKED: 'ACCOUNT_UNLOCKED',

  // Booking events
  BOOKING_CREATED: 'BOOKING_CREATED',
  BOOKING_CANCELLED: 'BOOKING_CANCELLED',
} as const;

/** Union type of all valid audit action strings. */
export type AuditAction = (typeof AuditActions)[keyof typeof AuditActions];
