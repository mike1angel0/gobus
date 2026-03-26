import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

import { AuthService } from '@/application/services/auth.service.js';
import { AUTH_RATE_LIMIT } from '@/api/plugins/rate-limit.js';
import { AuditActions } from '@/domain/audit/audit-actions.js';
import { AppError } from '@/domain/errors/app-error.js';
import { ErrorCodes } from '@/domain/errors/error-codes.js';
import type { UserEntity } from '@/domain/users/user.entity.js';
import { getPrisma } from '@/infrastructure/prisma/client.js';
import { privateNoCache } from '@/api/plugins/cache-control.js';
import { strictParse } from '@/shared/schemas.js';
import {
  registerBodySchema,
  loginBodySchema,
  tokenRefreshBodySchema,
  logoutBodySchema,
  forgotPasswordBodySchema,
  resetPasswordBodySchema,
  changePasswordBodySchema,
  updateProfileBodySchema,
} from './schemas.js';

/**
 * Serialize a UserEntity to a JSON-safe response object.
 * Converts Date fields to ISO strings to match the OpenAPI spec.
 */
function serializeUser(user: UserEntity): Record<string, unknown> {
  return {
    ...user,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

/**
 * Register all auth routes under the /api/v1/auth prefix.
 * Implements all 9 endpoints from the OpenAPI spec: register, login, refresh,
 * logout, forgot-password, reset-password, change-password, get me, update me.
 */
async function authRoutes(app: FastifyInstance): Promise<void> {
  const authService = new AuthService(getPrisma());

  // POST /api/v1/auth/register
  app.post('/api/v1/auth/register', { config: { rateLimit: AUTH_RATE_LIMIT } }, async (request, reply) => {
    const body = strictParse(registerBodySchema, request.body);
    const { user, tokens } = await authService.register(body);

    request.audit(AuditActions.REGISTER, 'user', user.id);

    return reply.status(201).send({
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: serializeUser(user),
      },
    });
  });

  // POST /api/v1/auth/login
  app.post('/api/v1/auth/login', { config: { rateLimit: AUTH_RATE_LIMIT } }, async (request) => {
    const body = strictParse(loginBodySchema, request.body);

    try {
      const { user, tokens } = await authService.login(body, request.ip);

      request.audit(AuditActions.LOGIN_SUCCESS, 'user', user.id);

      return {
        data: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          user: serializeUser(user),
        },
      };
    } catch (err) {
      if (err instanceof AppError) {
        if (err.code === ErrorCodes.ACCOUNT_LOCKED) {
          request.audit(AuditActions.LOGIN_LOCKED, 'user', null, { email: body.email });
        } else if (err.code === ErrorCodes.AUTH_INVALID_CREDENTIALS) {
          request.audit(AuditActions.LOGIN_FAILURE, 'user', null, { email: body.email });
        }
      }
      throw err;
    }
  });

  // POST /api/v1/auth/refresh
  app.post('/api/v1/auth/refresh', { config: { rateLimit: AUTH_RATE_LIMIT } }, async (request) => {
    const body = strictParse(tokenRefreshBodySchema, request.body);
    const tokens = await authService.refreshToken(body.refreshToken);

    return {
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    };
  });

  // POST /api/v1/auth/logout
  app.post('/api/v1/auth/logout', { preHandler: [app.authenticate] }, async (request, reply) => {
    const body = strictParse(logoutBodySchema, request.body);
    await authService.logout(request.user.id, body.refreshToken);

    request.audit(AuditActions.LOGOUT, 'user', request.user.id);

    return reply.status(204).send();
  });

  // POST /api/v1/auth/forgot-password
  app.post('/api/v1/auth/forgot-password', { config: { rateLimit: AUTH_RATE_LIMIT } }, async (request) => {
    const body = strictParse(forgotPasswordBodySchema, request.body);
    await authService.forgotPassword(body.email);

    request.audit(AuditActions.PASSWORD_RESET_REQUEST, 'user', null, { email: body.email });

    return {
      data: { message: 'If the email exists, a password reset link has been sent.' },
    };
  });

  // POST /api/v1/auth/reset-password
  app.post('/api/v1/auth/reset-password', { config: { rateLimit: AUTH_RATE_LIMIT } }, async (request) => {
    const body = strictParse(resetPasswordBodySchema, request.body);
    await authService.resetPassword(body.token, body.newPassword);

    request.audit(AuditActions.PASSWORD_RESET_COMPLETE, 'user');

    return {
      data: { message: 'Password has been reset successfully.' },
    };
  });

  // POST /api/v1/auth/change-password
  app.post('/api/v1/auth/change-password', { preHandler: [app.authenticate] }, async (request) => {
    const body = strictParse(changePasswordBodySchema, request.body);
    await authService.changePassword(request.user.id, body.currentPassword, body.newPassword);

    request.audit(AuditActions.PASSWORD_CHANGE, 'user', request.user.id);

    return {
      data: { message: 'Password has been changed successfully.' },
    };
  });

  // GET /api/v1/auth/me
  app.get('/api/v1/auth/me', { preHandler: [app.authenticate, privateNoCache] }, async (request) => {
    const user = await authService.getProfile(request.user.id);

    return { data: serializeUser(user) };
  });

  // PATCH /api/v1/auth/me
  app.patch('/api/v1/auth/me', { preHandler: [app.authenticate] }, async (request) => {
    const body = strictParse(updateProfileBodySchema, request.body);
    const user = await authService.updateProfile(request.user.id, body);

    return { data: serializeUser(user) };
  });
}

export default fp(authRoutes, {
  name: 'auth-routes',
  dependencies: ['auth', 'audit'],
});
