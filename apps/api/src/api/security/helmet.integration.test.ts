import type { FastifyInstance } from 'fastify';
import supertest from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '@/app.js';

describe('Security headers (Helmet)', () => {
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
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain('https://*.tile.openstreetmap.org');
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

  it('sets Permissions-Policy with camera, microphone, and geolocation', async () => {
    const response = await supertest(app.server).get('/health');

    const pp = response.headers['permissions-policy'];
    expect(pp).toContain('camera=()');
    expect(pp).toContain('microphone=()');
    expect(pp).toContain('geolocation=(self)');
  });

  it('does not expose X-Powered-By header', async () => {
    const response = await supertest(app.server).get('/health');

    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('has all 7 security headers present in a single response', async () => {
    const response = await supertest(app.server).get('/health');

    expect(response.headers['content-security-policy']).toBeDefined();
    expect(response.headers['strict-transport-security']).toBeDefined();
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(response.headers['permissions-policy']).toBeDefined();
    expect(response.headers['x-powered-by']).toBeUndefined();
  });
});
