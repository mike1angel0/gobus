import { z } from 'zod';

/**
 * Zod schema for the profile edit form.
 *
 * Constraints match the OpenAPI `UserUpdate` schema:
 * - `name`: 1–100 characters
 * - `phone`: max 20 characters
 * - `avatarUrl`: valid URI, max 2048 characters
 */
export const profileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or fewer'),
  phone: z.string().max(20, 'Phone must be 20 characters or fewer').optional().or(z.literal('')),
  avatarUrl: z
    .string()
    .max(2048, 'Avatar URL must be 2048 characters or fewer')
    .url('Must be a valid URL')
    .optional()
    .or(z.literal('')),
});

/** Inferred form values from the profile edit schema. */
export type ProfileFormValues = z.infer<typeof profileSchema>;
