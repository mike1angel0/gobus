import { z } from 'zod';

/** Zod schema for the forgot password form. */
export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address')
    .max(255, 'Email must be at most 255 characters'),
});

/** Inferred type for the forgot password form values. */
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;
