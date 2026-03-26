import { z } from 'zod';

/**
 * Zod schema for the change password form.
 *
 * Validates:
 * - currentPassword: required, max 128 chars (matching OpenAPI spec)
 * - newPassword: 8–128 chars, uppercase + lowercase + digit (matching OpenAPI spec)
 * - confirmPassword: must match newPassword
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, 'Current password is required')
      .max(128, 'Password must be at most 128 characters'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password must be at most 128 characters')
      .regex(
        /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).+/,
        'Password must contain at least one uppercase letter, one lowercase letter, and one digit',
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

/** Inferred type for change password form values. */
export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;
