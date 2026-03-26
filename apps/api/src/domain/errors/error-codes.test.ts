import { describe, it, expect } from 'vitest';
import { ErrorCodes } from './error-codes.js';

describe('ErrorCodes', () => {
  it('contains all required error codes', () => {
    expect(ErrorCodes.AUTH_INVALID_CREDENTIALS).toBe('AUTH_INVALID_CREDENTIALS');
    expect(ErrorCodes.AUTH_TOKEN_EXPIRED).toBe('AUTH_TOKEN_EXPIRED');
    expect(ErrorCodes.AUTH_EMAIL_TAKEN).toBe('AUTH_EMAIL_TAKEN');
    expect(ErrorCodes.RESOURCE_NOT_FOUND).toBe('RESOURCE_NOT_FOUND');
    expect(ErrorCodes.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
    expect(ErrorCodes.FORBIDDEN).toBe('FORBIDDEN');
    expect(ErrorCodes.CONFLICT).toBe('CONFLICT');
    expect(ErrorCodes.SEAT_CONFLICT).toBe('SEAT_CONFLICT');
    expect(ErrorCodes.ACCOUNT_LOCKED).toBe('ACCOUNT_LOCKED');
    expect(ErrorCodes.ACCOUNT_SUSPENDED).toBe('ACCOUNT_SUSPENDED');
    expect(ErrorCodes.AUTH_INVALID_RESET_TOKEN).toBe('AUTH_INVALID_RESET_TOKEN');
    expect(ErrorCodes.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
    expect(ErrorCodes.RATE_LIMITED).toBe('RATE_LIMITED');
    expect(ErrorCodes.RESOURCE_EXHAUSTED).toBe('RESOURCE_EXHAUSTED');
  });

  it('has exactly 14 error codes', () => {
    expect(Object.keys(ErrorCodes)).toHaveLength(14);
  });

  it('all values are unique strings', () => {
    const values = Object.values(ErrorCodes);
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
    for (const value of values) {
      expect(typeof value).toBe('string');
    }
  });
});
