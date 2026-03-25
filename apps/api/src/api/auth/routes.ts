import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

import { AuthService } from '@/application/services/auth.service.js';
import type { UserEntity } from '@/domain/users/user.entity.js';
import { getPrisma } from '@/infrastructure/prisma/client.js';
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
  app.post('/api/v1/auth/register', async (request, reply) => {
    const body = registerBodySchema.parse(request.body);
    const { user, tokens } = await authService.register(body);

    return reply.status(201).send({
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: serializeUser(user),
      },
    });
  });

  // POST /api/v1/auth/login
  app.post('/api/v1/auth/login', async (request) => {
    const body = loginBodySchema.parse(request.body);
    const { user, tokens } = await authService.login(body, request.ip);

    return {
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: serializeUser(user),
      },
    };
  });

  // POST /api/v1/auth/refresh
  app.post('/api/v1/auth/refresh', async (request) => {
    const body = tokenRefreshBodySchema.parse(request.body);
    const tokens = await authService.refreshToken(body.refreshToken);

    return {
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    };
  });

  // POST /api/v1/auth/logout
  app.post(
    '/api/v1/auth/logout',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const body = logoutBodySchema.parse(request.body);
      await authService.logout(request.user.id, body.refreshToken);

      return reply.status(204).send();
    },
  );

  // POST /api/v1/auth/forgot-password
  app.post('/api/v1/auth/forgot-password', async (request) => {
    const body = forgotPasswordBodySchema.parse(request.body);
    await authService.forgotPassword(body.email);

    return {
      data: { message: 'If the email exists, a password reset link has been sent.' },
    };
  });

  // POST /api/v1/auth/reset-password
  app.post('/api/v1/auth/reset-password', async (request) => {
    const body = resetPasswordBodySchema.parse(request.body);
    await authService.resetPassword(body.token, body.newPassword);

    return {
      data: { message: 'Password has been reset successfully.' },
    };
  });

  // POST /api/v1/auth/change-password
  app.post(
    '/api/v1/auth/change-password',
    { preHandler: [app.authenticate] },
    async (request) => {
      const body = changePasswordBodySchema.parse(request.body);
      await authService.changePassword(request.user.id, body.currentPassword, body.newPassword);

      return {
        data: { message: 'Password has been changed successfully.' },
      };
    },
  );

  // GET /api/v1/auth/me
  app.get(
    '/api/v1/auth/me',
    { preHandler: [app.authenticate] },
    async (request) => {
      const user = await authService.getProfile(request.user.id);

      return { data: serializeUser(user) };
    },
  );

  // PATCH /api/v1/auth/me
  app.patch(
    '/api/v1/auth/me',
    { preHandler: [app.authenticate] },
    async (request) => {
      const body = updateProfileBodySchema.parse(request.body);
      const user = await authService.updateProfile(request.user.id, body);

      return { data: serializeUser(user) };
    },
  );
}

export default fp(authRoutes, {
  name: 'auth-routes',
  dependencies: ['auth'],
});
