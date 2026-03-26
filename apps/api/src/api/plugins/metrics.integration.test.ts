import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
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

  beforeEach(() => {
    warnSpy.mockClear();
    infoSpy.mockClear();
  });

  it('does not log slow request warning for fast requests', async () => {
    const response = await app.inject({ method: 'GET', url: '/health/live' });
    expect(response.statusCode).toBe(200);

    // Check that no "slow request detected" warning was logged
    const slowCalls = warnSpy.mock.calls.filter(
      (call: unknown[]) => call[0] === 'slow request detected',
    );
    expect(slowCalls.length).toBe(0);
  });

  // Slow request branch covered in dedicated describe block below

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

describe('metrics plugin — slow request logging', () => {
  let slowApp: FastifyInstance;

  beforeAll(async () => {
    slowApp = Fastify({ logger: false });

    // Register metrics plugin on a standalone instance
    const metricsModule = await import('./metrics.js');
    await slowApp.register(metricsModule.default);

    // Add a route that simulates slow response time via reply decoration
    slowApp.get('/slow', async (_request, reply) => {
      await new Promise((resolve) => setTimeout(resolve, 5100));
      return reply.send({ ok: true });
    });

    slowApp.get('/fast', async (_request, reply) => {
      return reply.send({ ok: true });
    });

    await slowApp.ready();
  });

  afterAll(async () => {
    await slowApp.close();
  });

  it('logs warning when response time exceeds 5000ms', async () => {
    warnSpy.mockClear();

    const response = await slowApp.inject({ method: 'GET', url: '/slow' });
    expect(response.statusCode).toBe(200);

    const slowCalls = warnSpy.mock.calls.filter(
      (call: unknown[]) => call[0] === 'slow request detected',
    );
    expect(slowCalls.length).toBe(1);
    expect(slowCalls[0][1]).toMatchObject({
      method: 'GET',
      url: '/slow',
    });
    expect(slowCalls[0][1].responseTime).toBeGreaterThan(5000);
  }, 10_000);

  it('does not log warning for fast responses', async () => {
    warnSpy.mockClear();

    const response = await slowApp.inject({ method: 'GET', url: '/fast' });
    expect(response.statusCode).toBe(200);

    const slowCalls = warnSpy.mock.calls.filter(
      (call: unknown[]) => call[0] === 'slow request detected',
    );
    expect(slowCalls.length).toBe(0);
  });
});

describe('metrics plugin — production periodic summary', () => {
  let app: FastifyInstance;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeAll(async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    process.env.NODE_ENV = 'production';

    // Re-import to pick up NODE_ENV=production
    vi.resetModules();
    const { buildApp: buildAppFresh } = await import('../../app.js');
    app = await buildAppFresh({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    process.env.NODE_ENV = originalNodeEnv;
    vi.useRealTimers();
  });

  beforeEach(() => {
    infoSpy.mockClear();
  });

  it('logs metrics summary after interval when requests were made', async () => {
    // Make a successful request and an error request so both branches are hit
    await app.inject({ method: 'GET', url: '/health/live' });
    await app.inject({ method: 'GET', url: '/api/v1/nonexistent-route' });

    // Advance past the 60s summary interval
    vi.advanceTimersByTime(61_000);

    const summaryCalls = infoSpy.mock.calls.filter(
      (call: unknown[]) => call[0] === 'metrics summary',
    );
    expect(summaryCalls.length).toBeGreaterThanOrEqual(1);
    const summary = summaryCalls[0][1] as Record<string, unknown>;
    expect(summary).toMatchObject({
      requestCount: expect.any(Number),
      avgResponseTime: expect.any(Number),
      p50: expect.any(Number),
      p95: expect.any(Number),
      p99: expect.any(Number),
      errorCountByStatus: expect.any(Object),
    });
    // Verify error tracking included in summary
    expect((summary.errorCountByStatus as Record<string, number>)['404']).toBeGreaterThanOrEqual(1);
  });

  it('does not log metrics summary when no requests were made', async () => {
    infoSpy.mockClear();

    // Advance past the interval without making any requests
    // (state was reset at end of previous interval)
    vi.advanceTimersByTime(61_000);

    const summaryCalls = infoSpy.mock.calls.filter(
      (call: unknown[]) => call[0] === 'metrics summary',
    );
    expect(summaryCalls.length).toBe(0);
  });

  it('resets metrics state after each summary interval', async () => {
    // Make requests
    await app.inject({ method: 'GET', url: '/health/live' });
    await app.inject({ method: 'GET', url: '/health/live' });
    infoSpy.mockClear();

    // First interval — should log summary with 2 requests
    vi.advanceTimersByTime(61_000);

    const firstSummary = infoSpy.mock.calls.filter(
      (call: unknown[]) => call[0] === 'metrics summary',
    );
    expect(firstSummary.length).toBe(1);
    const firstCount = (firstSummary[0][1] as Record<string, unknown>).requestCount as number;
    expect(firstCount).toBeGreaterThanOrEqual(2);

    // Make one more request
    await app.inject({ method: 'GET', url: '/health/live' });
    infoSpy.mockClear();

    // Second interval — should only show the new request(s)
    vi.advanceTimersByTime(61_000);

    const secondSummary = infoSpy.mock.calls.filter(
      (call: unknown[]) => call[0] === 'metrics summary',
    );
    expect(secondSummary.length).toBe(1);
    const secondCount = (secondSummary[0][1] as Record<string, unknown>).requestCount as number;
    expect(secondCount).toBeLessThan(firstCount);
  });
});
