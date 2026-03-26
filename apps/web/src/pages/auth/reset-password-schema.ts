import { z } from 'zod';
import type { TFunction } from 'i18next';

/**
 * Creates a Zod schema for the reset password form with translated messages.
 *
 * @param t - i18next translation function scoped to the 'auth' namespace.
 */
export function createResetPasswordSchema(t: TFunction) {
  return z
    .object({
      newPassword: z
        .string()
        .min(8, t('validation.passwordMinLength'))
        .max(128, t('validation.passwordMaxLength'))
        .regex(/[A-Z]/, t('validation.passwordUppercase'))
        .regex(/[a-z]/, t('validation.passwordLowercase'))
        .regex(/\d/, t('validation.passwordDigit')),
      confirmPassword: z.string().min(1, t('validation.confirmPasswordRequired')),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: t('validation.passwordMismatch'),
      path: ['confirmPassword'],
    });
}

/** Zod schema for the reset password form (static, English-only fallback). */
export const resetPasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password must be at most 128 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/\d/, 'Password must contain at least one digit'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

/** Inferred type for the reset password form values. */
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
