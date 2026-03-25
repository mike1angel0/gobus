import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { createTestApp } from '@/test/helpers.js';
import { AppError } from '@/domain/errors/app-error.js';
import { ErrorCodes } from '@/domain/errors/error-codes.js';

describe('error-handler plugin', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();

    // Route that throws AppError
    app.get('/test/app-error', () => {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'User not found');
    });

    // Route that throws AppError with field errors
    app.get('/test/app-error-fields', () => {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Validation failed', [
        { field: 'email', message: 'Email is required' },
        { field: 'name', message: 'Name too long' },
      ]);
    });

    // Route that throws ZodError
    app.get('/test/zod-error', () => {
      const schema = z.object({
        email: z.string().email(),
        age: z.number().min(18),
      });
      schema.parse({ email: 'not-email', age: 5 });
    });

    // Route that throws unknown error
    app.get('/test/unknown-error', () => {
      throw new Error('database connection failed');
    });

    // Route that throws AppError 423 (locked)
    app.get('/test/locked', () => {
      throw new AppError(423, ErrorCodes.AUTH_INVALID_CREDENTIALS, 'Account is locked');
    });

    // Route that throws AppError 409 (conflict)
    app.get('/test/conflict', () => {
      throw new AppError(409, ErrorCodes.SEAT_CONFLICT, 'Seat already booked');
    });

    // Route with Fastify JSON Schema validation (triggers fastifyError.validation branch)
    app.post(
      '/test/fastify-validation',
      {
        schema: {
          body: {
            type: 'object',
            required: ['email'],
            properties: {
              email: { type: 'string' },
              age: { type: 'number' },
            },
          },
        },
      },
      async () => {
        return { ok: true };
      },
    );

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns RFC 9457 format for AppError', async () => {
    const response = await app.inject({ method: 'GET', url: '/test/app-error' });

    expect(response.statusCode).toBe(404);
    const body = response.json();
    expect(body).toEqual({
      type: 'https://httpstatuses.com/404',
      title: 'Not Found',
      status: 404,
      detail: 'User not found',
      code: 'RESOURCE_NOT_FOUND',
    });
  });

  it('includes field errors in AppError response', async () => {
    const response = await app.inject({ method: 'GET', url: '/test/app-error-fields' });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body).toEqual({
      type: 'https://httpstatuses.com/400',
      title: 'Bad Request',
      status: 400,
      detail: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors: [
        { field: 'email', message: 'Email is required' },
        { field: 'name', message: 'Name too long' },
      ],
    });
  });

  it('maps ZodError to RFC 9457 with field errors', async () => {
    const response = await app.inject({ method: 'GET', url: '/test/zod-error' });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.type).toBe('https://httpstatuses.com/400');
    expect(body.title).toBe('Bad Request');
    expect(body.status).toBe(400);
    expect(body.detail).toBe('Validation failed');
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.errors).toBeInstanceOf(Array);
    expect(body.errors.length).toBeGreaterThanOrEqual(2);
    // Check that field errors have the expected shape
    for (const fieldError of body.errors) {
      expect(fieldError).toHaveProperty('field');
      expect(fieldError).toHaveProperty('message');
      expect(typeof fieldError.field).toBe('string');
      expect(typeof fieldError.message).toBe('string');
    }
  });

  it('returns safe 500 for unknown errors without leaking internals', async () => {
    const response = await app.inject({ method: 'GET', url: '/test/unknown-error' });

    expect(response.statusCode).toBe(500);
    const body = response.json();
    expect(body).toEqual({
      type: 'https://httpstatuses.com/500',
      title: 'Internal Server Error',
      status: 500,
      detail: 'An unexpected error occurred',
      code: 'INTERNAL_ERROR',
    });
    // Must NOT contain the original error message
    expect(JSON.stringify(body)).not.toContain('database connection failed');
  });

  it('returns 423 for locked account errors', async () => {
    const response = await app.inject({ method: 'GET', url: '/test/locked' });

    expect(response.statusCode).toBe(423);
    const body = response.json();
    expect(body.type).toBe('https://httpstatuses.com/423');
    expect(body.title).toBe('Locked');
    expect(body.status).toBe(423);
    expect(body.detail).toBe('Account is locked');
  });

  it('returns 409 for conflict errors', async () => {
    const response = await app.inject({ method: 'GET', url: '/test/conflict' });

    expect(response.statusCode).toBe(409);
    const body = response.json();
    expect(body.type).toBe('https://httpstatuses.com/409');
    expect(body.title).toBe('Conflict');
    expect(body.status).toBe(409);
    expect(body.code).toBe('SEAT_CONFLICT');
  });

  it('omits errors array when AppError has no field errors', async () => {
    const response = await app.inject({ method: 'GET', url: '/test/app-error' });
    const body = response.json();
    expect(body).not.toHaveProperty('errors');
  });

  it('handles Fastify JSON Schema validation errors as RFC 9457', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/test/fastify-validation',
      payload: { age: 'not-a-number' },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.type).toBe('https://httpstatuses.com/400');
    expect(body.title).toBe('Bad Request');
    expect(body.status).toBe(400);
    expect(body.detail).toBe('Validation failed');
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.errors).toBeInstanceOf(Array);
    expect(body.errors.length).toBeGreaterThanOrEqual(1);
    for (const fieldError of body.errors) {
      expect(typeof fieldError.field).toBe('string');
      expect(typeof fieldError.message).toBe('string');
    }
  });
});
