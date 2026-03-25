import type { AuditAction } from './audit-actions.js';

/**
 * Audit log entry representing a security or business event.
 * Matches the AuditLog database model shape for API responses.
 */
export interface AuditLogEntity {
  id: string;
  userId: string | null;
  action: AuditAction;
  resource: string;
  resourceId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

/**
 * Input for creating a new audit log entry.
 * Passed to `AuditService.log()` from route handlers or services.
 */
export interface AuditLogInput {
  /** User who performed the action (null for anonymous events like failed login). */
  userId?: string | null;
  /** The audit action being recorded. */
  action: AuditAction;
  /** The resource type affected (e.g. "user", "booking"). */
  resource: string;
  /** The specific resource ID affected, if applicable. */
  resourceId?: string | null;
  /** Client IP address from the request. */
  ipAddress?: string | null;
  /** Client user agent string from the request. */
  userAgent?: string | null;
  /** Additional context data for the event. */
  metadata?: Record<string, unknown> | null;
}
