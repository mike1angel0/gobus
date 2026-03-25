import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { type FastifyInstance } from 'fastify';
import pino from 'pino';

const { infoSpy, warnSpy } = vi.hoisted(() => ({
  infoSpy: vi.fn(),
  warnSpy: vi.fn(),
}));

vi.mock('@/infrastructure/prisma/client.js', () => ({
  getPrisma: () => ({
    user: { findUnique: vi.fn() },
  }),
}));

vi.mock('@/infrastructure/logger/logger.js', () => ({
  createLogger: () => ({
    info: infoSpy,
    debug: vi.fn(),
    warn: warnSpy,
    error: vi.fn(),
  }),
  getRootLogger: () => pino({ level: 'silent' }),
}));

import { buildApp } from '../../app.js';

describe('request-logger plugin', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('logs info for successful requests', async () => {
    infoSpy.mockClear();
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);

    expect(infoSpy).toHaveBeenCalledWith(
      'request completed',
      expect.objectContaining({
        method: 'GET',
        url: '/health',
        statusCode: 200,
        requestId: expect.any(String),
      }),
    );
  });

  it('logs warn for 4xx responses', async () => {
    warnSpy.mockClear();
    const response = await app.inject({ method: 'GET', url: '/api/v1/nonexistent' });
    expect(response.statusCode).toBe(404);

    expect(warnSpy).toHaveBeenCalledWith(
      'request completed',
      expect.objectContaining({
        method: 'GET',
        statusCode: 404,
      }),
    );
  });

  it('includes responseTime in log data', async () => {
    infoSpy.mockClear();
    await app.inject({ method: 'GET', url: '/health' });

    const data = infoSpy.mock.calls[0][1] as Record<string, unknown>;
    expect(typeof data.responseTime).toBe('number');
    expect(data.responseTime).toBeGreaterThanOrEqual(0);
  });
});
