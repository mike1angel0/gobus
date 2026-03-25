import type { FastifyReply, FastifyRequest } from 'fastify';

import { AppError } from '@/domain/errors/app-error.js';
import { ErrorCodes } from '@/domain/errors/error-codes.js';

type Role = 'PASSENGER' | 'PROVIDER' | 'DRIVER' | 'ADMIN';

/**
 * Create a Fastify preHandler that enforces the user has one of the allowed roles.
 * Must be used after the `authenticate` preHandler has populated `request.user`.
 *
 * @param roles - One or more roles that are permitted to access the route.
 * @returns A preHandler function that throws 403 if the user's role is not in the allowed list.
 */
export function requireRole(
  ...roles: Role[]
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    if (!roles.includes(request.user.role)) {
      throw new AppError(403, ErrorCodes.FORBIDDEN, 'Insufficient permissions');
    }
  };
}

/**
 * Fastify preHandler that restricts access to users with the PROVIDER role.
 * Must be used after the `authenticate` preHandler.
 */
export const requireProvider = requireRole('PROVIDER');

/**
 * Fastify preHandler that restricts access to users with the DRIVER role.
 * Must be used after the `authenticate` preHandler.
 */
export const requireDriver = requireRole('DRIVER');

/**
 * Fastify preHandler that restricts access to users with the ADMIN role.
 * Must be used after the `authenticate` preHandler.
 */
export const requireAdmin = requireRole('ADMIN');
