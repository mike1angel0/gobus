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

### TASK-012: Translate search and booking namespaces
**Description:** Extract strings for the public search experience and booking flow.

**Acceptance Criteria:**
- [ ] `search.json` keys cover: search form (origin, destination, date, passengers labels/placeholders), trip card (departure, arrival, duration, price, seats available), trip detail page, filters, "X trips found" with interpolation
- [ ] `booking.json` keys cover: seat selection instructions, seat types (Standard, Premium, Accessible, Blocked), booking card (status, trip date, boarding/alighting stops, seats, total price), "My Trips" page title, cancel booking confirmation, booking status labels (Confirmed, Cancelled, Completed)
- [ ] Pages updated: `search.tsx`, `trip/[id].tsx`, `my-trips.tsx`, `search-form.tsx`, `trip-card.tsx`, `booking-card.tsx`, `seat-map.tsx`
- [ ] Both RO and EN files complete
- [ ] Typecheck passes, lint clean

### TASK-013: Translate provider namespace
**Description:** Extract all provider dashboard strings. This is the largest namespace covering dashboard stats, routes CRUD, fleet/bus management, schedule management, driver management, and tracking.

**Acceptance Criteria:**
- [ ] `provider.json` keys organized by sub-section:
  - `dashboard.*` — stat cards, revenue, occupancy, analytics
  - `routes.*` — create/edit route dialog, stop list, route card
  - `fleet.*` — create/edit bus dialog, seat map editor, bus card, license plate, capacity
  - `schedules.*` — create schedule dialog, filter bar, schedule card, status labels, days of week
  - `drivers.*` — create driver dialog, driver list, assignment
  - `analytics.*` — revenue by route, total bookings, occupancy rate
- [ ] All provider pages and dialogs updated to use `useTranslation('provider')`
- [ ] Both RO and EN files complete
- [ ] Typecheck passes, lint clean

### TASK-014: Translate driver, admin, and tracking namespaces
**Description:** Extract strings for driver features, admin panel, and real-time tracking.

**Acceptance Criteria:**
- [ ] `driver.json` keys cover: trip list (date navigation, schedule cards), trip detail (location sharing, stop progress, passenger count), delay reporting (preset buttons, reason dropdown, notes, custom minutes)
- [ ] `admin.json` keys cover: user management (role/status filters, suspend/unsuspend/unlock/force-logout actions, confirmation dialogs), audit logs (action filter, date range, expandable detail), fleet management (seat toggle), dashboard stat cards
- [ ] `tracking.json` keys cover: live map labels, bus sidebar (speed, last update, active delays), delay list, report delay dialog
- [ ] All driver, admin, and tracking pages/components updated
- [ ] Both RO and EN files complete
- [ ] Typecheck passes, lint clean

### TASK-015: Translate error boundary and 404 page
**Description:** Translate the error fallback and not-found pages.

**Acceptance Criteria:**
- [ ] Error fallback: "Something went wrong", "Try again", error details (when available)
- [ ] Not found: "Page not found", "The page you're looking for doesn't exist", "Go home" button
- [ ] `error-boundary.tsx`, `error-fallback.tsx`, `not-found.tsx` updated to use `useTranslation('common')`
- [ ] Both RO and EN files updated
- [ ] Typecheck passes, lint clean

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
