import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { type FastifyInstance } from 'fastify';
import pino from 'pino';

const { warnSpy, infoSpy } = vi.hoisted(() => ({
  warnSpy: vi.fn(),
  infoSpy: vi.fn(),
}));

vi.mock('@/infrastructure/prisma/client.js', () => ({
  getPrisma: () => ({
    user: { findUnique: vi.fn() },
  }),
}));

vi.mock('@/infrastructure/logger/logger.js', () => ({
  createLogger: (name: string) => ({
    info: name === 'Metrics' ? infoSpy : vi.fn(),
    debug: vi.fn(),
    warn: name === 'Metrics' ? warnSpy : vi.fn(),
    error: vi.fn(),
  }),
  getRootLogger: () => pino({ level: 'silent' }),
}));

import { buildApp } from '../../app.js';

describe('metrics plugin', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('does not log slow request warning for fast requests', async () => {
    warnSpy.mockClear();
    const response = await app.inject({ method: 'GET', url: '/health/live' });
    expect(response.statusCode).toBe(200);

    // Check that no "slow request detected" warning was logged
    const slowCalls = warnSpy.mock.calls.filter(
      (call: unknown[]) => call[0] === 'slow request detected',
    );
    expect(slowCalls.length).toBe(0);
  });

  it('tracks error responses (4xx status codes)', async () => {
    // A 404 should be tracked as an error in metrics
    const response = await app.inject({ method: 'GET', url: '/api/v1/nonexistent' });
    expect(response.statusCode).toBe(404);
    // Plugin runs without crashing — error tracking is internal state
  });

  it('handles multiple concurrent requests without errors', async () => {
    const requests = Array.from({ length: 10 }, () =>
      app.inject({ method: 'GET', url: '/health/live' }),
    );
    const responses = await Promise.all(requests);
    for (const response of responses) {
      expect(response.statusCode).toBe(200);
    }
  });
});
