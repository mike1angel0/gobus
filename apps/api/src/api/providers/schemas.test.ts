import { describe, it, expect } from 'vitest';
import { providerSchema, providerDataResponseSchema } from './schemas.js';

describe('provider schemas', () => {
  describe('providerSchema', () => {
    const validProvider = {
      id: 'prov-1',
      name: 'Test Transport',
      logo: 'https://example.com/logo.png',
      contactEmail: 'info@test.com',
      contactPhone: '+40712345678',
      status: 'APPROVED',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-02T00:00:00.000Z',
    };

    it('should parse valid provider data', () => {
      const result = providerSchema.parse(validProvider);
      expect(result).toEqual(validProvider);
    });

    it('should parse provider with null optional fields', () => {
      const result = providerSchema.parse({
        ...validProvider,
        logo: null,
        contactEmail: null,
        contactPhone: null,
      });
      expect(result.logo).toBeNull();
      expect(result.contactEmail).toBeNull();
      expect(result.contactPhone).toBeNull();
    });

    it('should reject invalid status value', () => {
      expect(() => providerSchema.parse({ ...validProvider, status: 'INVALID' })).toThrow();
    });

    it('should reject missing required fields', () => {
      expect(() => providerSchema.parse({ id: 'prov-1' })).toThrow();
    });

    it('should reject name exceeding maxLength', () => {
      expect(() => providerSchema.parse({ ...validProvider, name: 'x'.repeat(201) })).toThrow();
    });

    it('should reject invalid email format', () => {
      expect(() =>
        providerSchema.parse({ ...validProvider, contactEmail: 'not-an-email' }),
      ).toThrow();
    });

    it('should reject invalid datetime format', () => {
      expect(() => providerSchema.parse({ ...validProvider, createdAt: 'not-a-date' })).toThrow();
    });
  });

  describe('providerDataResponseSchema', () => {
    it('should parse valid data response envelope', () => {
      const valid = {
        data: {
          id: 'prov-1',
          name: 'Test Transport',
          logo: null,
          contactEmail: null,
          contactPhone: null,
          status: 'PENDING',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
        },
      };
      const result = providerDataResponseSchema.parse(valid);
      expect(result.data.id).toBe('prov-1');
      expect(result.data.status).toBe('PENDING');
    });

    it('should reject response without data wrapper', () => {
      expect(() =>
        providerDataResponseSchema.parse({
          id: 'prov-1',
          name: 'Test',
        }),
      ).toThrow();
    });
  });
});
