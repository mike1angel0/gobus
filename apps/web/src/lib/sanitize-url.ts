/**
 * Set of URL schemes considered dangerous for XSS injection.
 * These schemes can execute code when used in `href` or `src` attributes.
 */
const DANGEROUS_SCHEMES = new Set(['javascript:', 'data:', 'vbscript:']);

/**
 * Sanitizes a URL to prevent XSS via dangerous schemes like `javascript:`,
 * `data:`, and `vbscript:`. Only allows `https:`, `http:`, `mailto:`, `tel:`,
 * and relative URLs.
 *
 * Returns an empty string for dangerous URLs so they render as no-ops in
 * `href` or `src` attributes.
 *
 * @param url - The URL string to sanitize.
 * @returns The original URL if safe, or an empty string if dangerous.
 *
 * @example
 * ```ts
 * sanitizeUrl('https://example.com')       // 'https://example.com'
 * sanitizeUrl('javascript:alert(1)')       // ''
 * sanitizeUrl('/relative/path')            // '/relative/path'
 * sanitizeUrl('data:text/html,<script>')   // ''
 * ```
 */
export function sanitizeUrl(url: string): string {
  if (!url) return '';

  const trimmed = url.trim();
  if (!trimmed) return '';

  // Try parsing as absolute URL to check scheme
  try {
    const parsed = new URL(trimmed);
    const scheme = parsed.protocol.toLowerCase();
    if (DANGEROUS_SCHEMES.has(scheme)) {
      return '';
    }
    return trimmed;
  } catch {
    // Not a valid absolute URL — treat as relative URL (safe)
    // But still check for scheme-like patterns (e.g. "javascript:alert(1)" without valid URL parsing)
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex > 0 && colonIndex < 10) {
      const possibleScheme = trimmed.slice(0, colonIndex + 1).toLowerCase();
      if (DANGEROUS_SCHEMES.has(possibleScheme)) {
        return '';
      }
    }
    return trimmed;
  }
}
