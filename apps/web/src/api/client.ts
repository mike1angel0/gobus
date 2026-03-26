import createClient, { type Middleware } from 'openapi-fetch';
import type { paths } from '@/api/generated/types';
import { parseApiError } from '@/api/errors';

/**
 * Returns the API base URL from the `VITE_API_URL` environment variable.
 * Falls back to `'/api/v1'` during development if not set.
 */
function getBaseUrl(): string {
  return import.meta.env.VITE_API_URL ?? '/api/v1';
}

/** Callback invoked when the API returns a 401 (unauthorized). */
export type OnUnauthorizedCallback = () => void;

let accessToken: string | null = null;
let onUnauthorized: OnUnauthorizedCallback | null = null;

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
 * The auth layer uses this to trigger a token refresh or redirect to login.
 *
 * @param callback - Function to invoke on 401, or `null` to unregister.
 */
export function setOnUnauthorized(callback: OnUnauthorizedCallback | null): void {
  onUnauthorized = callback;
}

/**
 * Middleware that attaches the Bearer token to every outgoing request
 * and converts error responses into {@link ApiError} instances.
 */
const authAndErrorMiddleware: Middleware = {
  async onRequest({ request }) {
    if (accessToken) {
      request.headers.set('Authorization', `Bearer ${accessToken}`);
    }
    return request;
  },

  async onResponse({ response }) {
    if (response.ok) return response;

    if (response.status === 401 && onUnauthorized) {
      onUnauthorized();
    }

    let body: unknown;
    try {
      body = await response.clone().json();
    } catch {
      body = await response.clone().text();
    }

    throw parseApiError(response.status, body);
  },
};

/**
 * Pre-configured, typed API client built on `openapi-fetch`.
 *
 * - Base URL is read from `VITE_API_URL` env var.
 * - Bearer token is automatically attached from in-memory storage.
 * - Non-OK responses are converted to `ApiError` instances.
 * - 401 responses trigger the registered `onUnauthorized` callback.
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
