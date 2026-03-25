import type { FastifyInstance } from 'fastify';
import supertest from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '@/app.js';

describe('Helmet security headers', () => {
  let app: FastifyInstance;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeAll(async () => {
    // Set to 'development' so helmet is registered (it's skipped in 'test')
    process.env.NODE_ENV = 'development';
    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    process.env.NODE_ENV = originalNodeEnv;
    await app.close();
  });

  it('sets Content-Security-Policy header', async () => {
    const response = await supertest(app.server).get('/health');

    const csp = response.headers['content-security-policy'];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('sets Strict-Transport-Security header with 1 year max-age', async () => {
    const response = await supertest(app.server).get('/health');

    const hsts = response.headers['strict-transport-security'];
    expect(hsts).toContain('max-age=31536000');
    expect(hsts).toContain('includeSubDomains');
    expect(hsts).toContain('preload');
  });

  it('sets X-Frame-Options to DENY', async () => {
    const response = await supertest(app.server).get('/health');

    expect(response.headers['x-frame-options']).toBe('DENY');
  });

  it('sets X-Content-Type-Options to nosniff', async () => {
    const response = await supertest(app.server).get('/health');

    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('sets Referrer-Policy', async () => {
    const response = await supertest(app.server).get('/health');

    expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });
});
