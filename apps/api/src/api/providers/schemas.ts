import { z } from 'zod';
import { dataResponse } from '@/shared/schemas.js';

/** Zod schema for the Provider response object matching OpenAPI Provider schema. */
export const providerSchema = z.object({
  id: z.string().max(30).describe('Unique provider identifier (cuid)'),
  name: z.string().max(200).describe('Provider company name'),
  logo: z.string().url().max(2048).nullable().describe('URL to provider logo image'),
  contactEmail: z.string().email().max(255).nullable().describe('Provider contact email'),
  contactPhone: z.string().max(20).nullable().describe('Provider contact phone number'),
  status: z.enum(['APPROVED', 'PENDING']).describe('Provider approval status'),
  createdAt: z.string().datetime().describe('Provider creation timestamp'),
  updatedAt: z.string().datetime().describe('Last update timestamp'),
});

/** Zod schema for ProviderDataResponse { data: Provider } matching OpenAPI. */
export const providerDataResponseSchema = dataResponse(providerSchema);
