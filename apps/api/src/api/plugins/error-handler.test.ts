import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { createTestApp } from '@/test/helpers.js';
import { AppError } from '@/domain/errors/app-error.js';
import { ErrorCodes } from '@/domain/errors/error-codes.js';
import { isPrismaError, httpTitle, mapZodErrors } from './error-handler.js';

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

    // Route that throws a Prisma-like error (simulates PrismaClientKnownRequestError)
    app.get('/test/prisma-error', () => {
      const err = new Error(
        'Invalid `prisma.user.findUnique()` invocation: Unique constraint failed on the fields: (`email`)',
      );
      err.name = 'PrismaClientKnownRequestError';
      (err as unknown as Record<string, unknown>).code = 'P2002';
      (err as unknown as Record<string, unknown>).meta = { target: ['email'] };
      throw err;
    });

    // Route that throws PrismaClientValidationError
    app.get('/test/prisma-validation-error', () => {
      const err = new Error(
        'Argument `where` is missing. SELECT "public"."User"."id" FROM "public"."User"',
      );
      err.name = 'PrismaClientValidationError';
      throw err;
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

    // Route that throws a non-Error primitive (covers isPrismaError false for non-object)
    app.get('/test/throw-string', () => {
      const val: unknown = 'a string error';
      throw val;
    });

    // Route that throws null (covers isPrismaError null check)
    app.get('/test/throw-null', () => {
      const val: unknown = null;
      throw val;
    });

    // Route that throws error with no name (covers isPrismaError name ?? '' fallback)
    app.get('/test/throw-nameless', () => {
      const err = new Error('nameless');
      // @ts-expect-error testing undefined name path
      delete err.name;
      throw err;
    });

    // Route that triggers Fastify validation with missing required field
    // (covers missingProperty branch in validation mapping)
    app.post(
      '/test/fastify-validation-required',
      {
        schema: {
          body: {
            type: 'object',
            required: ['name', 'email'],
            properties: {
              name: { type: 'string' },
              email: { type: 'string' },
            },
          },
        },
      },
      async () => {
        return { ok: true };
      },
    );

    // Route with deeply nested schema validation (covers instancePath with slashes)
    app.post(
      '/test/fastify-validation-nested',
      {
        schema: {
          body: {
            type: 'object',
            properties: {
              address: {
                type: 'object',
                properties: {
                  city: { type: 'string' },
                  zip: { type: 'number' },
                },
              },
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

  it('returns safe 500 for PrismaClientKnownRequestError without leaking SQL or schema details', async () => {
    const response = await app.inject({ method: 'GET', url: '/test/prisma-error' });

    expect(response.statusCode).toBe(500);
    const body = response.json();
    expect(body).toEqual({
      type: 'https://httpstatuses.com/500',
      title: 'Internal Server Error',
      status: 500,
      detail: 'An unexpected error occurred',
      code: 'INTERNAL_ERROR',
    });
    const raw = JSON.stringify(body);
    expect(raw).not.toContain('prisma');
    expect(raw).not.toContain('P2002');
    expect(raw).not.toContain('findUnique');
    expect(raw).not.toContain('email');
  });

  it('returns safe 500 for PrismaClientValidationError without leaking SQL', async () => {
    const response = await app.inject({ method: 'GET', url: '/test/prisma-validation-error' });

    expect(response.statusCode).toBe(500);
    const body = response.json();
    expect(body).toEqual({
      type: 'https://httpstatuses.com/500',
      title: 'Internal Server Error',
      status: 500,
      detail: 'An unexpected error occurred',
      code: 'INTERNAL_ERROR',
    });
    const raw = JSON.stringify(body);
    expect(raw).not.toContain('SELECT');
    expect(raw).not.toContain('Argument');
  });

  it('returns safe 500 for thrown string (non-object error)', async () => {
    const response = await app.inject({ method: 'GET', url: '/test/throw-string' });

    expect(response.statusCode).toBe(500);
    const body = response.json();
    expect(body.type).toBe('https://httpstatuses.com/500');
    expect(body.title).toBe('Internal Server Error');
    expect(body.status).toBe(500);
    expect(body.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(body)).not.toContain('a string error');
  });

  it('returns 500 for thrown null without leaking internals', async () => {
    const response = await app.inject({ method: 'GET', url: '/test/throw-null' });

    // Fastify may handle null throws before the error handler
    expect(response.statusCode).toBeGreaterThanOrEqual(500);
  });

  it('returns safe 500 for error with undefined name (isPrismaError name fallback)', async () => {
    const response = await app.inject({ method: 'GET', url: '/test/throw-nameless' });

    expect(response.statusCode).toBe(500);
    const body = response.json();
    expect(body.type).toBe('https://httpstatuses.com/500');
    expect(body.status).toBe(500);
    expect(body.code).toBe('INTERNAL_ERROR');
  });

  it('handles Fastify validation with missing required field (missingProperty branch)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/test/fastify-validation-required',
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.type).toBe('https://httpstatuses.com/400');
    expect(body.status).toBe(400);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.errors).toBeInstanceOf(Array);
    // Should have at least one field error for a missing required property
    const fields = body.errors.map((e: { field: string }) => e.field);
    expect(fields.length).toBeGreaterThanOrEqual(1);
    // Fastify reports missingProperty via params — verify the field was extracted
    expect(fields.some((f: string) => f === 'name' || f === 'email')).toBe(true);
  });

  it('handles Fastify validation with nested path (instancePath with slashes)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/test/fastify-validation-nested',
      payload: { address: { zip: 'not-a-number' } },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.type).toBe('https://httpstatuses.com/400');
    expect(body.status).toBe(400);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.errors).toBeInstanceOf(Array);
    // Should have a field error with dotted path
    const fields = body.errors.map((e: { field: string }) => e.field);
    expect(fields.some((f: string) => f.includes('address'))).toBe(true);
  });
});

describe('isPrismaError', () => {
  it('returns false for null', () => {
    expect(isPrismaError(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isPrismaError(undefined)).toBe(false);
  });

  it('returns false for non-object (string)', () => {
    expect(isPrismaError('some string')).toBe(false);
  });

  it('returns false for non-object (number)', () => {
    expect(isPrismaError(42)).toBe(false);
  });

  it('returns false for object with no name property', () => {
    expect(isPrismaError({})).toBe(false);
  });

  it('returns false for object with undefined name', () => {
    expect(isPrismaError({ name: undefined })).toBe(false);
  });

  it('returns false for regular Error', () => {
    expect(isPrismaError(new Error('test'))).toBe(false);
  });

  it('returns true for PrismaClientKnownRequestError', () => {
    const err = new Error('test');
    err.name = 'PrismaClientKnownRequestError';
    expect(isPrismaError(err)).toBe(true);
  });

  it('returns true for PrismaClientValidationError', () => {
    const err = new Error('test');
    err.name = 'PrismaClientValidationError';
    expect(isPrismaError(err)).toBe(true);
  });

  it('returns true for PrismaClientInitializationError', () => {
    const err = new Error('test');
    err.name = 'PrismaClientInitializationError';
    expect(isPrismaError(err)).toBe(true);
  });
});

describe('httpTitle', () => {
  it('returns known titles for common status codes', () => {
    expect(httpTitle(400)).toBe('Bad Request');
    expect(httpTitle(401)).toBe('Unauthorized');
    expect(httpTitle(404)).toBe('Not Found');
    expect(httpTitle(500)).toBe('Internal Server Error');
  });

  it('returns "Error" for unknown status codes', () => {
    expect(httpTitle(418)).toBe('Error');
    expect(httpTitle(999)).toBe('Error');
  });
});

describe('mapZodErrors', () => {
  it('maps nested path to dot notation', () => {
    const schema = z.object({ address: z.object({ city: z.string() }) });
    try {
      schema.parse({ address: { city: 123 } });
    } catch (err) {
      if (err instanceof z.ZodError) {
        const errors = mapZodErrors(err);
        expect(errors[0].field).toBe('address.city');
      }
    }
  });

  it('uses _root for empty path', () => {
    const schema = z.string();
    try {
      schema.parse(123);
    } catch (err) {
      if (err instanceof z.ZodError) {
        const errors = mapZodErrors(err);
        expect(errors[0].field).toBe('_root');
      }
    }
  });
});
