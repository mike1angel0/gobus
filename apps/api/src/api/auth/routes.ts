import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

import { AuthService } from '@/application/services/auth.service.js';
import { AUTH_RATE_LIMIT } from '@/api/plugins/rate-limit.js';
import { AuditActions } from '@/domain/audit/audit-actions.js';
import { AppError } from '@/domain/errors/app-error.js';
import { ErrorCodes } from '@/domain/errors/error-codes.js';
import type { UserEntity } from '@/domain/users/user.entity.js';
import { getPrisma } from '@/infrastructure/prisma/client.js';
import { noCache, privateNoCache } from '@/api/plugins/cache-control.js';
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

/** Handle POST /api/v1/auth/register — create a new user account. */
async function handleRegister(
  authService: AuthService,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const body = strictParse(registerBodySchema, request.body);
  const { user, tokens } = await authService.register(body);

  request.audit(AuditActions.REGISTER, 'user', user.id);

  await reply.status(201).send({
    data: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: serializeUser(user),
    },
  });
}

/** Handle POST /api/v1/auth/login — authenticate and return tokens. */
async function handleLogin(
  authService: AuthService,
  request: FastifyRequest,
): Promise<Record<string, unknown>> {
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
}

/** Handle POST /api/v1/auth/refresh — exchange refresh token for new token pair. */
async function handleRefresh(
  authService: AuthService,
  request: FastifyRequest,
): Promise<Record<string, unknown>> {
  const body = strictParse(tokenRefreshBodySchema, request.body);
  const tokens = await authService.refreshToken(body.refreshToken);

  return {
    data: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    },
  };
}

/** Handle POST /api/v1/auth/logout — revoke refresh token and end session. */
async function handleLogout(
  authService: AuthService,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const body = strictParse(logoutBodySchema, request.body);
  await authService.logout(request.user.id, body.refreshToken);

  request.audit(AuditActions.LOGOUT, 'user', request.user.id);

  await reply.status(204).send();
}

/** Handle POST /api/v1/auth/forgot-password — initiate password reset flow. */
async function handleForgotPassword(
  authService: AuthService,
  request: FastifyRequest,
): Promise<Record<string, unknown>> {
  const body = strictParse(forgotPasswordBodySchema, request.body);
  await authService.forgotPassword(body.email);

  request.audit(AuditActions.PASSWORD_RESET_REQUEST, 'user', null, { email: body.email });

  return { data: { message: 'If the email exists, a password reset link has been sent.' } };
}

/** Handle POST /api/v1/auth/reset-password — complete password reset with token. */
async function handleResetPassword(
  authService: AuthService,
  request: FastifyRequest,
): Promise<Record<string, unknown>> {
  const body = strictParse(resetPasswordBodySchema, request.body);
  await authService.resetPassword(body.token, body.newPassword);

  request.audit(AuditActions.PASSWORD_RESET_COMPLETE, 'user');

  return { data: { message: 'Password has been reset successfully.' } };
}

/** Handle POST /api/v1/auth/change-password — change password for authenticated user. */
async function handleChangePassword(
  authService: AuthService,
  request: FastifyRequest,
): Promise<Record<string, unknown>> {
  const body = strictParse(changePasswordBodySchema, request.body);
  await authService.changePassword(request.user.id, body.currentPassword, body.newPassword);

  request.audit(AuditActions.PASSWORD_CHANGE, 'user', request.user.id);

  return { data: { message: 'Password has been changed successfully.' } };
}

/** Handle GET /api/v1/auth/me — return current user profile. */
async function handleGetProfile(
  authService: AuthService,
  request: FastifyRequest,
): Promise<Record<string, unknown>> {
  const user = await authService.getProfile(request.user.id);
  return { data: serializeUser(user) };
}

/** Handle PATCH /api/v1/auth/me — update current user profile. */
async function handleUpdateProfile(
  authService: AuthService,
  request: FastifyRequest,
): Promise<Record<string, unknown>> {
  const body = strictParse(updateProfileBodySchema, request.body);
  const user = await authService.updateProfile(request.user.id, body);
  return { data: serializeUser(user) };
}

/**
 * Register all auth routes under the /api/v1/auth prefix.
 * Implements all 9 endpoints from the OpenAPI spec: register, login, refresh,
 * logout, forgot-password, reset-password, change-password, get me, update me.
 */
async function authRoutes(app: FastifyInstance): Promise<void> {
  const authService = new AuthService(getPrisma());

  const rateLimited = { preHandler: [noCache], config: { rateLimit: AUTH_RATE_LIMIT } };
  const authenticated = { preHandler: [app.authenticate, noCache] };

  app.post('/api/v1/auth/register', rateLimited, (req, reply) =>
    handleRegister(authService, req, reply),
  );
  app.post('/api/v1/auth/login', rateLimited, (req) => handleLogin(authService, req));
  app.post('/api/v1/auth/refresh', rateLimited, (req) => handleRefresh(authService, req));
  app.post('/api/v1/auth/logout', authenticated, (req, reply) =>
    handleLogout(authService, req, reply),
  );
  app.post('/api/v1/auth/forgot-password', rateLimited, (req) =>
    handleForgotPassword(authService, req),
  );
  app.post('/api/v1/auth/reset-password', rateLimited, (req) =>
    handleResetPassword(authService, req),
  );
  app.post('/api/v1/auth/change-password', authenticated, (req) =>
    handleChangePassword(authService, req),
  );
  app.get('/api/v1/auth/me', { preHandler: [app.authenticate, privateNoCache] }, (req) =>
    handleGetProfile(authService, req),
  );
  app.patch('/api/v1/auth/me', authenticated, (req) => handleUpdateProfile(authService, req));
}

export default fp(authRoutes, {
  name: 'auth-routes',
  dependencies: ['auth', 'audit'],
});
