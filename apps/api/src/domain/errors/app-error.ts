import { type ErrorCode } from './error-codes.js';

/** Represents a single field-level validation error. */
export interface FieldError {
  /** The field path that caused the error. */
  field: string;
  /** Human-readable error message for this field. */
  message: string;
}

/**
 * Application error with HTTP status, error code, and optional field errors.
 * Thrown by services and caught by the error handler plugin to produce
 * RFC 9457 Problem Details responses.
 */
export class AppError extends Error {
  /** HTTP status code to return. */
  readonly statusCode: number;
  /** Application-specific error code from ErrorCodes. */
  readonly code: ErrorCode;
  /** Human-readable explanation specific to this occurrence. */
  readonly detail: string;
  /** Optional field-level validation errors. */
  readonly errors: FieldError[];

  /** Create an application error with HTTP status, error code, and optional field errors. */
  constructor(
    statusCode: number,
    code: ErrorCode,
    detail: string,
    errors: FieldError[] = [],
  ) {
    super(detail);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.detail = detail;
    this.errors = errors;
  }
}
