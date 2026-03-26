import type { components } from '@/api/generated/types';

/** RFC 9457 Problem Details error response shape from the API. */
export type ErrorResponse = components['schemas']['ErrorResponse'];

/** A single field-level validation error from the API. */
export type FieldError = components['schemas']['FieldError'];

/**
 * Structured error thrown when the API returns an RFC 9457 Problem Details response.
 *
 * Contains the full error payload including field-level validation errors,
 * an application-specific error code, and the HTTP status.
 *
 * @example
 * ```ts
 * try {
 *   await client.POST('/api/v1/auth/login', { body });
 * } catch (err) {
 *   if (err instanceof ApiError) {
 *     console.log(err.status, err.fieldErrors);
 *   }
 * }
 * ```
 */
export class ApiError extends Error {
  /** HTTP status code (e.g. 400, 401, 409, 422, 423). */
  readonly status: number;

  /** URI reference identifying the problem type. */
  readonly type: string;

  /** Short human-readable summary of the problem. */
  readonly title: string;

  /** Human-readable explanation specific to this occurrence. */
  readonly detail: string | undefined;

  /** Application-specific error code (e.g. `ACCOUNT_LOCKED`). */
  readonly code: string | undefined;

  /** Field-level validation errors (empty array when none). */
  readonly fieldErrors: readonly FieldError[];

  constructor(response: ErrorResponse) {
    super(response.detail ?? response.title);
    this.name = 'ApiError';
    this.status = response.status;
    this.type = response.type;
    this.title = response.title;
    this.detail = response.detail;
    this.code = response.code;
    this.fieldErrors = response.errors ?? [];
  }
}

/**
 * Type guard to check whether an unknown value is an {@link ApiError}.
 *
 * @param error - The value to check.
 * @returns `true` if the value is an `ApiError` instance.
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Checks whether a plain object has the shape of an RFC 9457 error response.
 *
 * @param body - The response body to validate.
 * @returns `true` if the body looks like an `ErrorResponse`.
 */
export function isErrorResponse(body: unknown): body is ErrorResponse {
  if (typeof body !== 'object' || body === null) return false;
  const obj = body as Record<string, unknown>;
  return (
    typeof obj['type'] === 'string' &&
    typeof obj['title'] === 'string' &&
    typeof obj['status'] === 'number'
  );
}

/**
 * Parses an unknown response body into an {@link ApiError}.
 *
 * If the body matches the RFC 9457 shape, wraps it in an `ApiError`.
 * Otherwise, creates a generic `ApiError` from the HTTP status code.
 *
 * @param status - The HTTP status code from the response.
 * @param body - The response body (may or may not be RFC 9457).
 * @returns An `ApiError` instance.
 */
export function parseApiError(status: number, body: unknown): ApiError {
  if (isErrorResponse(body)) {
    return new ApiError(body);
  }

  return new ApiError({
    type: 'about:blank',
    title: `HTTP ${status} Error`,
    status,
    detail: typeof body === 'string' ? body : undefined,
  });
}
