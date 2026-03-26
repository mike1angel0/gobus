import { z } from 'zod';
import type { User } from '@/contexts/auth-types';

/**
 * Zod schema for login form validation.
 * Mirrors OpenAPI spec constraints: email format, password min 1 / max 128 chars.
 */
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address')
    .max(255, 'Email must be at most 255 characters'),
  password: z
    .string()
    .min(1, 'Password is required')
    .max(128, 'Password must be at most 128 characters'),
});

/** Inferred type from the login form schema. */
export type LoginFormValues = z.infer<typeof loginSchema>;

/**
 * Returns the post-login redirect path for a given user role.
 *
 * @param role - The user's role from the API.
 * @returns Redirect path string.
 */
export function getRedirectForRole(role: User['role']): string {
  const map: Record<User['role'], string> = {
    PROVIDER: '/provider',
    DRIVER: '/driver',
    ADMIN: '/admin',
    PASSENGER: '/',
  };
  return map[role];
}
