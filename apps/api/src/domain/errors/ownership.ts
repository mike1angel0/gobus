import { AppError } from './app-error.js';
import { ErrorCodes } from './error-codes.js';

/**
 * Verify that a resource belongs to the requesting user/provider.
 * Throws 404 (not 403) on mismatch to prevent resource enumeration.
 * Acts as a TypeScript assertion function to narrow the resource type.
 *
 * @param resource - The fetched resource, or null/undefined if not found
 * @param resourceOwnerId - The owner ID on the resource (e.g. resource.providerId)
 * @param requesterId - The caller's ID (e.g. session.providerId)
 * @param resourceName - Human-readable name for the error message (e.g. "Route")
 * @throws AppError with 404 if resource is null or ownership check fails
 */
export function verifyOwnership<T>(
  resource: T | null | undefined,
  resourceOwnerId: string | null | undefined,
  requesterId: string,
  resourceName: string,
): asserts resource is T {
  if (!resource || resourceOwnerId !== requesterId) {
    throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, `${resourceName} not found`);
  }
}
