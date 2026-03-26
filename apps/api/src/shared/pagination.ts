import type { PaginationMeta } from './types.js';

/** Input for building pagination metadata. */
export interface BuildPaginationMetaInput {
  /** Total number of records matching the query */
  total: number;
  /** Current page number (1-based) */
  page: number;
  /** Number of records per page */
  pageSize: number;
}

/**
 * Build pagination metadata from the total count, current page, and page size.
 * Computes totalPages using ceiling division.
 */
export function buildPaginationMeta(input: BuildPaginationMetaInput): PaginationMeta {
  const { total, page, pageSize } = input;
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

  return {
    total,
    page,
    pageSize,
    totalPages,
  };
}

/** Parsed pagination values ready for Prisma queries. */
export interface ParsedPagination {
  /** Number of records to skip */
  skip: number;
  /** Number of records to take */
  take: number;
}

/** Maximum page size enforced server-side regardless of client request. */
const MAX_PAGE_SIZE = 100;

/**
 * Convert page and pageSize into Prisma-compatible skip/take values.
 * Page is 1-based: page 1 → skip 0, page 2 → skip pageSize, etc.
 * Clamps pageSize to MAX_PAGE_SIZE (100) as defense-in-depth.
 */
export function parsePagination(page: number, pageSize: number): ParsedPagination {
  const safePageSize = Math.min(pageSize, MAX_PAGE_SIZE);
  return {
    skip: (page - 1) * safePageSize,
    take: safePageSize,
  };
}
