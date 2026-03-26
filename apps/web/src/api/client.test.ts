import { describe, it, expect, beforeEach } from 'vitest';
import { setAccessToken, getAccessToken, setOnUnauthorized } from '@/api/client';

describe('setAccessToken / getAccessToken', () => {
  beforeEach(() => {
    setAccessToken(null);
  });

  it('returns null when no token is set', () => {
    expect(getAccessToken()).toBeNull();
  });

  it('stores and retrieves an access token', () => {
    setAccessToken('jwt-token-123');
    expect(getAccessToken()).toBe('jwt-token-123');
  });

  it('clears the token when set to null', () => {
    setAccessToken('jwt-token-123');
    setAccessToken(null);
    expect(getAccessToken()).toBeNull();
  });

  it('overwrites previous token', () => {
    setAccessToken('old-token');
    setAccessToken('new-token');
    expect(getAccessToken()).toBe('new-token');
  });
});

describe('setOnUnauthorized', () => {
  beforeEach(() => {
    setOnUnauthorized(null);
  });

  it('accepts a callback without throwing', () => {
    expect(() => setOnUnauthorized(() => {})).not.toThrow();
  });

  it('accepts null to clear the callback', () => {
    setOnUnauthorized(() => {});
    expect(() => setOnUnauthorized(null)).not.toThrow();
  });
});
