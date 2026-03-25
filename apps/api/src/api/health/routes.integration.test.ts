import type { FastifyInstance } from 'fastify';
import supertest from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestApp } from '@/test/helpers.js';

describe('GET /health', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns status ok with timestamp and uptime', async () => {
    const response = await supertest(app.server).get('/health').expect(200);

    expect(response.body).toEqual({
      status: 'ok',
      timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      uptime: expect.any(Number),
    });
    expect(response.body.uptime).toBeGreaterThan(0);
  });

  it('returns application/json content type', async () => {
    const response = await supertest(app.server).get('/health');

    expect(response.headers['content-type']).toMatch(/application\/json/);
  });
});

describe('GET /docs', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

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
