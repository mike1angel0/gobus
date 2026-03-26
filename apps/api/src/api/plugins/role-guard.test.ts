import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';

import authPlugin from './auth.js';
import errorHandler from './error-handler.js';
import { requireRole, requireProvider, requireDriver, requireAdmin } from './role-guard.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret-do-not-use-in-prod';

vi.mock('@/infrastructure/config/env.js', () => ({
  getEnv: () => ({
    JWT_SECRET,
    NODE_ENV: 'test',
  }),
}));

vi.mock('@/infrastructure/logger/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

const mockFindUnique = vi.fn();

vi.mock('@/infrastructure/prisma/client.js', () => ({
  getPrisma: () => ({
    user: {
      findUnique: mockFindUnique,
    },
  }),
}));

/** Sign a token for the given role. */
function tokenForRole(role: string, providerId: string | null = null): string {
  const payload = {
    sub: 'user-1',
    email: 'test@example.com',
    role,
    providerId,
    iss: 'transio-api',
    aud: 'transio-client',
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '15m', algorithm: 'HS256' });
}

describe('role-guard', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });

    await app.register(errorHandler);
    await app.register(authPlugin);

    // Routes with different role guards
    app.get('/admin-only', { preHandler: [app.authenticate, requireAdmin] }, () => ({ ok: true }));
    app.get('/provider-only', { preHandler: [app.authenticate, requireProvider] }, () => ({
      ok: true,
    }));
    app.get('/driver-only', { preHandler: [app.authenticate, requireDriver] }, () => ({
      ok: true,
    }));
    app.get(
      '/multi-role',
      { preHandler: [app.authenticate, requireRole('ADMIN', 'PROVIDER')] },
      () => ({ ok: true }),
    );

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: user exists and is active
    mockFindUnique.mockResolvedValue({ id: 'user-1', status: 'ACTIVE' });
  });

  describe('requireAdmin', () => {
    it('allows ADMIN users', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/admin-only',
        headers: { authorization: `Bearer ${tokenForRole('ADMIN')}` },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ ok: true });
    });

    it('rejects PASSENGER users with 403', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/admin-only',
        headers: { authorization: `Bearer ${tokenForRole('PASSENGER')}` },
      });
      expect(response.statusCode).toBe(403);
      const body = response.json();
      expect(body.code).toBe('FORBIDDEN');
      expect(body.detail).toBe('Insufficient permissions');
    });

    it('rejects PROVIDER users with 403', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/admin-only',
        headers: { authorization: `Bearer ${tokenForRole('PROVIDER')}` },
      });
      expect(response.statusCode).toBe(403);
    });

    it('rejects DRIVER users with 403', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/admin-only',
        headers: { authorization: `Bearer ${tokenForRole('DRIVER')}` },
      });
      expect(response.statusCode).toBe(403);
    });
  });

  describe('requireProvider', () => {
    it('allows PROVIDER users', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/provider-only',
        headers: { authorization: `Bearer ${tokenForRole('PROVIDER', 'prov-1')}` },
      });
      expect(response.statusCode).toBe(200);
    });

    it('rejects PASSENGER users with 403', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/provider-only',
        headers: { authorization: `Bearer ${tokenForRole('PASSENGER')}` },
      });
      expect(response.statusCode).toBe(403);
    });
  });

  describe('requireDriver', () => {
    it('allows DRIVER users', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/driver-only',
        headers: { authorization: `Bearer ${tokenForRole('DRIVER')}` },
      });
      expect(response.statusCode).toBe(200);
    });

    it('rejects ADMIN users with 403', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/driver-only',
        headers: { authorization: `Bearer ${tokenForRole('ADMIN')}` },
      });
      expect(response.statusCode).toBe(403);
    });
  });

  describe('requireRole with multiple roles', () => {
    it('allows ADMIN users', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/multi-role',
        headers: { authorization: `Bearer ${tokenForRole('ADMIN')}` },
      });
      expect(response.statusCode).toBe(200);
    });

    it('allows PROVIDER users', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/multi-role',
        headers: { authorization: `Bearer ${tokenForRole('PROVIDER')}` },
      });
      expect(response.statusCode).toBe(200);
    });

    it('rejects PASSENGER users', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/multi-role',
        headers: { authorization: `Bearer ${tokenForRole('PASSENGER')}` },
      });
      expect(response.statusCode).toBe(403);
    });

    it('rejects DRIVER users', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/multi-role',
        headers: { authorization: `Bearer ${tokenForRole('DRIVER')}` },
      });
      expect(response.statusCode).toBe(403);
    });
  });

  describe('role guard with account status checks', () => {
    it('returns 403 for suspended user before role check', async () => {
      mockFindUnique.mockResolvedValueOnce({ id: 'user-1', status: 'SUSPENDED' });
      const response = await app.inject({
        method: 'GET',
        url: '/admin-only',
        headers: { authorization: `Bearer ${tokenForRole('ADMIN')}` },
      });
      expect(response.statusCode).toBe(403);
      expect(response.json().code).toBe('ACCOUNT_SUSPENDED');
    });

    it('returns 423 for locked user before role check', async () => {
      mockFindUnique.mockResolvedValueOnce({ id: 'user-1', status: 'LOCKED' });
      const response = await app.inject({
        method: 'GET',
        url: '/admin-only',
        headers: { authorization: `Bearer ${tokenForRole('ADMIN')}` },
      });
      expect(response.statusCode).toBe(423);
      expect(response.json().code).toBe('ACCOUNT_LOCKED');
    });
  });

  describe('RFC 9457 format', () => {
    it('returns proper Problem Details for 403 role rejection', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/admin-only',
        headers: { authorization: `Bearer ${tokenForRole('PASSENGER')}` },
      });
      const body = response.json();
      expect(body).toEqual({
        type: 'https://httpstatuses.com/403',
        title: 'Forbidden',
        status: 403,
        detail: 'Insufficient permissions',
        code: 'FORBIDDEN',
      });
    });
  });
});
