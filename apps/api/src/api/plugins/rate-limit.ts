import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

import { ErrorCodes } from '@/domain/errors/error-codes.js';

/** Time window in milliseconds (1 minute). */
const WINDOW_MS = 60_000;

/** Default rate limit for general API routes (per user/IP). */
const GENERAL_LIMIT = 100;

/**
 * Build an RFC 9457 rate-limit error response body.
 * Returns a Problem Details object with the RATE_LIMITED error code.
 */
function buildRateLimitResponse(
  _request: unknown,
  context: { statusCode: number; max: number; after: string; ttl: number },
): Record<string, unknown> {
  return {
    statusCode: context.statusCode,
    type: 'https://httpstatuses.com/429',
    title: 'Too Many Requests',
    status: 429,
    detail: 'Rate limit exceeded. Please try again later.',
    code: ErrorCodes.RATE_LIMITED,
  };
}

/**
 * Register @fastify/rate-limit with global defaults.
 *
 * Global default: 100 req/min per authenticated user (falls back to IP).
 * Per-route overrides are applied via `config.rateLimit` on individual routes:
 * - Auth endpoints: 10 req/min per IP (set in auth routes)
 * - Search endpoints: 30 req/min per IP (set in search routes)
 *
 * Returns 429 with RFC 9457 Problem Details format and Retry-After header.
 */
async function rateLimitPlugin(app: FastifyInstance): Promise<void> {
  await app.register(rateLimit, {
    global: true,
    max: GENERAL_LIMIT,
    timeWindow: WINDOW_MS,
    keyGenerator: (request) => {
      const user = (request as unknown as { user?: { id: string } }).user;
      return user?.id ?? request.ip;
    },
    errorResponseBuilder: buildRateLimitResponse,
    addHeadersOnExceeding: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
    },
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },
  });
}

export default fp(rateLimitPlugin, {
  name: 'rate-limit',
});

/** Rate limit for authentication endpoints (per IP). */
export const AUTH_RATE_LIMIT = {
  max: 10,
  timeWindow: WINDOW_MS,
  keyGenerator: (request: { ip: string }) => request.ip,
};

/** Rate limit for public search endpoints (per IP). */
export const SEARCH_RATE_LIMIT = {
  max: 30,
  timeWindow: WINDOW_MS,
  keyGenerator: (request: { ip: string }) => request.ip,
};
