import { describe, expect, it } from 'vitest';
import { sanitizeUrl } from './sanitize-url';

describe('sanitizeUrl', () => {
  describe('allows safe URLs', () => {
    it('allows https URLs', () => {
      expect(sanitizeUrl('https://example.com')).toBe('https://example.com');
    });

    it('allows http URLs', () => {
      expect(sanitizeUrl('http://example.com')).toBe('http://example.com');
    });

    it('allows relative paths', () => {
      expect(sanitizeUrl('/some/path')).toBe('/some/path');
    });

    it('allows relative paths without leading slash', () => {
      expect(sanitizeUrl('some/path')).toBe('some/path');
    });

    it('allows mailto URLs', () => {
      expect(sanitizeUrl('mailto:user@example.com')).toBe('mailto:user@example.com');
    });

    it('allows tel URLs', () => {
      expect(sanitizeUrl('tel:+1234567890')).toBe('tel:+1234567890');
    });

    it('allows hash-only URLs', () => {
      expect(sanitizeUrl('#section')).toBe('#section');
    });

    it('allows URLs with query params', () => {
      expect(sanitizeUrl('https://example.com/path?q=1&b=2')).toBe(
        'https://example.com/path?q=1&b=2',
      );
    });
  });

  describe('rejects dangerous URLs', () => {
    it('rejects javascript: scheme', () => {
      expect(sanitizeUrl('javascript:alert(1)')).toBe('');
    });

    it('rejects javascript: with uppercase', () => {
      expect(sanitizeUrl('JavaScript:alert(1)')).toBe('');
    });

    it('rejects data: scheme', () => {
      expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe('');
    });

    it('rejects vbscript: scheme', () => {
      expect(sanitizeUrl('vbscript:MsgBox("XSS")')).toBe('');
    });

    it('rejects javascript: with leading spaces', () => {
      expect(sanitizeUrl('  javascript:alert(1)')).toBe('');
    });
  });

  describe('handles non-parseable URLs with scheme-like patterns', () => {
    it('allows safe relative URLs with a colon', () => {
      expect(sanitizeUrl('foo:bar')).toBe('foo:bar');
    });

    it('allows relative paths with colon beyond position 10', () => {
      expect(sanitizeUrl('some/long/path:value')).toBe('some/long/path:value');
    });
  });

  describe('handles edge cases', () => {
    it('returns empty string for empty input', () => {
      expect(sanitizeUrl('')).toBe('');
    });

    it('returns empty string for whitespace-only input', () => {
      expect(sanitizeUrl('   ')).toBe('');
    });

    it('trims whitespace from valid URLs', () => {
      expect(sanitizeUrl('  https://example.com  ')).toBe('https://example.com');
    });

    it('handles URLs with fragments', () => {
      expect(sanitizeUrl('https://example.com/page#section')).toBe(
        'https://example.com/page#section',
      );
    });
  });
});
