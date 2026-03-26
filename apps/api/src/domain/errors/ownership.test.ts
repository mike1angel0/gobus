import { describe, expect, it } from 'vitest';

import { AppError } from './app-error.js';
import { ErrorCodes } from './error-codes.js';
import { verifyOwnership } from './ownership.js';

describe('verifyOwnership', () => {
  it('does not throw when resource exists and owner matches', () => {
    const resource = { id: '1', providerId: 'provider-1' };
    expect(() =>
      verifyOwnership(resource, resource.providerId, 'provider-1', 'Route'),
    ).not.toThrow();
  });

  it('throws 404 AppError when resource is null', () => {
    expect(() => verifyOwnership(null, undefined, 'provider-1', 'Bus')).toThrow(AppError);
    try {
      verifyOwnership(null, undefined, 'provider-1', 'Bus');
    } catch (err) {
      const error = err as AppError;
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe(ErrorCodes.RESOURCE_NOT_FOUND);
      expect(error.detail).toBe('Bus not found');
    }
  });

  it('throws 404 AppError when resource is undefined', () => {
    expect(() => verifyOwnership(undefined, undefined, 'provider-1', 'Route')).toThrow(AppError);
  });

  it('throws 404 AppError when owner ID does not match requester ID', () => {
    const resource = { id: '1', providerId: 'provider-A' };
    expect(() => verifyOwnership(resource, resource.providerId, 'provider-B', 'Route')).toThrow(
      AppError,
    );
    try {
      verifyOwnership(resource, resource.providerId, 'provider-B', 'Route');
    } catch (err) {
      const error = err as AppError;
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe(ErrorCodes.RESOURCE_NOT_FOUND);
      expect(error.detail).toBe('Route not found');
    }
  });

  it('throws 404 when resourceOwnerId is null', () => {
    const resource = { id: '1', providerId: null };
    expect(() => verifyOwnership(resource, resource.providerId, 'provider-1', 'Schedule')).toThrow(
      AppError,
    );
  });

  it('uses the resourceName in the error detail message', () => {
    try {
      verifyOwnership(null, undefined, 'user-1', 'Booking');
    } catch (err) {
      expect((err as AppError).detail).toBe('Booking not found');
    }
  });
});
