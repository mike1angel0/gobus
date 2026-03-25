import { describe, expect, it } from 'vitest';

import {
  dataResponse,
  idParamSchema,
  paginatedResponse,
  paginationQuerySchema,
} from './schemas.js';
import { z } from 'zod';

describe('paginationQuerySchema', () => {
  it('applies defaults when no values provided', () => {
    const result = paginationQuerySchema.parse({});
    expect(result).toEqual({ page: 1, pageSize: 20 });
  });

  it('parses string values via coerce', () => {
    const result = paginationQuerySchema.parse({ page: '3', pageSize: '50' });
    expect(result).toEqual({ page: 3, pageSize: 50 });
  });

  it('rejects page less than 1', () => {
    expect(() => paginationQuerySchema.parse({ page: 0 })).toThrow();
  });

  it('rejects pageSize greater than 100', () => {
    expect(() => paginationQuerySchema.parse({ pageSize: 101 })).toThrow();
  });

  it('rejects pageSize less than 1', () => {
    expect(() => paginationQuerySchema.parse({ pageSize: 0 })).toThrow();
  });

  it('rejects unknown fields in strict mode', () => {
    expect(() => paginationQuerySchema.parse({ page: 1, extra: 'bad' })).toThrow();
  });
});

describe('idParamSchema', () => {
  it('accepts a valid id string', () => {
    const result = idParamSchema.parse({ id: 'clx1abc123def456ghi' });
    expect(result.id).toBe('clx1abc123def456ghi');
  });

  it('rejects empty id', () => {
    expect(() => idParamSchema.parse({ id: '' })).toThrow();
  });

  it('rejects id longer than 30 characters', () => {
    expect(() => idParamSchema.parse({ id: 'a'.repeat(31) })).toThrow();
  });

  it('rejects unknown fields in strict mode', () => {
    expect(() => idParamSchema.parse({ id: 'abc', extra: 'bad' })).toThrow();
  });
});

describe('dataResponse', () => {
  it('wraps a schema in a data envelope', () => {
    const schema = dataResponse(z.object({ name: z.string() }));
    const result = schema.parse({ data: { name: 'test' } });
    expect(result).toEqual({ data: { name: 'test' } });
  });

  it('rejects when data key is missing', () => {
    const schema = dataResponse(z.string());
    expect(() => schema.parse({ value: 'test' })).toThrow();
  });
});

describe('paginatedResponse', () => {
  it('wraps a schema in a paginated envelope', () => {
    const schema = paginatedResponse(z.object({ id: z.string() }));
    const result = schema.parse({
      data: [{ id: '1' }, { id: '2' }],
      meta: { total: 2, page: 1, pageSize: 20, totalPages: 1 },
    });
    expect(result.data).toHaveLength(2);
    expect(result.meta.total).toBe(2);
    expect(result.meta.totalPages).toBe(1);
  });

  it('rejects when meta is missing', () => {
    const schema = paginatedResponse(z.string());
    expect(() => schema.parse({ data: ['a'] })).toThrow();
  });

  it('rejects data array exceeding max 100 items', () => {
    const schema = paginatedResponse(z.number());
    const items = Array.from({ length: 101 }, (_, i) => i);
    expect(() =>
      schema.parse({
        data: items,
        meta: { total: 101, page: 1, pageSize: 101, totalPages: 1 },
      }),
    ).toThrow();
  });
});
