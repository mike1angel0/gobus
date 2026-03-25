import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import supertest from 'supertest';

import { createTestApp, createAuthHeader } from '@/test/helpers.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret-do-not-use-in-prod';

// --- Mock setup ---
const mockUserFindUnique = vi.fn();
const mockProviderFindUnique = vi.fn();

const mockPrisma = {
  user: {
    findUnique: mockUserFindUnique,
  },
  provider: {
    findUnique: mockProviderFindUnique,
  },
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

function makeDbProvider(overrides: Record<string, unknown> = {}) {
  return {
    id: 'prov-1',
    name: 'Test Bus Company',
    logo: null,
    contactEmail: 'contact@testbus.com',
    contactPhone: '+40700000000',
    status: 'APPROVED' as const,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('Provider Routes', () => {
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

  // --- GET /api/v1/providers/me ---
  describe('GET /api/v1/providers/me', () => {
    it('returns 200 with provider profile for authenticated provider user', async () => {
      const provider = makeDbProvider();
      // Auth plugin: check user status
      mockUserFindUnique.mockResolvedValueOnce({ id: 'user-1', status: 'ACTIVE' });
      // ProviderService.getByUserId: find user to get providerId
      mockUserFindUnique.mockResolvedValueOnce({ id: 'user-1', providerId: 'prov-1' });
      // ProviderService.getById: find provider
      mockProviderFindUnique.mockResolvedValueOnce(provider);

      const authHeader = createAuthHeader('user-1', 'PROVIDER', {
        email: 'provider@test.com',
        providerId: 'prov-1',
      });

      const response = await supertest(app.server)
        .get('/api/v1/providers/me')
        .set('Authorization', authHeader)
        .expect(200);

      expect(response.body.data.id).toBe('prov-1');
      expect(response.body.data.name).toBe('Test Bus Company');
      expect(response.body.data.logo).toBeNull();
      expect(response.body.data.contactEmail).toBe('contact@testbus.com');
      expect(response.body.data.contactPhone).toBe('+40700000000');
      expect(response.body.data.status).toBe('APPROVED');
      expect(response.body.data.createdAt).toBe('2024-01-01T00:00:00.000Z');
      expect(response.body.data.updatedAt).toBe('2024-01-01T00:00:00.000Z');
    });

    it('returns 401 without authentication', async () => {
      const response = await supertest(app.server).get('/api/v1/providers/me').expect(401);

      expect(response.body.status).toBe(401);
    });

    it('returns 403 for non-provider role (PASSENGER)', async () => {
      // Auth plugin: check user status
      mockUserFindUnique.mockResolvedValueOnce({ id: 'user-2', status: 'ACTIVE' });

      const authHeader = createAuthHeader('user-2', 'PASSENGER', {
        email: 'passenger@test.com',
      });

      const response = await supertest(app.server)
        .get('/api/v1/providers/me')
        .set('Authorization', authHeader)
        .expect(403);

      expect(response.body.status).toBe(403);
      expect(response.body.code).toBe('FORBIDDEN');
    });

    it('returns 404 when user has no associated provider', async () => {
      // Auth plugin: check user status
      mockUserFindUnique.mockResolvedValueOnce({ id: 'user-3', status: 'ACTIVE' });
      // ProviderService.getByUserId: user has no providerId
      mockUserFindUnique.mockResolvedValueOnce({ id: 'user-3', providerId: null });

      const authHeader = createAuthHeader('user-3', 'PROVIDER', {
        email: 'orphan@test.com',
      });

      const response = await supertest(app.server)
        .get('/api/v1/providers/me')
        .set('Authorization', authHeader)
        .expect(404);

      expect(response.body.status).toBe(404);
      expect(response.body.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('returns 403 for DRIVER role', async () => {
      // Auth plugin: check user status
      mockUserFindUnique.mockResolvedValueOnce({ id: 'user-4', status: 'ACTIVE' });

      const authHeader = createAuthHeader('user-4', 'DRIVER', {
        email: 'driver@test.com',
        providerId: 'prov-1',
      });

      const response = await supertest(app.server)
        .get('/api/v1/providers/me')
        .set('Authorization', authHeader)
        .expect(403);

      expect(response.body.status).toBe(403);
      expect(response.body.code).toBe('FORBIDDEN');
    });
  });
});
