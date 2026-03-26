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

### TASK-016: Create frontend .env.example
**Description:** No `.env.example` exists in `apps/web/`. Developers and deployments have no documentation of required environment variables.

**Acceptance Criteria:**
- [ ] `apps/web/.env.example` created with:
  ```
  # API base URL (include /api/v1 path)
  VITE_API_URL=http://localhost:3000/api/v1
  ```
- [ ] Comments explain each variable
- [ ] `.gitignore` already excludes `.env` and `.env.local` (verify)

---

## Performance

### TASK-017: Add bundle size measurement
**Description:** No bundle size analysis is configured. Changes could accidentally bloat the bundle without anyone noticing.

**Acceptance Criteria:**
- [ ] `rollup-plugin-visualizer` (or `vite-plugin-visualizer`) added as devDependency
- [ ] `npm run build:analyze` script that generates bundle treemap in `dist/stats.html`
- [ ] Document current bundle size baseline in this task once measured
- [ ] `dist/stats.html` added to `.gitignore`
- [ ] Typecheck passes

### TASK-018: Optimize hero image
**Description:** `src/assets/hero.png` is a PNG that may be large. If used on the home page, it should be optimized.

**Acceptance Criteria:**
- [ ] Convert `hero.png` to WebP format (or keep PNG if < 50KB)
- [ ] Add `loading="lazy"` attribute if used in an `<img>` tag
- [ ] Add `width` and `height` attributes to prevent layout shift
- [ ] If image is unused, delete it
- [ ] Typecheck passes

---

## Quality Gates

### TASK-019: Phase 6 final quality gates
**Description:** Run all quality gates and fix every issue introduced by Phase 6.

**Acceptance Criteria:**
- [ ] `npm run typecheck` — zero errors
- [ ] `npm run lint` — zero errors
- [ ] `npm run format:check` — passes
- [ ] `npm run test` — all tests pass
- [ ] `npm run test:coverage` — meets 90% threshold
- [ ] `npm run build` — production build succeeds
- [ ] `npm run api:check` — all frontend API calls valid
- [ ] Zero `any` types in new code
- [ ] Zero `console.log` in new code
- [ ] All new hooks have JSDoc and unit tests
- [ ] Security headers verified with `curl -I` against running container
- [ ] Gzip compression verified
- [ ] Bundle size documented
- [ ] i18n: all 9 namespaces have complete RO and EN translations
- [ ] i18n: no hardcoded user-facing strings remain in components (grep for quoted Romanian/English text)
- [ ] i18n: language switcher works in both desktop and mobile nav
- [ ] i18n: page refresh preserves selected language
- [ ] i18n: dynamic page titles translated in both languages
