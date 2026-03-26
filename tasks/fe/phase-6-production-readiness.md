# Phase 6: Production Readiness — Security Headers, SEO, i18n, Nginx Hardening, Docker

**Status**: Pending
**Dependencies**: FE Phase 5 (feature completeness), BE Phase 5 (production readiness)
**Goal**: Fix all remaining frontend issues blocking production deployment: nginx security headers, SEO, internationalization (RO + EN), response compression, Docker hardening, and developer experience improvements.

---

## Nginx & Security

### TASK-001: Add security headers to nginx.conf ✅
**Description:** `apps/web/nginx.conf` serves the SPA but has zero security headers. Missing: CSP, X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security, Referrer-Policy, Permissions-Policy. The API backend has all of these via Helmet, but the frontend nginx does not.

**Acceptance Criteria:**
- [x] `Content-Security-Policy` header: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.basemaps.cartocdn.com; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`
- [x] `X-Frame-Options: DENY`
- [x] `X-Content-Type-Options: nosniff`
- [x] `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- [x] `Referrer-Policy: strict-origin-when-cross-origin`
- [x] `Permissions-Policy: camera=(), microphone=(), geolocation=(self)`
- [x] `X-XSS-Protection: 0` (modern CSP makes this redundant, disable to avoid false positives)
- [x] All headers applied with `always` directive
- [x] Manual test with `curl -I` verifies all headers present

### TASK-002: Add gzip compression to nginx.conf ✅

### TASK-003: Add cache-busting for index.html ✅

---

## Docker Hardening

### TASK-004: Harden web Dockerfile ✅

---

## SEO & Meta Tags

### TASK-005: Add meta tags to index.html ✅

### TASK-006: Add dynamic page titles ✅

---

## Internationalization (i18n)

### TASK-007: Set up react-i18next with per-domain translation files ✅

### TASK-008: Create language switcher component ✅

### TASK-009: Translate common namespace ✅

### TASK-010: Translate nav namespace ✅

### TASK-011: Translate auth namespace ✅

### TASK-012: Translate search and booking namespaces ✅

### TASK-013: Translate provider namespace ✅

### TASK-014: Translate driver, admin, and tracking namespaces ✅

### TASK-015: Translate error boundary and 404 page ✅

---

## Developer Experience

### TASK-016: Create frontend .env.example ✅

---

## Performance

### TASK-017: Add bundle size measurement ✅
**Bundle baseline:** Total JS: 1.3MB (gzip ~300KB). Largest chunks: index 411KB (127KB gz), live-map 156KB (46KB gz), types 56KB (13KB gz).

### TASK-018: Optimize hero image ✅

---

## Quality Gates

### TASK-019: Phase 6 final quality gates ✅
**Description:** Run all quality gates and fix every issue introduced by Phase 6.

**Acceptance Criteria:**
- [x] `npm run typecheck` — zero errors
- [x] `npm run lint` — zero errors
- [x] `npm run format:check` — passes
- [x] `npm run test` — all tests pass
- [x] `npm run test:coverage` — meets 90% threshold (95.74%)
- [x] `npm run build` — production build succeeds
- [x] `npm run api:check` — all frontend API calls valid (49/51 endpoints, 96.1%)
- [x] Zero `any` types in new code
- [x] Zero `console.log` in new code
- [x] All new hooks have JSDoc and unit tests
- [x] Security headers verified with `curl -I` against running container
- [x] Gzip compression verified
- [x] Bundle size documented
- [x] i18n: all 9 namespaces have complete RO and EN translations
- [x] i18n: no hardcoded user-facing strings remain in components (grep for quoted Romanian/English text)
- [x] i18n: language switcher works in both desktop and mobile nav
- [x] i18n: page refresh preserves selected language
- [x] i18n: dynamic page titles translated in both languages
