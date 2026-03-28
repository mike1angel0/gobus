import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import supertest from 'supertest';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';

import { createTestApp, createAuthHeader } from '@/test/helpers.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret-do-not-use-in-prod';

// --- Mock setup ---
const mockUserFindUnique = vi.fn();
const mockUserCreate = vi.fn();
const mockUserUpdate = vi.fn();
const mockProviderCreate = vi.fn();
const mockRefreshTokenFindUnique = vi.fn();
const mockRefreshTokenCreate = vi.fn();
const mockRefreshTokenUpdate = vi.fn();
const mockRefreshTokenUpdateMany = vi.fn();
const mockPasswordResetTokenFindUnique = vi.fn();
const mockPasswordResetTokenCreate = vi.fn();
const mockPasswordResetTokenUpdate = vi.fn();
const mockTransaction = vi.fn((actions: unknown[]) => Promise.all(actions));

const mockPrisma = {
  user: {
    findUnique: mockUserFindUnique,
    create: mockUserCreate,
    update: mockUserUpdate,
  },
  provider: {
    create: mockProviderCreate,
  },
  refreshToken: {
    findUnique: mockRefreshTokenFindUnique,
    create: mockRefreshTokenCreate,
    update: mockRefreshTokenUpdate,
    updateMany: mockRefreshTokenUpdateMany,
  },
  passwordResetToken: {
    findUnique: mockPasswordResetTokenFindUnique,
    create: mockPasswordResetTokenCreate,
    update: mockPasswordResetTokenUpdate,
  },
  $transaction: mockTransaction,
};

vi.mock('@/infrastructure/prisma/client.js', () => ({
  getPrisma: () => mockPrisma,
}));

vi.mock('@/infrastructure/config/env.js', () => ({
  getEnv: () => ({
    JWT_SECRET,
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/gobus_test',
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

const PASSWORD_HASH = bcrypt.hashSync('Password1', 4);

function makeDbUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    passwordHash: PASSWORD_HASH,
    role: 'PASSENGER' as const,
    phone: null,
    avatarUrl: null,
    preferences: null,
    providerId: null,
    status: 'ACTIVE' as const,
    failedLoginAttempts: 0,
    lockedUntil: null,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('Auth Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.resetAllMocks();
    // Re-set $transaction mock after reset
    mockTransaction.mockImplementation((actions: unknown[]) => Promise.all(actions));
  });

  // --- POST /api/v1/auth/register ---
  describe('POST /api/v1/auth/register', () => {
    it('registers a new passenger and returns 201 with auth data', async () => {
      const newUser = makeDbUser({ id: 'new-user-1', email: 'new@example.com' });
      mockUserFindUnique.mockResolvedValueOnce(null); // email not taken
      mockUserCreate.mockResolvedValueOnce(newUser);
      mockRefreshTokenCreate.mockResolvedValueOnce({});

      const response = await supertest(app.server)
        .post('/api/v1/auth/register')
        .send({
          email: 'new@example.com',
          password: 'StrongPass1',
          name: 'New User',
          role: 'PASSENGER',
        })
        .expect(201);

      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data.user.email).toBe('new@example.com');
      expect(response.body.data.user.role).toBe('PASSENGER');
    });

    it('registers a provider with providerName', async () => {
      const provider = { id: 'prov-1', name: 'My Bus Co' };
      const newUser = makeDbUser({
        id: 'prov-user',
        email: 'prov@example.com',
        role: 'PROVIDER',
        providerId: 'prov-1',
      });
      mockUserFindUnique.mockResolvedValueOnce(null); // email not taken
      mockProviderCreate.mockResolvedValueOnce(provider);
      mockUserCreate.mockResolvedValueOnce(newUser);
      mockRefreshTokenCreate.mockResolvedValueOnce({});

      const response = await supertest(app.server)
        .post('/api/v1/auth/register')
        .send({
          email: 'prov@example.com',
          password: 'StrongPass1',
          name: 'Provider Admin',
          role: 'PROVIDER',
          providerName: 'My Bus Co',
        })
        .expect(201);

      expect(response.body.data.user.role).toBe('PROVIDER');
      expect(response.body.data.user.providerId).toBe('prov-1');
    });

    it('returns 201 with fake success for duplicate email (prevents enumeration)', async () => {
      mockUserFindUnique.mockResolvedValueOnce(makeDbUser()); // email exists

      const response = await supertest(app.server)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'StrongPass1',
          name: 'Duplicate',
          role: 'PASSENGER',
        })
        .expect(201);

      // Response shape is identical to real registration
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data.user.email).toBe('test@example.com');
      // No user was actually created
      expect(mockUserCreate).not.toHaveBeenCalled();
    });

    it('returns 400 for weak password', async () => {
      const response = await supertest(app.server)
        .post('/api/v1/auth/register')
        .send({
          email: 'new@example.com',
          password: 'weak',
          name: 'User',
          role: 'PASSENGER',
        })
        .expect(400);

      expect(response.body.status).toBe(400);
    });

    it('rejects unknown fields via strict parsing', async () => {
      const response = await supertest(app.server)
        .post('/api/v1/auth/register')
        .send({
          email: 'new@example.com',
          password: 'StrongPass1',
          name: 'User',
          role: 'PASSENGER',
          isAdmin: true,
        })
        .expect(400);

      expect(response.body.status).toBe(400);
    });
  });

  // --- POST /api/v1/auth/login ---
  describe('POST /api/v1/auth/login', () => {
    it('returns 200 with auth data on valid credentials', async () => {
      const user = makeDbUser();
      mockUserFindUnique.mockResolvedValueOnce(user);
      mockRefreshTokenCreate.mockResolvedValueOnce({});

      const response = await supertest(app.server)
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com', password: 'Password1' })
        .expect(200);

      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data.user.email).toBe('test@example.com');
      expect(response.body.data.user.id).toBe('user-1');
    });

    it('returns 401 for invalid credentials', async () => {
      mockUserFindUnique.mockResolvedValueOnce(null);

      const response = await supertest(app.server)
        .post('/api/v1/auth/login')
        .send({ email: 'bad@example.com', password: 'Password1' })
        .expect(401);

      expect(response.body.code).toBe('AUTH_INVALID_CREDENTIALS');
    });

    it('returns 403 for suspended account', async () => {
      mockUserFindUnique.mockResolvedValueOnce(makeDbUser({ status: 'SUSPENDED' }));

      const response = await supertest(app.server)
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com', password: 'Password1' })
        .expect(403);

      expect(response.body.code).toBe('ACCOUNT_SUSPENDED');
    });

    it('returns 423 for locked account', async () => {
      mockUserFindUnique.mockResolvedValueOnce(
        makeDbUser({
          status: 'LOCKED',
          lockedUntil: new Date(Date.now() + 60 * 60 * 1000),
        }),
      );

      const response = await supertest(app.server)
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com', password: 'Password1' })
        .expect(423);

      expect(response.body.code).toBe('ACCOUNT_LOCKED');
    });

    it('returns 400 for missing required fields', async () => {
      const response = await supertest(app.server)
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com' })
        .expect(400);

      expect(response.body.status).toBe(400);
    });
  });

  // --- POST /api/v1/auth/refresh ---
  describe('POST /api/v1/auth/refresh', () => {
    it('returns 200 with new token pair', async () => {
      const rawToken = randomBytes(40).toString('hex');
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');
      const user = makeDbUser();

      mockRefreshTokenFindUnique.mockResolvedValueOnce({
        id: 'rt-1',
        token: tokenHash,
        userId: 'user-1',
        user,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
      mockRefreshTokenUpdate.mockResolvedValueOnce({});
      mockRefreshTokenCreate.mockResolvedValueOnce({});

      const response = await supertest(app.server)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: rawToken })
        .expect(200);

      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
    });

    it('returns 401 for invalid refresh token', async () => {
      mockRefreshTokenFindUnique.mockResolvedValueOnce(null);

      const response = await supertest(app.server)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body.code).toBe('AUTH_TOKEN_EXPIRED');
    });

    it('returns 401 for revoked token (reuse detection)', async () => {
      mockRefreshTokenFindUnique.mockResolvedValueOnce({
        id: 'rt-1',
        token: 'hash',
        userId: 'user-1',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
      mockRefreshTokenUpdateMany.mockResolvedValueOnce({ count: 1 });

      const response = await supertest(app.server)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'some-token' })
        .expect(401);

      expect(response.body.code).toBe('AUTH_TOKEN_EXPIRED');
    });
  });

  // --- POST /api/v1/auth/logout ---
  describe('POST /api/v1/auth/logout', () => {
    it('returns 204 on successful logout', async () => {
      // Auth plugin: check user status
      mockUserFindUnique.mockResolvedValueOnce({ id: 'user-1', status: 'ACTIVE' });
      // Service: find refresh token
      mockRefreshTokenFindUnique.mockResolvedValueOnce({
        id: 'rt-1',
        token: 'hash',
        userId: 'user-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
      mockRefreshTokenUpdate.mockResolvedValueOnce({});

      const authHeader = createAuthHeader('user-1', 'PASSENGER');

      await supertest(app.server)
        .post('/api/v1/auth/logout')
        .set('Authorization', authHeader)
        .send({ refreshToken: 'some-refresh-token' })
        .expect(204);
    });

    it('returns 401 without auth header', async () => {
      const response = await supertest(app.server)
        .post('/api/v1/auth/logout')
        .send({ refreshToken: 'some-token' })
        .expect(401);

      expect(response.body.status).toBe(401);
    });
  });

  // --- POST /api/v1/auth/forgot-password ---
  describe('POST /api/v1/auth/forgot-password', () => {
    it('always returns 200 with message (existing email)', async () => {
      mockUserFindUnique.mockResolvedValueOnce(makeDbUser());
      mockPasswordResetTokenCreate.mockResolvedValueOnce({});

      const response = await supertest(app.server)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'test@example.com' })
        .expect(200);

      expect(response.body.data.message).toBe(
        'If the email exists, a password reset link has been sent.',
      );
    });

    it('always returns 200 with message (non-existing email)', async () => {
      mockUserFindUnique.mockResolvedValueOnce(null);

      const response = await supertest(app.server)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'nobody@example.com' })
        .expect(200);

      expect(response.body.data.message).toBe(
        'If the email exists, a password reset link has been sent.',
      );
    });

    it('returns 400 for invalid email format', async () => {
      const response = await supertest(app.server)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'not-an-email' })
        .expect(400);

      expect(response.body.status).toBe(400);
    });
  });

  // --- POST /api/v1/auth/reset-password ---
  describe('POST /api/v1/auth/reset-password', () => {
    it('returns 200 on successful password reset', async () => {
      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');

      mockPasswordResetTokenFindUnique.mockResolvedValueOnce({
        id: 'prt-1',
        token: tokenHash,
        userId: 'user-1',
        usedAt: null,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });
      // Transaction mocks (user.update, passwordResetToken.update, refreshToken.updateMany)
      mockUserUpdate.mockResolvedValueOnce(makeDbUser());
      mockPasswordResetTokenUpdate.mockResolvedValueOnce({});
      mockRefreshTokenUpdateMany.mockResolvedValueOnce({ count: 0 });

      const response = await supertest(app.server)
        .post('/api/v1/auth/reset-password')
        .send({ token: rawToken, newPassword: 'NewPassword1' })
        .expect(200);

      expect(response.body.data.message).toBe('Password has been reset successfully.');
    });

    it('returns 400 for invalid reset token', async () => {
      mockPasswordResetTokenFindUnique.mockResolvedValueOnce(null);

      const response = await supertest(app.server)
        .post('/api/v1/auth/reset-password')
        .send({ token: 'bad-token', newPassword: 'NewPassword1' })
        .expect(400);

      expect(response.body.code).toBe('AUTH_INVALID_RESET_TOKEN');
    });

    it('returns 400 for weak new password', async () => {
      const response = await supertest(app.server)
        .post('/api/v1/auth/reset-password')
        .send({ token: 'any-token', newPassword: 'weak' })
        .expect(400);

      expect(response.body.status).toBe(400);
    });

    it('returns 400 for expired reset token', async () => {
      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');

      mockPasswordResetTokenFindUnique.mockResolvedValueOnce({
        id: 'prt-1',
        token: tokenHash,
        userId: 'user-1',
        usedAt: null,
        expiresAt: new Date(Date.now() - 60 * 60 * 1000), // expired
      });

      const response = await supertest(app.server)
        .post('/api/v1/auth/reset-password')
        .send({ token: rawToken, newPassword: 'NewPassword1' })
        .expect(400);

      expect(response.body.code).toBe('AUTH_INVALID_RESET_TOKEN');
    });
  });

  // --- POST /api/v1/auth/change-password ---
  describe('POST /api/v1/auth/change-password', () => {
    it('returns 200 on successful password change', async () => {
      const user = makeDbUser();
      // Auth plugin: check user status
      mockUserFindUnique.mockResolvedValueOnce({ id: 'user-1', status: 'ACTIVE' });
      // Service: find user for password check
      mockUserFindUnique.mockResolvedValueOnce(user);
      // Transaction
      mockUserUpdate.mockResolvedValueOnce(user);
      mockRefreshTokenUpdateMany.mockResolvedValueOnce({ count: 0 });

      const authHeader = createAuthHeader('user-1', 'PASSENGER');

      const response = await supertest(app.server)
        .post('/api/v1/auth/change-password')
        .set('Authorization', authHeader)
        .send({ currentPassword: 'Password1', newPassword: 'NewPassword1' })
        .expect(200);

      expect(response.body.data.message).toBe('Password has been changed successfully.');
    });

    it('returns 401 for incorrect current password', async () => {
      const user = makeDbUser();
      mockUserFindUnique.mockResolvedValueOnce({ id: 'user-1', status: 'ACTIVE' }); // auth plugin
      mockUserFindUnique.mockResolvedValueOnce(user); // service

      const authHeader = createAuthHeader('user-1', 'PASSENGER');

      const response = await supertest(app.server)
        .post('/api/v1/auth/change-password')
        .set('Authorization', authHeader)
        .send({ currentPassword: 'WrongPassword1', newPassword: 'NewPassword1' })
        .expect(401);

      expect(response.body.code).toBe('AUTH_INVALID_CREDENTIALS');
    });

    it('returns 401 without authentication', async () => {
      const response = await supertest(app.server)
        .post('/api/v1/auth/change-password')
        .send({ currentPassword: 'Password1', newPassword: 'NewPassword1' })
        .expect(401);

      expect(response.body.status).toBe(401);
    });

    it('returns 400 for weak new password', async () => {
      mockUserFindUnique.mockResolvedValueOnce({ id: 'user-1', status: 'ACTIVE' }); // auth plugin

      const authHeader = createAuthHeader('user-1', 'PASSENGER');

      const response = await supertest(app.server)
        .post('/api/v1/auth/change-password')
        .set('Authorization', authHeader)
        .send({ currentPassword: 'Password1', newPassword: 'weak' })
        .expect(400);

      expect(response.body.status).toBe(400);
    });
  });

  // --- GET /api/v1/auth/me ---
  describe('GET /api/v1/auth/me', () => {
    it('returns 200 with user profile', async () => {
      const user = makeDbUser();
      mockUserFindUnique.mockResolvedValueOnce({ id: 'user-1', status: 'ACTIVE' }); // auth plugin
      mockUserFindUnique.mockResolvedValueOnce(user); // getProfile

      const authHeader = createAuthHeader('user-1', 'PASSENGER');

      const response = await supertest(app.server)
        .get('/api/v1/auth/me')
        .set('Authorization', authHeader)
        .expect(200);

      expect(response.body.data.id).toBe('user-1');
      expect(response.body.data.email).toBe('test@example.com');
      expect(response.body.data.role).toBe('PASSENGER');
      expect(response.body.data.createdAt).toBe('2024-01-01T00:00:00.000Z');
      expect(response.body.data.updatedAt).toBe('2024-01-01T00:00:00.000Z');
    });

    it('returns 401 without authentication', async () => {
      const response = await supertest(app.server).get('/api/v1/auth/me').expect(401);

      expect(response.body.status).toBe(401);
    });
  });

  // --- PATCH /api/v1/auth/me ---
  describe('PATCH /api/v1/auth/me', () => {
    it('returns 200 with updated user profile', async () => {
      const user = makeDbUser();
      const updatedUser = makeDbUser({ name: 'Updated Name', phone: '+40700000000' });
      mockUserFindUnique.mockResolvedValueOnce({ id: 'user-1', status: 'ACTIVE' }); // auth plugin
      mockUserFindUnique.mockResolvedValueOnce(user); // updateProfile find
      mockUserUpdate.mockResolvedValueOnce(updatedUser);

      const authHeader = createAuthHeader('user-1', 'PASSENGER');

      const response = await supertest(app.server)
        .patch('/api/v1/auth/me')
        .set('Authorization', authHeader)
        .send({ name: 'Updated Name', phone: '+40700000000' })
        .expect(200);

      expect(response.body.data.name).toBe('Updated Name');
      expect(response.body.data.phone).toBe('+40700000000');
    });

    it('updates preferences', async () => {
      const user = makeDbUser();
      const updatedUser = makeDbUser({
        preferences: { language: 'ro', notifications: true, emailNotifications: false },
      });
      mockUserFindUnique.mockResolvedValueOnce({ id: 'user-1', status: 'ACTIVE' }); // auth plugin
      mockUserFindUnique.mockResolvedValueOnce(user); // updateProfile find
      mockUserUpdate.mockResolvedValueOnce(updatedUser);

      const authHeader = createAuthHeader('user-1', 'PASSENGER');

      const response = await supertest(app.server)
        .patch('/api/v1/auth/me')
        .set('Authorization', authHeader)
        .send({
          preferences: { language: 'ro', notifications: true, emailNotifications: false },
        })
        .expect(200);

      expect(response.body.data.preferences).toEqual({
        language: 'ro',
        notifications: true,
        emailNotifications: false,
      });
    });

    it('returns 401 without authentication', async () => {
      const response = await supertest(app.server)
        .patch('/api/v1/auth/me')
        .send({ name: 'Hacker' })
        .expect(401);

      expect(response.body.status).toBe(401);
    });

    it('rejects unknown fields via strict parsing', async () => {
      mockUserFindUnique.mockResolvedValueOnce({ id: 'user-1', status: 'ACTIVE' }); // auth plugin

      const authHeader = createAuthHeader('user-1', 'PASSENGER');

      const response = await supertest(app.server)
        .patch('/api/v1/auth/me')
        .set('Authorization', authHeader)
        .send({ name: 'Ok', role: 'ADMIN' })
        .expect(400);

      expect(response.body.status).toBe(400);
    });
  });
});
