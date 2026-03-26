import { z } from 'zod';
import type { TFunction } from 'i18next';

/**
 * Creates a Zod schema for the forgot password form with translated messages.
 *
 * @param t - i18next translation function scoped to the 'auth' namespace.
 */
export function createForgotPasswordSchema(t: TFunction) {
  return z.object({
    email: z
      .string()
      .min(1, t('validation.emailRequired'))
      .email(t('validation.emailInvalid'))
      .max(255, t('validation.emailMaxLength')),
  });
}

/** Zod schema for the forgot password form (static, English-only fallback). */
export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address')
    .max(255, 'Email must be at most 255 characters'),
});

/** Inferred type for the forgot password form values. */
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;
