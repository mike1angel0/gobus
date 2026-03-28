import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';

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
    JWT_SECRET: 'test-jwt-secret-do-not-use-in-prod',
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
  getLoggerConfig: () => false,
}));

describe('buildApp compression', () => {
  const originalEnv = process.env.NODE_ENV;
  let app: FastifyInstance;

  afterEach(async () => {
    process.env.NODE_ENV = originalEnv;
    if (app) {
      await app.close();
    }
  });

  it('does not register compression in test environment', async () => {
    process.env.NODE_ENV = 'test';
    const { buildApp } = await import('@/app.js');
    app = await buildApp({ logger: false });
    await app.ready();

    // In test mode, compress plugin is not registered — no content-encoding header
    mockQueryRawUnsafe.mockResolvedValueOnce([{ '?column?': 1 }]);
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.headers['content-encoding']).toBeUndefined();
  });
});

describe('buildApp compression (non-test)', () => {
  const originalEnv = process.env.NODE_ENV;
  let app: FastifyInstance;

  afterAll(async () => {
    process.env.NODE_ENV = originalEnv;
    if (app) {
      await app.close();
    }
  });

  it('registers compression with brotli preferred, gzip fallback, and 1KB threshold', async () => {
    process.env.NODE_ENV = 'development';
    vi.resetModules();

    vi.doMock('@/infrastructure/prisma/client.js', () => ({
      getPrisma: () => mockPrisma,
    }));
    vi.doMock('@/infrastructure/config/env.js', () => ({
      getEnv: () => ({
        JWT_SECRET: 'test-jwt-secret-do-not-use-in-prod',
        NODE_ENV: 'development',
        DATABASE_URL: 'postgresql://test:test@localhost:5432/gobus_test',
      }),
    }));
    vi.doMock('@/infrastructure/logger/logger.js', () => ({
      createLogger: () => ({
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }),
      getLoggerConfig: () => false,
    }));

    const { buildApp } = await import('@/app.js');
    app = await buildApp({ logger: false });

    // Register test routes BEFORE ready()
    const largePayload = { data: 'x'.repeat(2048) };
    app.get('/test-compress', async () => largePayload);
    app.get('/test-small', async () => ({ ok: true }));

    await app.ready();

    // Brotli preferred
    const brResponse = await app.inject({
      method: 'GET',
      url: '/test-compress',
      headers: { 'accept-encoding': 'br, gzip' },
    });
    expect(brResponse.headers['content-encoding']).toBe('br');

    // Gzip fallback
    const gzipResponse = await app.inject({
      method: 'GET',
      url: '/test-compress',
      headers: { 'accept-encoding': 'gzip' },
    });
    expect(gzipResponse.headers['content-encoding']).toBe('gzip');

    // No compression for small responses (< 1KB)
    const smallResponse = await app.inject({
      method: 'GET',
      url: '/test-small',
      headers: { 'accept-encoding': 'br, gzip' },
    });
    expect(smallResponse.headers['content-encoding']).toBeUndefined();
  });
});
