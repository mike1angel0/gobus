import { describe, expect, it } from 'vitest';

import { buildPaginationMeta, parsePagination } from './pagination.js';

describe('buildPaginationMeta', () => {
  it('computes totalPages with ceiling division', () => {
    const result = buildPaginationMeta({ total: 95, page: 1, pageSize: 20 });
    expect(result).toEqual({
      total: 95,
      page: 1,
      pageSize: 20,
      totalPages: 5,
    });
  });

  it('returns totalPages 0 when total is 0', () => {
    const result = buildPaginationMeta({ total: 0, page: 1, pageSize: 20 });
    expect(result).toEqual({
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
    });
  });

  it('returns totalPages 1 when total equals pageSize', () => {
    const result = buildPaginationMeta({ total: 20, page: 1, pageSize: 20 });
    expect(result).toEqual({
      total: 20,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });
  });

  it('returns totalPages 1 when total is less than pageSize', () => {
    const result = buildPaginationMeta({ total: 5, page: 1, pageSize: 20 });
    expect(result).toEqual({
      total: 5,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });
  });

  it('preserves the page value from input', () => {
    const result = buildPaginationMeta({ total: 100, page: 3, pageSize: 10 });
    expect(result.page).toBe(3);
    expect(result.totalPages).toBe(10);
  });
});

describe('parsePagination', () => {
  it('returns skip 0 for page 1', () => {
    expect(parsePagination(1, 20)).toEqual({ skip: 0, take: 20 });
  });

  it('returns correct skip for page 2', () => {
    expect(parsePagination(2, 20)).toEqual({ skip: 20, take: 20 });
  });

  it('returns correct skip for page 5 with pageSize 10', () => {
    expect(parsePagination(5, 10)).toEqual({ skip: 40, take: 10 });
  });

  it('handles pageSize 1', () => {
    expect(parsePagination(3, 1)).toEqual({ skip: 2, take: 1 });
  });

  it('handles max pageSize 100', () => {
    expect(parsePagination(1, 100)).toEqual({ skip: 0, take: 100 });
  });
});
