/**
 * Pagination metadata matching the OpenAPI PaginationMeta schema.
 * Included in all paginated list responses.
 */
export interface PaginationMeta {
  /** Total number of records matching the query */
  total: number;
  /** Current page number (1-based) */
  page: number;
  /** Number of records per page */
  pageSize: number;
  /** Total number of pages */
  totalPages: number;
}

/**
 * API response envelope for a single item.
 * Matches the OpenAPI `{ data: T }` pattern.
 */
export interface ApiResponse<T> {
  data: T;
}

/**
 * API response envelope for paginated lists.
 * Matches the OpenAPI `{ data: T[], meta: PaginationMeta }` pattern.
 */
export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}
