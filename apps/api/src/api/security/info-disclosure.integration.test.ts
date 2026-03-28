import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import supertest from 'supertest';

import { buildApp } from '@/app.js';

// --- Mock setup ---
const mockQueryRawUnsafe = vi.fn();

const mockPrisma = {
  $queryRawUnsafe: mockQueryRawUnsafe,
};

vi.mock('@/infrastructure/prisma/client.js', () => ({
  getPrisma: () => mockPrisma,
}));

vi.mock('@/infrastructure/config/env.js', () => ({
  getEnv: () => ({
    JWT_SECRET: process.env.JWT_SECRET ?? 'test-jwt-secret-do-not-use-in-prod',
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

describe('Information disclosure prevention', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Health endpoint sanitization', () => {
    it('does not expose version numbers', async () => {
      mockQueryRawUnsafe.mockResolvedValueOnce([{ '?column?': 1 }]);

      const response = await supertest(app.server).get('/health').expect(200);

      expect(response.body).not.toHaveProperty('version');
      expect(response.body).not.toHaveProperty('nodeVersion');
      expect(JSON.stringify(response.body)).not.toMatch(/\d+\.\d+\.\d+/);
    });

    it('does not expose internal IP addresses in health response', async () => {
      mockQueryRawUnsafe.mockResolvedValueOnce([{ '?column?': 1 }]);

      const response = await supertest(app.server).get('/health').expect(200);

      const raw = JSON.stringify(response.body);
      expect(raw).not.toMatch(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/);
      expect(response.body).not.toHaveProperty('hostname');
      expect(response.body).not.toHaveProperty('ip');
    });
  });

  describe('Error response sanitization', () => {
    it('does not include stack traces in error responses', async () => {
      // Route that throws — use a non-existent route to get 404 error
      const response = await supertest(app.server).get('/api/v1/nonexistent').expect(404);

      const raw = JSON.stringify(response.body);
      expect(raw).not.toContain('at ');
      expect(raw).not.toContain('.ts:');
      expect(raw).not.toContain('.js:');
    });
  });

  describe('Swagger UI in test mode', () => {
    it('serves Swagger UI when not in production', async () => {
      const response = await supertest(app.server).get('/docs/').redirects(1);
      expect(response.status).toBe(200);
    });
  });
});

describe('Swagger UI disabled in production', () => {
  let prodApp: FastifyInstance;

  beforeAll(async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    prodApp = await buildApp({ logger: false });
    await prodApp.ready();

    process.env.NODE_ENV = originalNodeEnv;
  });

  afterAll(async () => {
    await prodApp.close();
  });

  it('returns 404 for /docs in production mode', async () => {
    const response = await supertest(prodApp.server).get('/docs/');
    expect(response.status).toBe(404);
  });

  it('returns 404 for /docs/json in production mode', async () => {
    const response = await supertest(prodApp.server).get('/docs/json');
    expect(response.status).toBe(404);
  });
});
