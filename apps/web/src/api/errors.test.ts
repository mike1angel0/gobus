import { describe, it, expect } from 'vitest';
import { ApiError, isApiError, isErrorResponse, parseApiError } from '@/api/errors';
import type { ErrorResponse } from '@/api/errors';

describe('ApiError', () => {
  const fullResponse: ErrorResponse = {
    type: 'https://api.transio.com/errors/validation',
    title: 'Validation Error',
    status: 400,
    detail: 'One or more fields are invalid',
    code: 'VALIDATION_ERROR',
    errors: [
      { field: 'email', message: 'Email is required' },
      { field: 'password', message: 'Password too short' },
    ],
  };

  const minimalResponse: ErrorResponse = {
    type: 'about:blank',
    title: 'Not Found',
    status: 404,
  };

  it('constructs from a full RFC 9457 response', () => {
    const error = new ApiError(fullResponse);

    expect(error.name).toBe('ApiError');
    expect(error.message).toBe('One or more fields are invalid');
    expect(error.status).toBe(400);
    expect(error.type).toBe('https://api.transio.com/errors/validation');
    expect(error.title).toBe('Validation Error');
    expect(error.detail).toBe('One or more fields are invalid');
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.fieldErrors).toHaveLength(2);
    expect(error.fieldErrors[0]).toEqual({ field: 'email', message: 'Email is required' });
  });

  it('constructs from a minimal RFC 9457 response', () => {
    const error = new ApiError(minimalResponse);

    expect(error.message).toBe('Not Found');
    expect(error.status).toBe(404);
    expect(error.detail).toBeUndefined();
    expect(error.code).toBeUndefined();
    expect(error.fieldErrors).toEqual([]);
  });

  it('uses detail as message when present, falls back to title', () => {
    const withDetail = new ApiError(fullResponse);
    expect(withDetail.message).toBe('One or more fields are invalid');

    const withoutDetail = new ApiError(minimalResponse);
    expect(withoutDetail.message).toBe('Not Found');
  });

  it('is an instance of Error', () => {
    const error = new ApiError(minimalResponse);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ApiError);
  });
});

describe('isApiError', () => {
  it('returns true for ApiError instances', () => {
    const error = new ApiError({ type: 'about:blank', title: 'Test', status: 500 });
    expect(isApiError(error)).toBe(true);
  });

  it('returns false for plain Error instances', () => {
    expect(isApiError(new Error('test'))).toBe(false);
  });

  it('returns false for non-error values', () => {
    expect(isApiError(null)).toBe(false);
    expect(isApiError(undefined)).toBe(false);
    expect(isApiError('string')).toBe(false);
    expect(isApiError({ status: 400 })).toBe(false);
  });
});

describe('isErrorResponse', () => {
  it('returns true for valid RFC 9457 response objects', () => {
    expect(
      isErrorResponse({
        type: 'about:blank',
        title: 'Error',
        status: 400,
      }),
    ).toBe(true);
  });

  it('returns true for responses with optional fields', () => {
    expect(
      isErrorResponse({
        type: 'about:blank',
        title: 'Error',
        status: 400,
        detail: 'details',
        code: 'ERR',
        errors: [],
      }),
    ).toBe(true);
  });

  it('returns false for null', () => {
    expect(isErrorResponse(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isErrorResponse(undefined)).toBe(false);
  });

  it('returns false for non-objects', () => {
    expect(isErrorResponse('string')).toBe(false);
    expect(isErrorResponse(42)).toBe(false);
  });

  it('returns false for objects missing required fields', () => {
    expect(isErrorResponse({ type: 'x', title: 'y' })).toBe(false);
    expect(isErrorResponse({ type: 'x', status: 400 })).toBe(false);
    expect(isErrorResponse({ title: 'y', status: 400 })).toBe(false);
  });

  it('returns false for objects with wrong field types', () => {
    expect(isErrorResponse({ type: 123, title: 'y', status: 400 })).toBe(false);
    expect(isErrorResponse({ type: 'x', title: 'y', status: '400' })).toBe(false);
  });
});

describe('parseApiError', () => {
  it('parses a valid RFC 9457 body into ApiError', () => {
    const body = {
      type: 'https://api.transio.com/errors/conflict',
      title: 'Conflict',
      status: 409,
      detail: 'Email already exists',
      code: 'EMAIL_TAKEN',
      errors: [{ field: 'email', message: 'Email already registered' }],
    };

    const error = parseApiError(409, body);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(409);
    expect(error.title).toBe('Conflict');
    expect(error.detail).toBe('Email already exists');
    expect(error.code).toBe('EMAIL_TAKEN');
    expect(error.fieldErrors).toHaveLength(1);
  });

  it('creates a generic ApiError for non-RFC 9457 JSON body', () => {
    const error = parseApiError(500, { message: 'Internal error' });

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(500);
    expect(error.type).toBe('about:blank');
    expect(error.title).toBe('HTTP 500 Error');
    expect(error.detail).toBeUndefined();
  });

  it('creates a generic ApiError for string body', () => {
    const error = parseApiError(502, 'Bad Gateway');

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(502);
    expect(error.detail).toBe('Bad Gateway');
  });

  it('creates a generic ApiError for null body', () => {
    const error = parseApiError(500, null);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(500);
    expect(error.title).toBe('HTTP 500 Error');
  });

  it('handles 401 unauthorized', () => {
    const body = {
      type: 'https://api.transio.com/errors/unauthorized',
      title: 'Unauthorized',
      status: 401,
      detail: 'Invalid credentials',
    };

    const error = parseApiError(401, body);
    expect(error.status).toBe(401);
    expect(error.detail).toBe('Invalid credentials');
  });

  it('handles 423 locked', () => {
    const body = {
      type: 'https://api.transio.com/errors/locked',
      title: 'Account Locked',
      status: 423,
      detail: 'Too many failed attempts. Try again in 15 minutes.',
      code: 'ACCOUNT_LOCKED',
    };

    const error = parseApiError(423, body);
    expect(error.status).toBe(423);
    expect(error.code).toBe('ACCOUNT_LOCKED');
  });
});
