import { describe, expect, it } from 'vitest';

import { stripHtmlFromStrings, exceedsJsonDepth } from './sanitize-input.js';

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

describe('exceedsJsonDepth', () => {
  it('returns false for flat object within depth limit', () => {
    expect(exceedsJsonDepth({ a: 1, b: 'hello' }, 5)).toBe(false);
  });

  it('returns false for primitives', () => {
    expect(exceedsJsonDepth('string', 5)).toBe(false);
    expect(exceedsJsonDepth(42, 5)).toBe(false);
    expect(exceedsJsonDepth(null, 5)).toBe(false);
    expect(exceedsJsonDepth(undefined, 5)).toBe(false);
  });

  it('returns false for object at exactly the depth limit', () => {
    // 5 levels: {a: {b: {c: {d: {e: "val"}}}}}
    const data = { a: { b: { c: { d: { e: 'val' } } } } };
    expect(exceedsJsonDepth(data, 5)).toBe(false);
  });

  it('returns true for object exceeding depth limit', () => {
    // 6 levels: {a: {b: {c: {d: {e: {f: "val"}}}}}}
    const data = { a: { b: { c: { d: { e: { f: 'val' } } } } } };
    expect(exceedsJsonDepth(data, 5)).toBe(true);
  });

  it('returns true for deeply nested arrays', () => {
    const data = { a: [{ b: [{ c: [{ d: [{ e: [{ f: 'deep' }] }] }] }] }] };
    expect(exceedsJsonDepth(data, 5)).toBe(true);
  });

  it('returns false for flat arrays', () => {
    expect(exceedsJsonDepth([1, 2, 3], 5)).toBe(false);
  });

  it('handles depth limit of 0 (only primitives allowed)', () => {
    expect(exceedsJsonDepth('ok', 0)).toBe(false);
    expect(exceedsJsonDepth({ a: 1 }, 0)).toBe(true);
  });
});
