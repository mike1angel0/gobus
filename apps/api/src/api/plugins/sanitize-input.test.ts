import { describe, expect, it } from 'vitest';

import { stripHtmlFromStrings } from './sanitize-input.js';

describe('stripHtmlFromStrings', () => {
  it('strips HTML tags from a simple string', () => {
    expect(stripHtmlFromStrings('<b>hello</b>')).toBe('hello');
  });

  it('strips script tags and their content markers', () => {
    const result = stripHtmlFromStrings('<script>alert("xss")</script>safe');
    expect(result).toBe('alert("xss")safe');
  });

  it('strips nested HTML tags', () => {
    expect(stripHtmlFromStrings('<div><p><b>text</b></p></div>')).toBe('text');
  });

  it('returns non-string primitives unchanged', () => {
    expect(stripHtmlFromStrings(42)).toBe(42);
    expect(stripHtmlFromStrings(true)).toBe(true);
    expect(stripHtmlFromStrings(null)).toBeNull();
    expect(stripHtmlFromStrings(undefined)).toBeUndefined();
  });

  it('recursively strips from object values', () => {
    const input = { name: '<b>John</b>', age: 30, bio: '<script>xss</script>' };
    const result = stripHtmlFromStrings(input);
    expect(result).toEqual({ name: 'John', age: 30, bio: 'xss' });
  });

  it('recursively strips from arrays', () => {
    const input = ['<b>one</b>', '<i>two</i>', 3];
    const result = stripHtmlFromStrings(input);
    expect(result).toEqual(['one', 'two', 3]);
  });

  it('handles deeply nested objects', () => {
    const input = { a: { b: { c: '<b>deep</b>' } } };
    const result = stripHtmlFromStrings(input);
    expect(result).toEqual({ a: { b: { c: 'deep' } } });
  });

  it('preserves empty strings', () => {
    expect(stripHtmlFromStrings('')).toBe('');
  });

  it('preserves strings without HTML', () => {
    expect(stripHtmlFromStrings('plain text')).toBe('plain text');
  });
});
