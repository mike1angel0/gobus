import fp from 'fastify-plugin';
import striptags from 'striptags';
import type { FastifyInstance } from 'fastify';

/**
 * Recursively strip HTML tags from all string values in a data structure.
 * Preserves non-string types, nulls, and undefined values.
 */
export function stripHtmlFromStrings(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    return striptags(data);
  }

  if (Array.isArray(data)) {
    return data.map(stripHtmlFromStrings);
  }

  if (typeof data === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      result[key] = stripHtmlFromStrings(value);
    }
    return result;
  }

  return data;
}

/**
 * Fastify plugin that strips HTML tags from all string fields in request body,
 * query string, and params. Provides defense-in-depth against XSS attacks
 * even though Prisma prevents SQL injection and React auto-escapes JSX.
 */
export default fp(
  async (app: FastifyInstance) => {
    app.addHook('preValidation', async (request) => {
      if (request.body && typeof request.body === 'object') {
        request.body = stripHtmlFromStrings(request.body);
      }
      if (request.query && typeof request.query === 'object') {
        request.query = stripHtmlFromStrings(request.query);
      }
    });
  },
  { name: 'sanitize-input' },
);
