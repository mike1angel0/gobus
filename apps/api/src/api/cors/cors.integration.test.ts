import type { FastifyInstance } from 'fastify';
import supertest from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestApp } from '@/test/helpers.js';

describe('CORS configuration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns CORS headers for allowed origin', async () => {
    const response = await supertest(app.server)
      .get('/health')
      .set('Origin', 'http://localhost:3001');

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3001');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('does not return CORS headers for disallowed origin', async () => {
    const response = await supertest(app.server)
      .get('/health')
      .set('Origin', 'http://evil.example.com');

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('responds to preflight OPTIONS with correct headers', async () => {
    const response = await supertest(app.server)
      .options('/health')
      .set('Origin', 'http://localhost:3001')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Content-Type,Authorization');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3001');
    expect(response.headers['access-control-allow-methods']).toContain('GET');
    expect(response.headers['access-control-allow-methods']).toContain('POST');
    expect(response.headers['access-control-allow-methods']).toContain('PUT');
    expect(response.headers['access-control-allow-methods']).toContain('PATCH');
    expect(response.headers['access-control-allow-methods']).toContain('DELETE');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
    expect(response.headers['access-control-max-age']).toBe('86400');
    expect(response.headers['access-control-allow-headers']).toContain('Content-Type');
    expect(response.headers['access-control-allow-headers']).toContain('Authorization');
  });

  it('exposes X-Request-Id header', async () => {
    const response = await supertest(app.server)
      .options('/health')
      .set('Origin', 'http://localhost:3001')
      .set('Access-Control-Request-Method', 'GET');

    expect(response.headers['access-control-expose-headers']).toContain('X-Request-Id');
  });
});

describe('parseCorsOrigins', () => {
  const originalCorsOrigin = process.env.CORS_ORIGIN;
  const originalNodeEnv = process.env.NODE_ENV;

  afterAll(() => {
    process.env.CORS_ORIGIN = originalCorsOrigin;
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('includes localhost origins in development mode', async () => {
    process.env.NODE_ENV = 'development';
    process.env.CORS_ORIGIN = '';

    const { parseCorsOrigins } = await import('@/app.js');
    const origins = parseCorsOrigins();

    expect(origins).toContain('http://localhost:3000');
    expect(origins).toContain('http://localhost:3001');
    expect(origins).toContain('http://localhost:5173');
  });

  it('includes configured origins in development mode', async () => {
    process.env.NODE_ENV = 'development';
    process.env.CORS_ORIGIN = 'https://staging.example.com';

    const { parseCorsOrigins } = await import('@/app.js');
    const origins = parseCorsOrigins();

    expect(origins).toContain('http://localhost:3001');
    expect(origins).toContain('https://staging.example.com');
  });

  it('uses only configured origins in production mode', async () => {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGIN = 'https://app.transio.com,https://www.transio.com';

    const { parseCorsOrigins } = await import('@/app.js');
    const origins = parseCorsOrigins();

    expect(origins).toEqual(['https://app.transio.com', 'https://www.transio.com']);
    expect(origins).not.toContain('http://localhost:3001');
  });
});
