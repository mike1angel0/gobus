import type { FastifyInstance } from 'fastify';
import supertest from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '@/app.js';

describe('Rate limiting', () => {
  let app: FastifyInstance;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeAll(async () => {
    // Set to 'development' so rate limiting is registered (it's skipped in 'test')
    process.env.NODE_ENV = 'development';
    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    process.env.NODE_ENV = originalNodeEnv;
    await app.close();
  });

  it('returns rate limit headers on successful requests', async () => {
    const response = await supertest(app.server).get('/health');

    expect(response.status).toBe(200);
    expect(response.headers['x-ratelimit-limit']).toBe('100');
    expect(response.headers['x-ratelimit-remaining']).toBeDefined();
    expect(response.headers['x-ratelimit-reset']).toBeDefined();
  });

  it('applies stricter limit on auth routes (10/min)', async () => {
    const response = await supertest(app.server)
      .post('/api/v1/auth/login')
      .send({ email: 'debug@example.com', password: 'password123' });

    // The auth route should have limit 10, not global 100
    expect(response.headers['x-ratelimit-limit']).toBe('10');
  });

  it('applies search rate limit (30/min)', async () => {
    const response = await supertest(app.server).get(
      '/api/v1/search?origin=A&destination=B&date=2026-04-01',
    );

    expect(response.headers['x-ratelimit-limit']).toBe('30');
  });

  it('returns 429 with RFC 9457 format when rate limit exceeded', async () => {
    // Use Fastify inject which guarantees consistent IP across calls
    for (let i = 0; i < 10; i++) {
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: `flood${i}@example.com`, password: 'password123' },
        remoteAddress: '10.0.0.99',
      });
    }

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'flood@example.com', password: 'password123' },
      remoteAddress: '10.0.0.99',
    });

    expect(response.statusCode).toBe(429);
    const body = JSON.parse(response.body);
    expect(body.type).toBe('https://httpstatuses.com/429');
    expect(body.title).toBe('Too Many Requests');
    expect(body.status).toBe(429);
    expect(body.detail).toBe('Rate limit exceeded. Please try again later.');
    expect(body.code).toBe('RATE_LIMITED');
    expect(response.headers['retry-after']).toBeDefined();
  });
});
