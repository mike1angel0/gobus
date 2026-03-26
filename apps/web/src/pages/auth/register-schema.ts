import { z } from 'zod';

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
 * Zod schema for the registration form.
 * Mirrors OpenAPI spec constraints for POST /api/v1/auth/register.
 *
 * - email: format email, maxLength 255
 * - name: minLength 1, maxLength 100
 * - password: minLength 8, maxLength 128, pattern uppercase+lowercase+digit
 * - role: PASSENGER | PROVIDER
 * - phone: optional, maxLength 20
 * - providerName: required when role is PROVIDER, minLength 1, maxLength 200
 */
export const registerSchema = z
  .object({
    email: z
      .string()
      .min(1, 'Email is required')
      .email('Please enter a valid email address')
      .max(255, 'Email must be at most 255 characters'),
    name: z
      .string()
      .min(1, 'Name is required')
      .max(100, 'Name must be at most 100 characters'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password must be at most 128 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/\d/, 'Password must contain at least one digit'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    role: z.enum(['PASSENGER', 'PROVIDER']),
    phone: z
      .string()
      .max(20, 'Phone must be at most 20 characters')
      .optional()
      .or(z.literal('')),
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
