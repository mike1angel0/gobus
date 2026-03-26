import { z } from 'zod';

/**
 * Parse and validate input data against a strict Zod schema.
 * Rejects unknown fields with a 400 error to prevent mass assignment attacks.
 * All schemas passed to this function should use `.strict()` to reject unknown properties.
 *
 * @throws {ZodError} When validation fails (caught by error-handler plugin → RFC 9457 400 response)
 */
export function strictParse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  return schema.parse(data);
}

/**
 * Zod schema for pagination query parameters.
 * Matches OpenAPI PageParam (default 1) and PageSizeParam (default 20, max 100).
 */
export const paginationQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(10000).default(1).describe('Page number (1-based)'),
    pageSize: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .default(20)
      .describe('Number of items per page'),
  })
  .strict();

/** Inferred type for pagination query parameters. */
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/**
 * Zod schema for path parameters containing a resource ID.
 * Matches the OpenAPI IdParam (cuid format, max 30 characters).
 */
export const idParamSchema = z
  .object({
    id: z.string().min(1).max(30).describe('Resource identifier'),
  })
  .strict();

/** Inferred type for id path parameters. */
export type IdParam = z.infer<typeof idParamSchema>;

/**
 * Wrap a Zod schema in a `{ data: T }` response envelope.
 * Use for single-item API responses matching the OpenAPI convention.
 */
export function dataResponse<T extends z.ZodType>(schema: T) {
  return z.object({
    data: schema,
  });
}

/**
 * Wrap a Zod schema in a `{ data: T[], meta: PaginationMeta }` response envelope.
 * Use for paginated list API responses matching the OpenAPI convention.
 */
export function paginatedResponse<T extends z.ZodType>(schema: T) {
  return z.object({
    data: z.array(schema).max(100).describe('List of items'),
    meta: paginationMetaSchema.describe('Pagination metadata'),
  });
}

/**
 * Zod schema for PaginationMeta matching the OpenAPI PaginationMeta schema.
 * Validates pagination metadata fields returned in list responses.
 */
export const paginationMetaSchema = z.object({
  total: z
    .number()
    .int()
    .min(0)
    .max(2147483647)
    .describe('Total number of records matching the query'),
  page: z.number().int().min(1).max(10000).describe('Current page number (1-based)'),
  pageSize: z.number().int().min(1).max(100).describe('Number of records per page'),
  totalPages: z.number().int().min(0).max(2147483647).describe('Total number of pages'),
});
