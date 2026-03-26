import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  setAccessToken,
  getAccessToken,
  setOnUnauthorized,
  setOnForbiddenOrLocked,
  handleRequest,
  handleResponse,
} from '@/api/client';
import { ApiError } from '@/api/errors';

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

describe('handleRequest', () => {
  beforeEach(() => {
    setAccessToken(null);
  });

  it('attaches Authorization header when token is set', async () => {
    setAccessToken('my-jwt');
    const request = new Request('https://api.test/foo');
    const result = await handleRequest({ request });
    expect(result.headers.get('Authorization')).toBe('Bearer my-jwt');
  });

  it('does not attach header when no token', async () => {
    const request = new Request('https://api.test/foo');
    const result = await handleRequest({ request });
    expect(result.headers.get('Authorization')).toBeNull();
  });
});

describe('handleResponse', () => {
  beforeEach(() => {
    setAccessToken(null);
    setOnUnauthorized(null);
  });

  it('returns response when OK', async () => {
    const response = new Response('ok', { status: 200 });
    const result = await handleResponse({ response });
    expect(result).toBe(response);
  });

  it('throws ApiError for non-OK JSON response', async () => {
    const body = { type: 'about:blank', title: 'Bad Request', status: 400 };
    const response = new Response(JSON.stringify(body), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });

    await expect(handleResponse({ response })).rejects.toBeInstanceOf(ApiError);
  });

  it('throws ApiError for non-OK text response', async () => {
    const response = new Response('Internal Server Error', { status: 500 });
    // Override .json() to throw
    const cloned = response.clone();
    vi.spyOn(response, 'clone')
      .mockReturnValueOnce({
        ...cloned,
        json: () => Promise.reject(new Error('not json')),
        text: () => Promise.resolve('Internal Server Error'),
      } as unknown as Response)
      .mockReturnValueOnce({
        ...cloned,
        text: () => Promise.resolve('Internal Server Error'),
      } as unknown as Response);

    await expect(handleResponse({ response })).rejects.toBeInstanceOf(ApiError);
  });

  it('calls onUnauthorized callback for 401', async () => {
    const callback = vi.fn();
    setOnUnauthorized(callback);

    const body = { type: 'about:blank', title: 'Unauthorized', status: 401 };
    const response = new Response(JSON.stringify(body), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });

    await expect(handleResponse({ response })).rejects.toBeInstanceOf(ApiError);
    expect(callback).toHaveBeenCalledOnce();
  });

  it('does not call onUnauthorized when no callback registered', async () => {
    const body = { type: 'about:blank', title: 'Unauthorized', status: 401 };
    const response = new Response(JSON.stringify(body), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });

    // Should not throw due to missing callback — still throws ApiError
    await expect(handleResponse({ response })).rejects.toBeInstanceOf(ApiError);
  });

  it('does not call onUnauthorized for non-401 errors', async () => {
    const callback = vi.fn();
    setOnUnauthorized(callback);

    const body = { type: 'about:blank', title: 'Forbidden', status: 403 };
    const response = new Response(JSON.stringify(body), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });

    await expect(handleResponse({ response })).rejects.toBeInstanceOf(ApiError);
    expect(callback).not.toHaveBeenCalled();
  });

  it('calls onForbiddenOrLocked callback for 403', async () => {
    const callback = vi.fn();
    setOnForbiddenOrLocked(callback);

    const body = { type: 'about:blank', title: 'Forbidden', status: 403 };
    const response = new Response(JSON.stringify(body), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });

    await expect(handleResponse({ response })).rejects.toBeInstanceOf(ApiError);
    expect(callback).toHaveBeenCalledWith(403);

    setOnForbiddenOrLocked(null);
  });

  it('calls onForbiddenOrLocked callback for 423', async () => {
    const callback = vi.fn();
    setOnForbiddenOrLocked(callback);

    const body = { type: 'about:blank', title: 'Locked', status: 423 };
    const response = new Response(JSON.stringify(body), {
      status: 423,
      headers: { 'Content-Type': 'application/json' },
    });

    await expect(handleResponse({ response })).rejects.toBeInstanceOf(ApiError);
    expect(callback).toHaveBeenCalledWith(423);

    setOnForbiddenOrLocked(null);
  });

  it('does not call onForbiddenOrLocked for 401 or 500', async () => {
    const callback = vi.fn();
    setOnForbiddenOrLocked(callback);

    const body401 = { type: 'about:blank', title: 'Unauthorized', status: 401 };
    const response401 = new Response(JSON.stringify(body401), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
    await expect(handleResponse({ response: response401 })).rejects.toBeInstanceOf(ApiError);

    const body500 = { type: 'about:blank', title: 'Internal Server Error', status: 500 };
    const response500 = new Response(JSON.stringify(body500), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
    await expect(handleResponse({ response: response500 })).rejects.toBeInstanceOf(ApiError);

    expect(callback).not.toHaveBeenCalled();

    setOnForbiddenOrLocked(null);
  });

  it('does not call onForbiddenOrLocked when no callback registered', async () => {
    setOnForbiddenOrLocked(null);

    const body = { type: 'about:blank', title: 'Forbidden', status: 403 };
    const response = new Response(JSON.stringify(body), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });

    // Should still throw ApiError, just not crash
    await expect(handleResponse({ response })).rejects.toBeInstanceOf(ApiError);
  });
});
