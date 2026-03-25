import type { FastifyInstance } from 'fastify';
import supertest from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestApp } from '@/test/helpers.js';

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

describe('Health check endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /health', () => {
    it('returns ok status with db, memory, and environment when database is up', async () => {
      mockQueryRawUnsafe.mockResolvedValueOnce([{ '?column?': 1 }]);

      const response = await supertest(app.server).get('/health').expect(200);

      expect(response.body).toEqual({
        status: 'ok',
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        uptime: expect.any(Number),
        environment: 'test',
        database: 'up',
        memory: {
          rssBytes: expect.any(Number),
          heapUsedBytes: expect.any(Number),
          heapTotalBytes: expect.any(Number),
        },
      });
      expect(response.body.uptime).toBeGreaterThan(0);
      expect(response.body.memory.rssBytes).toBeGreaterThan(0);
    });

    it('returns degraded status when database is down', async () => {
      mockQueryRawUnsafe.mockRejectedValueOnce(new Error('Connection refused'));

      const response = await supertest(app.server).get('/health').expect(200);

      expect(response.body.status).toBe('degraded');
      expect(response.body.database).toBe('down');
    });
  });

  describe('GET /health/ready', () => {
    it('returns ready when database is reachable', async () => {
      mockQueryRawUnsafe.mockResolvedValueOnce([{ '?column?': 1 }]);

      const response = await supertest(app.server).get('/health/ready').expect(200);

      expect(response.body).toEqual({
        status: 'ready',
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        database: 'up',
      });
    });

    it('returns 503 when database is unreachable', async () => {
      mockQueryRawUnsafe.mockRejectedValueOnce(new Error('Connection refused'));

      const response = await supertest(app.server).get('/health/ready').expect(503);

      expect(response.body).toEqual({
        status: 'not_ready',
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        database: 'down',
      });
    });
  });

  describe('GET /health/live', () => {
    it('always returns 200 with alive status', async () => {
      const response = await supertest(app.server).get('/health/live').expect(200);

      expect(response.body).toEqual({
        status: 'alive',
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      });
    });

    it('returns 200 even when database is down', async () => {
      mockQueryRawUnsafe.mockRejectedValueOnce(new Error('Connection refused'));

      const response = await supertest(app.server).get('/health/live').expect(200);

      expect(response.body.status).toBe('alive');
    });
  });

  describe('GET /docs', () => {
    it('serves Swagger UI', async () => {
      const response = await supertest(app.server).get('/docs/').redirects(1);

      expect(response.status).toBe(200);
      expect(response.text).toContain('swagger');
    });

    it('serves OpenAPI spec as JSON', async () => {
      const response = await supertest(app.server).get('/docs/json').expect(200);

      expect(response.body).toHaveProperty('openapi', '3.1.0');
      expect(response.body).toHaveProperty('info.title', 'Transio API');
      expect(response.body).toHaveProperty('paths');
    });
  });
});
