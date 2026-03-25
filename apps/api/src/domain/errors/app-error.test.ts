import { describe, it, expect } from 'vitest';
import { AppError } from './app-error.js';
import { ErrorCodes } from './error-codes.js';

describe('AppError', () => {
  it('creates an error with all required properties', () => {
    const error = new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'User not found');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
    expect(error.name).toBe('AppError');
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('RESOURCE_NOT_FOUND');
    expect(error.detail).toBe('User not found');
    expect(error.message).toBe('User not found');
    expect(error.errors).toEqual([]);
  });

  it('creates an error with field errors', () => {
    const fieldErrors = [
      { field: 'email', message: 'Email is required' },
      { field: 'password', message: 'Password too short' },
    ];
    const error = new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Validation failed', fieldErrors);

    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.errors).toEqual(fieldErrors);
    expect(error.errors).toHaveLength(2);
  });

  it('defaults errors to empty array when not provided', () => {
    const error = new AppError(500, ErrorCodes.INTERNAL_ERROR, 'Something broke');
    expect(error.errors).toEqual([]);
  });

  it('preserves stack trace', () => {
    const error = new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Bad input');
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('AppError');
  });
});
