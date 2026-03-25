import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import jwt from 'jsonwebtoken';

import type { AuthTokenPayload } from '@/domain/auth/auth.types.js';
import { AppError } from '@/domain/errors/app-error.js';
import { ErrorCodes } from '@/domain/errors/error-codes.js';
import { getEnv } from '@/infrastructure/config/env.js';
import { getPrisma } from '@/infrastructure/prisma/client.js';
import { createLogger } from '@/infrastructure/logger/logger.js';

const logger = createLogger('AuthPlugin');

/** Authenticated user data attached to each request after JWT validation. */
export interface RequestUser {
  /** User's unique identifier (from JWT `sub` claim). */
  id: string;
  /** User's email address. */
  email: string;
  /** User's role determining access level. */
  role: 'PASSENGER' | 'PROVIDER' | 'DRIVER' | 'ADMIN';
  /** Associated provider ID (for PROVIDER and DRIVER roles). */
  providerId: string | null;
}

// Fastify type augmentation
declare module 'fastify' {
  interface FastifyRequest {
    user: RequestUser;
  }

  interface FastifyInstance {
    /** PreHandler that validates JWT and attaches user to request. */
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

/**
 * Extract and validate JWT from the Authorization header.
 * Returns the decoded token payload or throws an AppError.
 */
function extractAndVerifyToken(request: FastifyRequest): AuthTokenPayload {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError(
      401,
      ErrorCodes.AUTH_INVALID_CREDENTIALS,
      'Missing or invalid authorization header',
    );
  }

  const token = authHeader.slice(7);

  if (!token) {
    throw new AppError(401, ErrorCodes.AUTH_INVALID_CREDENTIALS, 'Missing access token');
  }

  const env = getEnv();

  try {
    return jwt.verify(token, env.JWT_SECRET) as AuthTokenPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError(401, ErrorCodes.AUTH_TOKEN_EXPIRED, 'Access token has expired');
    }
    throw new AppError(401, ErrorCodes.AUTH_INVALID_CREDENTIALS, 'Invalid access token');
  }
}

/**
 * Fastify preHandler that validates the JWT access token,
 * checks user status in the database, and attaches user data to the request.
 */
async function authenticateHandler(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const payload = extractAndVerifyToken(request);

  // Look up user status in DB to enforce suspended/locked
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, status: true },
  });

  if (!user) {
    throw new AppError(401, ErrorCodes.AUTH_INVALID_CREDENTIALS, 'User not found');
  }

  if (user.status === 'SUSPENDED') {
    throw new AppError(403, ErrorCodes.ACCOUNT_SUSPENDED, 'Account is suspended');
  }

  if (user.status === 'LOCKED') {
    throw new AppError(
      423,
      ErrorCodes.ACCOUNT_LOCKED,
      'Account is locked due to too many failed login attempts',
    );
  }

  request.user = {
    id: payload.sub,
    email: payload.email,
    role: payload.role,
    providerId: payload.providerId,
  };

  logger.debug('Request authenticated', { userId: payload.sub, role: payload.role });
}

/**
 * Register the authentication plugin.
 * Decorates the request with a `user` property and exposes an `authenticate` preHandler.
 */
async function authPlugin(app: FastifyInstance): Promise<void> {
  // Decorate with default value so Fastify knows the property exists
  app.decorateRequest('user', null as unknown as RequestUser);

  // Expose authenticate as a named decorator for use in route hooks
  app.decorate('authenticate', authenticateHandler);
}

export default fp(authPlugin, {
  name: 'auth',
});
