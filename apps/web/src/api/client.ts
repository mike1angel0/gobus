import createClient, { type Middleware } from 'openapi-fetch';
import type { paths } from '@/api/generated/types';
import { parseApiError } from '@/api/errors';

/**
 * Returns the API base URL from the `VITE_API_URL` environment variable.
 * Falls back to `''` (same-origin) since the generated path types already
 * include the `/api/v1` prefix.
 */
function getBaseUrl(): string {
  return import.meta.env.VITE_API_URL ?? '';
}

/** Callback invoked when the API returns a 401 (unauthorized). Returns true if refresh succeeded. */
export type OnUnauthorizedCallback = () => Promise<boolean>;

/** Callback invoked when the API returns a 403 (suspended) or 423 (locked). */
export type OnForbiddenOrLockedCallback = (status: 403 | 423) => void;

let accessToken: string | null = null;
let onUnauthorized: OnUnauthorizedCallback | null = null;
let onForbiddenOrLocked: OnForbiddenOrLockedCallback | null = null;

/**
 * Stores the current access token in memory (never persisted to storage).
 * Called by the auth layer after login or token refresh.
 *
 * @param token - The JWT access token, or `null` to clear it.
 */
export function setAccessToken(token: string | null): void {
  accessToken = token;
}

/**
 * Returns the current in-memory access token, or `null` if not set.
 */
export function getAccessToken(): string | null {
  return accessToken;
}

/**
 * Registers a callback that fires when any API request receives a 401 response.
 * The callback should attempt token refresh and return true if successful.
 *
 * @param callback - Async function to invoke on 401, or `null` to unregister.
 */
export function setOnUnauthorized(callback: OnUnauthorizedCallback | null): void {
  onUnauthorized = callback;
}

/**
 * Registers a callback that fires when any API request receives a 403 or 423 response.
 * The auth layer uses this to clear auth state (account suspended or locked).
 *
 * @param callback - Function to invoke on 403/423, or `null` to unregister.
 */
export function setOnForbiddenOrLocked(callback: OnForbiddenOrLockedCallback | null): void {
  onForbiddenOrLocked = callback;
}

/**
 * Handles outgoing requests by attaching the Bearer token header.
 *
 * @param params - Object containing the outgoing Request.
 * @returns The request with Authorization header if a token is set.
 */
export async function handleRequest({ request }: { request: Request }): Promise<Request> {
  if (accessToken) {
    request.headers.set('Authorization', `Bearer ${accessToken}`);
  }
  return request;
}

/**
 * Handles incoming responses by converting errors to {@link ApiError} instances.
 * On 401, attempts token refresh and retries the request once with the new token.
 *
 * @param params - Object containing the incoming Response and the original Request.
 * @returns The response if OK, otherwise throws an `ApiError`.
 */
export async function handleResponse({
  response,
  request,
}: {
  response: Response;
  request: Request;
}): Promise<Response> {
  if (response.ok) return response;

  if (response.status === 401 && onUnauthorized) {
    const refreshed = await onUnauthorized();
    if (refreshed && accessToken) {
      // Retry the original request with the new token
      const retryRequest = request.clone();
      retryRequest.headers.set('Authorization', `Bearer ${accessToken}`);
      const retryResponse = await fetch(retryRequest);
      if (retryResponse.ok) return retryResponse;
      // If retry also fails, fall through to throw the error
    }
  }

  if ((response.status === 403 || response.status === 423) && onForbiddenOrLocked) {
    onForbiddenOrLocked(response.status as 403 | 423);
  }

  let body: unknown;
  try {
    body = await response.clone().json();
  } catch {
    body = await response.clone().text();
  }

  throw parseApiError(response.status, body);
}

/**
 * Middleware that attaches the Bearer token to every outgoing request
 * and converts error responses into {@link ApiError} instances.
 */
const authAndErrorMiddleware: Middleware = {
  onRequest: handleRequest,
  onResponse: handleResponse,
};

/**
 * Pre-configured, typed API client built on `openapi-fetch`.
 *
 * - Base URL is read from `VITE_API_URL` env var.
 * - Bearer token is automatically attached from in-memory storage.
 * - Non-OK responses are converted to `ApiError` instances.
 * - 401 responses trigger token refresh and automatic request retry.
 *
 * @example
 * ```ts
 * const { data, error } = await apiClient.POST('/api/v1/auth/login', {
 *   body: { email: 'user@example.com', password: 'secret' },
 * });
 * ```
 */
export const apiClient = createClient<paths>({ baseUrl: getBaseUrl() });

apiClient.use(authAndErrorMiddleware);
