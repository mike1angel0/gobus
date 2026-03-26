import { z } from 'zod';
import { dataResponse, httpsUrlSchema } from '@/shared/schemas.js';

/**
 * Password validation pattern: at least one uppercase, one lowercase, and one digit.
 * Used in register, reset-password, and change-password schemas.
 */
const passwordPattern = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).+$/;

/**
 * Reusable strong password schema matching OpenAPI password constraints.
 * Min 8, max 128, requires uppercase + lowercase + digit.
 */
const strongPasswordSchema = z
  .string()
  .min(8)
  .max(128)
  .regex(
    passwordPattern,
    'Password must contain at least one uppercase letter, one lowercase letter, and one digit',
  );

/** Zod schema for user preferences matching OpenAPI UserPreferences. */
export const userPreferencesSchema = z
  .object({
    language: z
      .string()
      .trim()
      .min(1)
      .max(10)
      .describe('Preferred language code (e.g., en, ro)')
      .optional(),
    notifications: z.boolean().describe('Whether to receive push notifications').optional(),
    emailNotifications: z.boolean().describe('Whether to receive email notifications').optional(),
  })
  .strict()
  .describe('User notification and display preferences');

/** Zod schema for the User response object matching OpenAPI User schema. */
export const userSchema = z.object({
  id: z.string().max(30).describe('Unique user identifier (cuid)'),
  email: z.string().email().max(255).describe("User's email address"),
  name: z.string().max(100).describe("User's full name"),
  role: z
    .enum(['PASSENGER', 'PROVIDER', 'DRIVER', 'ADMIN'])
    .describe('User role determining access level'),
  phone: z.string().max(20).nullable().describe("User's phone number"),
  avatarUrl: z.string().url().max(2048).nullable().describe("URL to user's avatar image"),
  preferences: userPreferencesSchema
    .nullable()
    .describe('User notification and display preferences'),
  providerId: z
    .string()
    .max(30)
    .nullable()
    .describe('Associated provider ID (for PROVIDER and DRIVER roles)'),
  status: z
    .enum(['ACTIVE', 'SUSPENDED', 'LOCKED'])
    .describe('Account status affecting login ability'),
  createdAt: z.string().datetime().max(30).describe('Account creation timestamp'),
  updatedAt: z.string().datetime().max(30).describe('Last update timestamp'),
});

/** Zod schema for the LoginResponse matching OpenAPI LoginResponse. */
export const loginResponseSchema = z.object({
  accessToken: z.string().max(2000).describe('JWT access token (expires in 15 minutes)'),
  refreshToken: z.string().max(500).describe('Refresh token (expires in 7 days)'),
  user: userSchema,
});

/** Zod schema for TokenRefreshResponse matching OpenAPI TokenRefreshResponse. */
export const tokenRefreshResponseSchema = z.object({
  accessToken: z.string().max(2000).describe('New JWT access token (expires in 15 minutes)'),
  refreshToken: z.string().max(500).describe('New refresh token (expires in 7 days)'),
});

/** Zod schema for MessageResponse matching OpenAPI MessageResponse. */
export const messageResponseSchema = z.object({
  message: z.string().max(500).describe('Human-readable message'),
});

// --- Request schemas ---

/** Zod schema for POST /auth/register request body matching OpenAPI RegisterRequest. */
export const registerBodySchema = z
  .object({
    email: z.string().trim().email().max(255).describe("User's email address (must be unique)"),
    password: strongPasswordSchema.describe(
      'Password must be at least 8 characters and contain at least one uppercase letter, one lowercase letter, and one digit.',
    ),
    name: z.string().trim().min(1).max(100).describe("User's full name"),
    role: z
      .enum(['PASSENGER', 'PROVIDER'])
      .describe('Account type (only PASSENGER and PROVIDER can self-register)'),
    phone: z.string().trim().max(20).describe('Optional phone number').optional(),
    providerName: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .describe('Required when role is PROVIDER. Name of the transport company.')
      .optional(),
  })
  .strict()
  .describe('Request body for user registration');

/** Zod schema for POST /auth/login request body matching OpenAPI LoginRequest. */
export const loginBodySchema = z
  .object({
    email: z.string().trim().email().max(255).describe('Registered email address'),
    password: z.string().min(1).max(128).describe('Account password'),
  })
  .strict()
  .describe('Request body for user login');

/** Zod schema for POST /auth/refresh request body matching OpenAPI TokenRefreshRequest. */
export const tokenRefreshBodySchema = z
  .object({
    refreshToken: z
      .string()
      .min(1)
      .max(500)
      .describe('The refresh token received during login or previous refresh'),
  })
  .strict()
  .describe('Request body for refreshing an access token');

/** Zod schema for POST /auth/logout request body matching OpenAPI LogoutRequest. */
export const logoutBodySchema = z
  .object({
    refreshToken: z.string().min(1).max(500).describe('The refresh token to revoke'),
  })
  .strict()
  .describe('Request body for logout');

/** Zod schema for POST /auth/forgot-password request body matching OpenAPI ForgotPasswordRequest. */
export const forgotPasswordBodySchema = z
  .object({
    email: z.string().trim().email().max(255).describe('Email address associated with the account'),
  })
  .strict()
  .describe('Request body for requesting a password reset');

/** Zod schema for POST /auth/reset-password request body matching OpenAPI ResetPasswordRequest. */
export const resetPasswordBodySchema = z
  .object({
    token: z.string().min(1).max(500).describe('Password reset token received via email'),
    newPassword: strongPasswordSchema.describe(
      'New password. Must be at least 8 characters and contain at least one uppercase letter, one lowercase letter, and one digit.',
    ),
  })
  .strict()
  .describe('Request body for resetting a password with a token');

/** Zod schema for POST /auth/change-password request body matching OpenAPI ChangePasswordRequest. */
export const changePasswordBodySchema = z
  .object({
    currentPassword: z
      .string()
      .min(1)
      .max(128)
      .describe("The user's current password for verification"),
    newPassword: strongPasswordSchema.describe(
      'New password. Must be at least 8 characters and contain at least one uppercase letter, one lowercase letter, and one digit.',
    ),
  })
  .strict()
  .describe('Request body for changing password while logged in');

/** Zod schema for PATCH /auth/me request body matching OpenAPI UserUpdate. */
export const updateProfileBodySchema = z
  .object({
    name: z.string().trim().min(1).max(100).describe("User's full name").optional(),
    phone: z.string().trim().max(20).describe('Phone number').optional(),
    avatarUrl: httpsUrlSchema(2048).describe("URL to user's avatar image").optional(),
    preferences: userPreferencesSchema
      .describe('User notification and display preferences')
      .optional(),
  })
  .strict()
  .describe('Request body for updating user profile. Only provided fields are updated.');

// --- Response envelope schemas ---

/** Zod schema for AuthDataResponse { data: LoginResponse } matching OpenAPI. */
export const authDataResponseSchema = dataResponse(loginResponseSchema);

/** Zod schema for TokenRefreshDataResponse { data: TokenRefreshResponse } matching OpenAPI. */
export const tokenRefreshDataResponseSchema = dataResponse(tokenRefreshResponseSchema);

/** Zod schema for UserDataResponse { data: User } matching OpenAPI. */
export const userDataResponseSchema = dataResponse(userSchema);

/** Zod schema for MessageDataResponse { data: MessageResponse } matching OpenAPI. */
export const messageDataResponseSchema = dataResponse(messageResponseSchema);
