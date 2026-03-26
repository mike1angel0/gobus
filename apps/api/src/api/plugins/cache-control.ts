import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Create a Fastify preHandler that sets Cache-Control header for public, cacheable responses.
 *
 * @param maxAge - Max age in seconds for the cached response.
 * @returns A preHandler function that sets the Cache-Control header.
 */
export function cachePublic(
  maxAge: number,
): (_request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    void reply.header('Cache-Control', `public, max-age=${maxAge}`);
  };
}

/**
 * Create a Fastify preHandler that sets Cache-Control header for private, cacheable responses.
 *
 * @param maxAge - Max age in seconds for the cached response.
 * @returns A preHandler function that sets the Cache-Control header.
 */
export function cachePrivate(
  maxAge: number,
): (_request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    void reply.header('Cache-Control', `private, max-age=${maxAge}`);
  };
}

/**
 * Fastify preHandler that sets Cache-Control to prevent any caching.
 * Use for dynamic, real-time, or user-specific data that must never be cached.
 */
export async function noCache(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  void reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
}

/**
 * Fastify preHandler that sets Cache-Control for private data that should not be cached.
 * Use for authenticated user-specific data (bookings, profiles).
 */
export async function privateNoCache(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  void reply.header('Cache-Control', 'private, no-cache');
}
