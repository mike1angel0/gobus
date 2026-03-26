import { type FastifyError, type FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { ZodError } from 'zod';

import { AppError, type FieldError } from '@/domain/errors/app-error.js';
import { ErrorCodes } from '@/domain/errors/error-codes.js';

/** RFC 9457 Problem Details response body. */
interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  code?: string;
  errors?: FieldError[];
}

/** Map HTTP status codes to RFC 9457 problem type URIs. */
function problemTypeUri(status: number): string {
  return `https://httpstatuses.com/${status}`;
}

/** Map HTTP status codes to short human-readable titles. */
function httpTitle(status: number): string {
  const titles: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    413: 'Payload Too Large',
    423: 'Locked',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
  };
  return titles[status] ?? 'Error';
}

/**
 * Map ZodError issues to field-level FieldError objects.
 * Extracts the field path and message from each Zod issue.
 */
function mapZodErrors(error: ZodError): FieldError[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || '_root',
    message: issue.message,
  }));
}

/**
 * Build an RFC 9457 Problem Details response from an AppError.
 */
function fromAppError(error: AppError): ProblemDetails {
  const body: ProblemDetails = {
    type: problemTypeUri(error.statusCode),
    title: httpTitle(error.statusCode),
    status: error.statusCode,
    detail: error.detail,
    code: error.code,
  };
  if (error.errors.length > 0) {
    body.errors = error.errors;
  }
  return body;
}

/**
 * Build an RFC 9457 Problem Details response from a ZodError.
 */
function fromZodError(error: ZodError): ProblemDetails {
  return {
    type: problemTypeUri(400),
    title: 'Bad Request',
    status: 400,
    detail: 'Validation failed',
    code: ErrorCodes.VALIDATION_ERROR,
    errors: mapZodErrors(error),
  };
}

/**
 * Build a safe RFC 9457 Problem Details response for unknown errors.
 * Does not leak internal error details.
 */
function fromUnknownError(): ProblemDetails {
  return {
    type: problemTypeUri(500),
    title: 'Internal Server Error',
    status: 500,
    detail: 'An unexpected error occurred',
    code: ErrorCodes.INTERNAL_ERROR,
  };
}

/**
 * Detect Prisma client errors by constructor name pattern.
 * Avoids importing Prisma runtime — checks name convention instead.
 */
function isPrismaError(error: unknown): boolean {
  if (error == null || typeof error !== 'object') return false;
  const name = (error as { name?: string }).name ?? '';
  return name.startsWith('PrismaClient');
}

/**
 * Register the global error handler plugin.
 * Converts all errors to RFC 9457 Problem Details format matching
 * the OpenAPI ErrorResponse schema.
 */
async function errorHandlerPlugin(app: FastifyInstance): Promise<void> {
  app.setErrorHandler((error, _request, reply) => {
    // AppError — known application errors
    if (error instanceof AppError) {
      const body = fromAppError(error);
      return reply.status(body.status).send(body);
    }

    // ZodError — validation failures
    if (error instanceof ZodError) {
      const body = fromZodError(error);
      return reply.status(body.status).send(body);
    }

    // Fastify framework errors (rate limit, payload too large, etc.)
    const fastifyError = error as FastifyError;

    // Payload too large (body exceeds bodyLimit)
    if (fastifyError.statusCode === 413) {
      const body: ProblemDetails = {
        type: problemTypeUri(413),
        title: 'Payload Too Large',
        status: 413,
        detail: 'Request body exceeds the maximum allowed size of 1 MB.',
        code: ErrorCodes.VALIDATION_ERROR,
      };
      return reply.status(413).send(body);
    }

    // Rate limit errors (from @fastify/rate-limit)
    if (fastifyError.statusCode === 429) {
      const body: ProblemDetails = {
        type: problemTypeUri(429),
        title: 'Too Many Requests',
        status: 429,
        detail: 'Rate limit exceeded. Please try again later.',
        code: ErrorCodes.RATE_LIMITED,
      };
      return reply.status(429).send(body);
    }

    // Fastify validation errors (from schema validation)
    if (fastifyError.validation) {
      const fieldErrors: FieldError[] = fastifyError.validation.map((v) => {
        const instancePath = v.instancePath ?? '';
        const params = v.params as Record<string, unknown> | undefined;
        const missingProp =
          typeof params?.missingProperty === 'string' ? params.missingProperty : '';
        return {
          field: instancePath.replace(/^\//, '').replace(/\//g, '.') || missingProp || '_root',
          message: v.message ?? 'Validation failed',
        };
      });
      const body: ProblemDetails = {
        type: problemTypeUri(400),
        title: 'Bad Request',
        status: 400,
        detail: 'Validation failed',
        code: ErrorCodes.VALIDATION_ERROR,
        errors: fieldErrors,
      };
      return reply.status(400).send(body);
    }

    // Prisma errors — log full details but return safe 500 (never leak query/schema info)
    if (isPrismaError(error)) {
      app.log.error(error, 'Prisma database error');
      const body = fromUnknownError();
      return reply.status(body.status).send(body);
    }

    // Unknown errors — log and return safe 500
    app.log.error(error, 'Unhandled error');
    const body = fromUnknownError();
    return reply.status(body.status).send(body);
  });
}

export default fp(errorHandlerPlugin, {
  name: 'error-handler',
});
