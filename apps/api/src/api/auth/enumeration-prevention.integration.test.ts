import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import supertest from 'supertest';
import bcrypt from 'bcryptjs';

import { createTestApp } from '@/test/helpers.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret-do-not-use-in-prod';

// --- Mock setup ---
const mockUserFindUnique = vi.fn();
const mockUserCreate = vi.fn();
const mockProviderCreate = vi.fn();
const mockRefreshTokenCreate = vi.fn();
const mockPasswordResetTokenCreate = vi.fn();

const mockPrisma = {
  user: {
    findUnique: mockUserFindUnique,
    create: mockUserCreate,
    update: vi.fn(),
  },
  provider: {
    create: mockProviderCreate,
  },
  refreshToken: {
    findUnique: vi.fn(),
    create: mockRefreshTokenCreate,
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  passwordResetToken: {
    findUnique: vi.fn(),
    create: mockPasswordResetTokenCreate,
    update: vi.fn(),
  },
  $transaction: vi.fn((actions: unknown[]) => Promise.all(actions)),
};

vi.mock('@/infrastructure/prisma/client.js', () => ({
  getPrisma: () => mockPrisma,
}));

vi.mock('@/infrastructure/config/env.js', () => ({
  getEnv: () => ({
    JWT_SECRET,
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/transio_test',
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
    email: 'existing@example.com',
    name: 'Existing User',
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

describe('Account Enumeration Prevention', () => {
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
  });

  // --- Registration enumeration prevention ---
  describe('Registration: identical response for new and existing emails', () => {
    it('returns 201 with auth data for new email', async () => {
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
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user).toHaveProperty('id');
      expect(response.body.data.user).toHaveProperty('email');
    });

    it('returns 201 with same response shape for existing email', async () => {
      mockUserFindUnique.mockResolvedValueOnce(makeDbUser()); // email exists

      const response = await supertest(app.server)
        .post('/api/v1/auth/register')
        .send({
          email: 'existing@example.com',
          password: 'StrongPass1',
          name: 'Some Name',
          role: 'PASSENGER',
        })
        .expect(201);

      // Identical response shape — attacker cannot distinguish
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user).toHaveProperty('id');
      expect(response.body.data.user.email).toBe('existing@example.com');
      expect(response.body.data.user.role).toBe('PASSENGER');
    });

    it('does not create user or store tokens for existing email', async () => {
      mockUserFindUnique.mockResolvedValueOnce(makeDbUser());

      await supertest(app.server)
        .post('/api/v1/auth/register')
        .send({
          email: 'existing@example.com',
          password: 'StrongPass1',
          name: 'Some Name',
          role: 'PASSENGER',
        })
        .expect(201);

      expect(mockUserCreate).not.toHaveBeenCalled();
      expect(mockRefreshTokenCreate).not.toHaveBeenCalled();
    });
  });

  // --- Login enumeration prevention ---
  describe('Login: timing-safe for valid and invalid emails', () => {
    it('returns 401 for non-existent email (timing equalized via dummy bcrypt)', async () => {
      mockUserFindUnique.mockResolvedValueOnce(null);

      const response = await supertest(app.server)
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@example.com', password: 'Password1' })
        .expect(401);

      expect(response.body.code).toBe('AUTH_INVALID_CREDENTIALS');
      expect(response.body.detail).toBe('Invalid email or password');
    });

    it('returns 401 for existing email with wrong password (same error)', async () => {
      mockUserFindUnique.mockResolvedValueOnce(makeDbUser());
      mockPrisma.user.update.mockResolvedValueOnce({});

      const response = await supertest(app.server)
        .post('/api/v1/auth/login')
        .send({ email: 'existing@example.com', password: 'WrongPass1' })
        .expect(401);

      // Same error code and message — attacker cannot distinguish
      expect(response.body.code).toBe('AUTH_INVALID_CREDENTIALS');
      expect(response.body.detail).toBe('Invalid email or password');
    });

    it('response times for valid/invalid emails within tolerance', async () => {
      // Warmup bcrypt JIT to reduce variance
      const bcrypt = await import('bcryptjs');
      await bcrypt.hash('warmup', 4);

      // Run multiple iterations and compare averages to reduce noise
      const iterations = 3;
      let invalidTotal = 0;
      let validTotal = 0;

      for (let i = 0; i < iterations; i++) {
        // Non-existent email path
        mockUserFindUnique.mockResolvedValueOnce(null);
        const startInvalid = performance.now();
        await supertest(app.server)
          .post('/api/v1/auth/login')
          .send({ email: 'nobody@example.com', password: 'Password1' });
        invalidTotal += performance.now() - startInvalid;

        // Existing email, wrong password path
        mockUserFindUnique.mockResolvedValueOnce(makeDbUser());
        mockPrisma.user.update.mockResolvedValueOnce({});
        const startValid = performance.now();
        await supertest(app.server)
          .post('/api/v1/auth/login')
          .send({ email: 'existing@example.com', password: 'WrongPass1' });
        validTotal += performance.now() - startValid;
      }

      const avgInvalid = invalidTotal / iterations;
      const avgValid = validTotal / iterations;
      const timeDiff = Math.abs(avgInvalid - avgValid);

      // Both paths run bcrypt so timing should be similar
      // Using 500ms tolerance to account for test environment variance
      expect(timeDiff).toBeLessThan(500);
    });
  });

  // --- Forgot-password enumeration prevention ---
  describe('Forgot-password: identical response for existing and non-existing emails', () => {
    it('returns 200 with generic message for existing email', async () => {
      mockUserFindUnique.mockResolvedValueOnce(makeDbUser());
      mockPasswordResetTokenCreate.mockResolvedValueOnce({});

      const response = await supertest(app.server)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'existing@example.com' })
        .expect(200);

      expect(response.body.data.message).toBe(
        'If the email exists, a password reset link has been sent.',
      );
    });

    it('returns 200 with identical message for non-existing email', async () => {
      mockUserFindUnique.mockResolvedValueOnce(null);

      const response = await supertest(app.server)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'nobody@example.com' })
        .expect(200);

      expect(response.body.data.message).toBe(
        'If the email exists, a password reset link has been sent.',
      );
    });

    it('response times for existing/non-existing emails within tolerance', async () => {
      // Warmup bcrypt JIT
      const bcrypt = await import('bcryptjs');
      await bcrypt.hash('warmup', 4);

      const iterations = 3;
      let existingTotal = 0;
      let missingTotal = 0;

      for (let i = 0; i < iterations; i++) {
        // Existing email path
        mockUserFindUnique.mockResolvedValueOnce(makeDbUser());
        mockPasswordResetTokenCreate.mockResolvedValueOnce({});
        const startExisting = performance.now();
        await supertest(app.server)
          .post('/api/v1/auth/forgot-password')
          .send({ email: 'existing@example.com' });
        existingTotal += performance.now() - startExisting;

        // Non-existing email path (now includes bcrypt hash for timing equalization)
        mockUserFindUnique.mockResolvedValueOnce(null);
        const startMissing = performance.now();
        await supertest(app.server)
          .post('/api/v1/auth/forgot-password')
          .send({ email: 'nobody@example.com' });
        missingTotal += performance.now() - startMissing;
      }

      const avgExisting = existingTotal / iterations;
      const avgMissing = missingTotal / iterations;
      const timeDiff = Math.abs(avgExisting - avgMissing);

      // Both paths now include bcrypt work for timing equalization
      // Using 500ms tolerance to account for test environment variance
      expect(timeDiff).toBeLessThan(500);
    });
  });
});
