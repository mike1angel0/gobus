import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';

import authPlugin from './auth.js';
import errorHandler from './error-handler.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret-do-not-use-in-prod';

// Mock dependencies
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

/** Sign a JWT token with the test secret. */
function signToken(
  payload: Record<string, unknown>,
  options?: jwt.SignOptions,
): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '15m', ...options });
}

/** Create a valid token payload. */
function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    sub: 'user-1',
    email: 'test@example.com',
    role: 'PASSENGER',
    providerId: null,
    ...overrides,
  };
}

describe('auth plugin', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });

    await app.register(errorHandler);
    await app.register(authPlugin);

    // Protected test route
    app.get('/protected', { preHandler: [app.authenticate] }, (request) => {
      return { user: request.user };
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when no authorization header is present', async () => {
    const response = await app.inject({ method: 'GET', url: '/protected' });
    expect(response.statusCode).toBe(401);
    const body = response.json();
    expect(body.status).toBe(401);
    expect(body.code).toBe('AUTH_INVALID_CREDENTIALS');
    expect(body.detail).toBe('Missing or invalid authorization header');
  });

  it('returns 401 when authorization header does not start with Bearer', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: 'Basic abc123' },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json().code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  it('returns 401 when token is invalid', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: 'Bearer invalid-token' },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json().code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  it('returns 401 when token is expired', async () => {
    const token = signToken(validPayload(), { expiresIn: '-1s' });
    const response = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json().code).toBe('AUTH_TOKEN_EXPIRED');
    expect(response.json().detail).toBe('Access token has expired');
  });

  it('returns 401 when token is signed with wrong secret', async () => {
    const token = jwt.sign(validPayload(), 'wrong-secret', { expiresIn: '15m' });
    const response = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json().code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  it('returns 401 when user not found in database', async () => {
    mockFindUnique.mockResolvedValueOnce(null);
    const token = signToken(validPayload());
    const response = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json().code).toBe('AUTH_INVALID_CREDENTIALS');
    expect(response.json().detail).toBe('User not found');
  });

  it('returns 403 when user account is SUSPENDED', async () => {
    mockFindUnique.mockResolvedValueOnce({ id: 'user-1', status: 'SUSPENDED' });
    const token = signToken(validPayload());
    const response = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(403);
    const body = response.json();
    expect(body.code).toBe('ACCOUNT_SUSPENDED');
    expect(body.detail).toBe('Account is suspended');
  });

  it('returns 423 when user account is LOCKED', async () => {
    mockFindUnique.mockResolvedValueOnce({ id: 'user-1', status: 'LOCKED' });
    const token = signToken(validPayload());
    const response = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(423);
    const body = response.json();
    expect(body.code).toBe('ACCOUNT_LOCKED');
    expect(body.detail).toBe('Account is locked due to too many failed login attempts');
  });

  it('attaches user to request on valid token and ACTIVE status', async () => {
    mockFindUnique.mockResolvedValueOnce({ id: 'user-1', status: 'ACTIVE' });
    const token = signToken(validPayload());
    const response = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.user).toEqual({
      id: 'user-1',
      email: 'test@example.com',
      role: 'PASSENGER',
      providerId: null,
    });
  });

  it('attaches providerId for PROVIDER role users', async () => {
    mockFindUnique.mockResolvedValueOnce({ id: 'prov-1', status: 'ACTIVE' });
    const token = signToken(validPayload({ sub: 'prov-1', role: 'PROVIDER', providerId: 'provider-abc' }));
    const response = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().user.providerId).toBe('provider-abc');
    expect(response.json().user.role).toBe('PROVIDER');
  });

  it('queries database with correct user id from token', async () => {
    mockFindUnique.mockResolvedValueOnce({ id: 'user-42', status: 'ACTIVE' });
    const token = signToken(validPayload({ sub: 'user-42' }));
    await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: 'user-42' },
      select: { id: true, status: true },
    });
  });

  it('returns RFC 9457 format for all error responses', async () => {
    const response = await app.inject({ method: 'GET', url: '/protected' });
    const body = response.json();
    expect(body).toHaveProperty('type');
    expect(body).toHaveProperty('title');
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('detail');
    expect(body).toHaveProperty('code');
    expect(body.type).toBe('https://httpstatuses.com/401');
    expect(body.title).toBe('Unauthorized');
  });
});
