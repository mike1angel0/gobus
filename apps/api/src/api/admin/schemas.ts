import { z } from 'zod';
import { dataResponse, paginatedResponse } from '@/shared/schemas.js';

/** Zod enum for seat type matching OpenAPI SeatType. */
const seatTypeEnum = z.enum(['STANDARD', 'PREMIUM', 'DISABLED_ACCESSIBLE', 'BLOCKED']);

/** Zod schema for GET /api/v1/admin/buses query parameters matching OpenAPI spec. */
export const adminListBusesQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(10000).default(1).describe('Page number (1-based)'),
    pageSize: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .default(20)
      .describe('Number of items per page'),
    providerId: z.string().min(1).max(30).describe('Filter buses by provider').optional(),
  })
  .strict();

/** Zod schema for PATCH /api/v1/admin/seats/{id} request body matching OpenAPI AdminToggleSeatRequest. */
export const toggleSeatBodySchema = z
  .object({
    isEnabled: z
      .boolean()
      .describe('Whether the seat should be enabled (true) or disabled (false)'),
  })
  .strict();

/** Zod schema for a Bus response object matching OpenAPI Bus schema. */
export const busSchema = z.object({
  id: z.string().max(30).describe('Unique bus identifier (cuid)'),
  licensePlate: z.string().max(20).describe('Unique license plate number'),
  model: z.string().max(100).describe('Bus model name'),
  capacity: z.number().int().min(1).max(200).describe('Total number of seats'),
  rows: z.number().int().min(1).max(100).describe('Number of seat rows'),
  columns: z.number().int().min(1).max(10).describe('Number of seat columns'),
  providerId: z.string().max(30).describe('Provider who owns this bus'),
  createdAt: z.string().datetime().max(30).describe('Bus creation timestamp'),
});

/** Zod schema for a Seat response object matching OpenAPI Seat schema. */
export const seatSchema = z.object({
  id: z.string().max(30).describe('Unique seat identifier (cuid)'),
  row: z.number().int().min(1).max(100).describe('Seat row number'),
  column: z.number().int().min(1).max(10).describe('Seat column number'),
  label: z.string().max(10).describe('Seat label displayed to passengers (e.g., 1A, 2B)'),
  type: seatTypeEnum.describe('Type of bus seat'),
  price: z
    .number()
    .min(0)
    .max(10000)
    .describe('Price override for this seat (0 means use base price)'),
  isEnabled: z.boolean().describe('Whether this seat is available for booking'),
});

/** Zod schema for BusListResponse { data: Bus[], meta: PaginationMeta }. */
export const busListResponseSchema = paginatedResponse(busSchema);

/** Zod schema for SeatDataResponse { data: Seat }. */
export const seatDataResponseSchema = dataResponse(seatSchema);

/** Zod enum for user role matching OpenAPI Role enum. */
const roleEnum = z.enum(['PASSENGER', 'PROVIDER', 'DRIVER', 'ADMIN']);

/** Zod enum for user account status matching OpenAPI UserStatus enum. */
const userStatusEnum = z.enum(['ACTIVE', 'SUSPENDED', 'LOCKED']);

/** Zod enum for admin user status update actions matching OpenAPI AdminUpdateUserStatusRequest. */
const userStatusActionEnum = z.enum(['suspend', 'unsuspend', 'unlock']);

/** Zod schema for GET /api/v1/admin/users query parameters matching OpenAPI spec. */
export const adminListUsersQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(10000).default(1).describe('Page number (1-based)'),
    pageSize: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .default(20)
      .describe('Number of items per page'),
    role: roleEnum.describe('Filter users by role').optional(),
    status: userStatusEnum.describe('Filter users by account status').optional(),
  })
  .strict();

/** Zod schema for PATCH /api/v1/admin/users/{id}/status request body matching OpenAPI spec. */
export const updateUserStatusBodySchema = z
  .object({
    action: userStatusActionEnum.describe('The status action to perform on the user account'),
  })
  .strict();

/** Zod schema for GET /api/v1/admin/audit-logs query parameters matching OpenAPI spec. */
export const adminListAuditLogsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(10000).default(1).describe('Page number (1-based)'),
    pageSize: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .default(20)
      .describe('Number of items per page'),
    userId: z.string().min(1).max(30).describe('Filter audit logs by user ID').optional(),
    action: z.string().min(1).max(100).describe('Filter audit logs by action type').optional(),
    dateFrom: z
      .string()
      .datetime()
      .max(30)
      .describe('Filter audit logs from this date (inclusive)')
      .optional(),
    dateTo: z
      .string()
      .datetime()
      .max(30)
      .describe('Filter audit logs until this date (inclusive)')
      .optional(),
  })
  .strict();

/** Zod schema for an AdminUser response object matching OpenAPI AdminUser schema. */
export const adminUserSchema = z.object({
  id: z.string().max(30).describe('Unique user identifier (cuid)'),
  email: z.string().email().max(254).describe('User email address'),
  name: z.string().max(100).describe('User display name'),
  role: roleEnum.describe('User role'),
  phone: z.string().max(20).nullable().describe('User phone number'),
  avatarUrl: z.string().max(2048).nullable().describe('User avatar URL'),
  providerId: z.string().max(30).nullable().describe('Associated provider ID'),
  status: userStatusEnum.describe('Account status'),
  failedLoginAttempts: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe('Number of consecutive failed login attempts'),
  lockedUntil: z
    .string()
    .datetime()
    .max(30)
    .nullable()
    .describe('Account locked until this timestamp'),
  deletedAt: z
    .string()
    .datetime()
    .max(30)
    .nullable()
    .describe('Soft-deletion timestamp (null if account is active)'),
  createdAt: z.string().datetime().max(30).describe('Account creation timestamp'),
  updatedAt: z.string().datetime().max(30).describe('Account last update timestamp'),
});

/** Zod schema for AdminUserListResponse { data: AdminUser[], meta: PaginationMeta }. */
export const adminUserListResponseSchema = paginatedResponse(adminUserSchema);

/** Zod schema for AdminUserDataResponse { data: AdminUser }. */
export const adminUserDataResponseSchema = dataResponse(adminUserSchema);

/** Zod schema for an AdminAuditLog response object matching OpenAPI AdminAuditLog schema. */
export const adminAuditLogSchema = z.object({
  id: z.string().max(30).describe('Unique audit log identifier (cuid)'),
  userId: z.string().max(30).nullable().describe('User who performed the action'),
  action: z.string().max(100).describe('The auditable action performed'),
  resource: z.string().max(100).describe('The resource type affected'),
  resourceId: z.string().max(100).nullable().describe('The specific resource ID affected'),
  ipAddress: z.string().max(45).nullable().describe('Client IP address'),
  userAgent: z.string().max(500).nullable().describe('Client user agent string'),
  metadata: z
    .record(z.string(), z.unknown())
    .nullable()
    .describe('Additional context data for the event'),
  createdAt: z.string().datetime().max(30).describe('When the event occurred'),
});

/** Zod schema for AdminAuditLogListResponse { data: AdminAuditLog[], meta: PaginationMeta }. */
export const adminAuditLogListResponseSchema = paginatedResponse(adminAuditLogSchema);
