import { z } from 'zod';
import type { TFunction } from 'i18next';

/**
 * Password strength levels for the visual indicator.
 */
export type PasswordStrength = 'weak' | 'fair' | 'strong';

/**
 * Evaluates password strength based on length, character variety, and special chars.
 *
 * @param password - The password string to evaluate.
 * @returns The strength level: 'weak', 'fair', or 'strong'.
 */
export function getPasswordStrength(password: string): PasswordStrength {
  if (password.length === 0) return 'weak';

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return 'weak';
  if (score <= 4) return 'fair';
  return 'strong';
}

/**
 * Creates a Zod schema for the registration form with translated messages.
 * Mirrors OpenAPI spec constraints for POST /api/v1/auth/register.
 *
 * @param t - i18next translation function scoped to the 'auth' namespace.
 */
export function createRegisterSchema(t: TFunction) {
  return z
    .object({
      email: z
        .string()
        .min(1, t('validation.emailRequired'))
        .email(t('validation.emailInvalid'))
        .max(255, t('validation.emailMaxLength')),
      name: z
        .string()
        .min(1, t('validation.nameRequired'))
        .max(100, t('validation.nameMaxLength')),
      password: z
        .string()
        .min(8, t('validation.passwordMinLength'))
        .max(128, t('validation.passwordMaxLength'))
        .regex(/[A-Z]/, t('validation.passwordUppercase'))
        .regex(/[a-z]/, t('validation.passwordLowercase'))
        .regex(/\d/, t('validation.passwordDigit')),
      confirmPassword: z.string().min(1, t('validation.confirmPasswordRequired')),
      role: z.enum(['PASSENGER', 'PROVIDER']),
      phone: z
        .string()
        .max(20, t('validation.phoneMaxLength'))
        .optional()
        .or(z.literal('')),
      providerName: z
        .string()
        .max(200, t('validation.providerNameMaxLength'))
        .optional()
        .or(z.literal('')),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('validation.passwordMismatch'),
      path: ['confirmPassword'],
    })
    .refine(
      (data) => {
        if (data.role === 'PROVIDER') {
          return !!data.providerName && data.providerName.trim().length > 0;
        }
        return true;
      },
      {
        message: t('validation.providerNameRequired'),
        path: ['providerName'],
      },
    );
}

/**
 * Zod schema for the registration form (static, English-only fallback).
 * Mirrors OpenAPI spec constraints for POST /api/v1/auth/register.
 */
export const registerSchema = z
  .object({
    email: z
      .string()
      .min(1, 'Email is required')
      .email('Please enter a valid email address')
      .max(255, 'Email must be at most 255 characters'),
    name: z.string().min(1, 'Name is required').max(100, 'Name must be at most 100 characters'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password must be at most 128 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/\d/, 'Password must contain at least one digit'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    role: z.enum(['PASSENGER', 'PROVIDER']),
    phone: z.string().max(20, 'Phone must be at most 20 characters').optional().or(z.literal('')),
    providerName: z
      .string()
      .max(200, 'Provider name must be at most 200 characters')
      .optional()
      .or(z.literal('')),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine(
    (data) => {
      if (data.role === 'PROVIDER') {
        return !!data.providerName && data.providerName.trim().length > 0;
      }
      return true;
    },
    {
      message: 'Provider name is required',
      path: ['providerName'],
    },
  );

/** Inferred type from the register form schema. */
export type RegisterFormValues = z.infer<typeof registerSchema>;
