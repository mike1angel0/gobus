import type { FastifyInstance } from 'fastify';
import supertest from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '@/app.js';

describe('Input sanitization and validation hardening', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('x-request-id', () => {
    it('generates a UUID x-request-id header on every response', async () => {
      const response = await supertest(app.server).get('/health');

      expect(response.status).toBe(200);
      const requestId = response.headers['x-request-id'];
      expect(requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('echoes back a client-provided x-request-id', async () => {
      const clientId = 'my-custom-request-id-123';
      const response = await supertest(app.server).get('/health').set('x-request-id', clientId);

      expect(response.status).toBe(200);
      expect(response.headers['x-request-id']).toBe(clientId);
    });

    it('generates unique IDs for different requests', async () => {
      const [res1, res2] = await Promise.all([
        supertest(app.server).get('/health'),
        supertest(app.server).get('/health'),
      ]);

      expect(res1.headers['x-request-id']).not.toBe(res2.headers['x-request-id']);
    });
  });

  describe('body size limit', () => {
    it('rejects payloads larger than 1MB with 413', async () => {
      const largePayload = JSON.stringify({ data: 'x'.repeat(1_100_000) });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'content-type': 'application/json' },
        payload: largePayload,
      });

      expect(response.statusCode).toBe(413);
    });
  });

  describe('string trimming', () => {
    it('trims whitespace from email in login request — not a 400 validation error', async () => {
      // Trimmed email is valid, so it should pass Zod validation (not 400).
      // It will fail at the service layer (401 or 500 depending on DB),
      // but the key assertion is that it does NOT get a 400 for invalid email format.
      const response = await supertest(app.server)
        .post('/api/v1/auth/login')
        .send({ email: '  test@example.com  ', password: 'WrongPass1' })
        .set('Content-Type', 'application/json');

      expect(response.status).not.toBe(400);
    });

    it('rejects whitespace-only name in register (trim + min(1))', async () => {
      const response = await supertest(app.server)
        .post('/api/v1/auth/register')
        .send({
          email: 'test-trim@example.com',
          password: 'ValidPass1',
          name: '   ',
          role: 'PASSENGER',
        })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
    });
  });
});
