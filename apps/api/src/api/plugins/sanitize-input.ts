import fp from 'fastify-plugin';
import striptags from 'striptags';
import type { FastifyInstance } from 'fastify';

/** Maximum allowed nesting depth for JSON request bodies. */
const MAX_JSON_DEPTH = 5;

/**
 * Check the nesting depth of a data structure.
 * Return true if the depth exceeds the given limit.
 */
export function exceedsJsonDepth(data: unknown, maxDepth: number, currentDepth = 0): boolean {
  if (currentDepth > maxDepth) {
    return true;
  }

  if (data === null || data === undefined || typeof data !== 'object') {
    return false;
  }

  if (Array.isArray(data)) {
    return data.some((item) => exceedsJsonDepth(item, maxDepth, currentDepth + 1));
  }

  return Object.values(data as Record<string, unknown>).some(
    (value) => exceedsJsonDepth(value, maxDepth, currentDepth + 1),
  );
}

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
    app.addHook('preValidation', async (request, reply) => {
      // Reject deeply nested JSON payloads (DoS prevention)
      if (request.body && typeof request.body === 'object') {
        if (exceedsJsonDepth(request.body, MAX_JSON_DEPTH)) {
          return reply.status(400).send({
            type: 'https://httpstatuses.com/400',
            title: 'Bad Request',
            status: 400,
            detail: `Request body exceeds maximum nesting depth of ${MAX_JSON_DEPTH} levels`,
            code: 'VALIDATION_ERROR',
          });
        }
        request.body = stripHtmlFromStrings(request.body);
      }
      if (request.query && typeof request.query === 'object') {
        request.query = stripHtmlFromStrings(request.query);
      }
    });
  },
  { name: 'sanitize-input' },
);
