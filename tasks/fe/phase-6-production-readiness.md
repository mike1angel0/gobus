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

### TASK-005: Add meta tags to index.html
**Description:** `apps/web/index.html` has only charset, viewport, and title. Public routes (`/`, `/search`, `/trip/:id`) need proper meta tags for search engines and social sharing.

**Acceptance Criteria:**
- [ ] `<meta name="description" content="...">` with concise app description
- [ ] Open Graph tags: `og:title`, `og:description`, `og:type`, `og:url`, `og:image`
- [ ] `<meta name="theme-color" content="...">` matching app theme
- [ ] `<link rel="canonical" href="...">` pointing to production URL (via env var or hardcoded)
- [ ] Favicon properly linked (verify existing `/favicon.svg` reference works)
- [ ] Typecheck passes (no code changes, HTML only)

### TASK-006: Add dynamic page titles
**Description:** All pages show the same `<title>Transio</title>`. Each page should update the document title for better UX and SEO (even without SSR, title updates help browser tabs and history).

**Acceptance Criteria:**
- [ ] Create a `usePageTitle(title: string)` hook that sets `document.title` on mount
- [ ] Format: `"Page Name | Transio"` (e.g., `"Search | Transio"`, `"My Bookings | Transio"`)
- [ ] Applied to all pages (home, search, trip detail, bookings, provider dashboard, etc.)
- [ ] On unmount, title reverts to `"Transio"` (or just let next page set it)
- [ ] Unit test for the hook
- [ ] Typecheck passes, lint clean

---

## Internationalization (i18n)

### TASK-007: Set up react-i18next with per-domain translation files
**Description:** Install and configure `react-i18next` + `i18next` with lazy-loaded namespace support. Translations must be split per domain (NOT a single file). Languages: Romanian (RO, default) and English (EN). Use JSON translation files organized by namespace. Configure language detection from `localStorage` with fallback to browser `navigator.language`, then to `ro`.

**Acceptance Criteria:**
- [ ] `react-i18next`, `i18next`, `i18next-browser-languagedetector` installed
- [ ] `src/i18n/config.ts` created with i18next initialization: `fallbackLng: 'ro'`, `supportedLngs: ['ro', 'en']`, namespace-based loading
- [ ] Translation file structure created:
  ```
  src/i18n/
  ├── config.ts
  └── locales/
      ├── ro/
      │   ├── common.json       # Buttons, loading, errors, empty states, pagination
      │   ├── nav.json           # Navigation menu items, footer
      │   ├── auth.json          # Login, register, password reset/change, profile
      │   ├── search.json        # Search form, trip cards, trip detail
      │   ├── booking.json       # Seat selection, booking card, my trips
      │   ├── provider.json      # Dashboard, routes, fleet, schedules, drivers, analytics
      │   ├── driver.json        # Driver trips, delay reporting, GPS
      │   ├── admin.json         # User management, audit logs, fleet management
      │   └── tracking.json      # Live tracking, delays, bus sidebar
      └── en/
          └── [same 9 files]
  ```
- [ ] Each namespace is lazy-loaded (only fetched when the component using it renders)
- [ ] `I18nextProvider` wraps the app in `root-layout.tsx`
- [ ] Language persisted in `localStorage` key `i18n_lang`
- [ ] `npm run build` succeeds — translation JSON files included in bundle
- [ ] Unit test: i18n initializes with `ro` default
- [ ] Typecheck passes, lint clean

### TASK-008: Create language switcher component
**Description:** Add a language toggle to the navbar that allows switching between RO and EN. Switching languages should update all visible text immediately without page reload.

**Acceptance Criteria:**
- [ ] Create `src/components/layout/language-switcher.tsx` — dropdown or toggle button (RO / EN)
- [ ] Shows current language with flag emoji or label (🇷🇴 RO / 🇬🇧 EN)
- [ ] Calls `i18n.changeLanguage()` on selection
- [ ] Language change persists in `localStorage` and survives page refresh
- [ ] Integrated into `navbar.tsx` (desktop) and `navbar-mobile.tsx` (mobile menu)
- [ ] Component test: renders, switches language, persists choice
- [ ] Typecheck passes, lint clean

### TASK-009: Translate common namespace
**Description:** Extract all shared UI strings into `common.json` for both RO and EN. This covers buttons, loading states, error states, empty states, pagination, confirmation dialogs, and toast messages used across multiple domains.

**Acceptance Criteria:**
- [ ] `common.json` keys include: `buttons.save`, `buttons.cancel`, `buttons.delete`, `buttons.edit`, `buttons.create`, `buttons.retry`, `buttons.back`, `buttons.confirm`, `buttons.close`, `buttons.search`, `buttons.submit`
- [ ] Loading: `loading.generic`, `loading.saving`, `loading.deleting`
- [ ] Errors: `errors.generic`, `errors.network`, `errors.notFound`, `errors.forbidden`, `errors.serverError`, `errors.validation`
- [ ] Empty states: `empty.noResults`, `empty.noData`
- [ ] Pagination: `pagination.page`, `pagination.of`, `pagination.next`, `pagination.previous`, `pagination.showing`
- [ ] Toasts: `toast.success`, `toast.error`, `toast.saved`, `toast.deleted`, `toast.created`
- [ ] All shared components (`error-state.tsx`, `empty-state.tsx`, `loading-skeleton.tsx`) updated to use `useTranslation('common')`
- [ ] Both `ro/common.json` and `en/common.json` complete
- [ ] Typecheck passes, lint clean

### TASK-010: Translate nav namespace
**Description:** Extract all navigation labels into `nav.json`. This includes navbar links, mobile menu, user menu items, and the skip-to-content link.

**Acceptance Criteria:**
- [ ] `nav.json` keys include: `links.home`, `links.search`, `links.myTrips`, `links.dashboard`, `links.routes`, `links.fleet`, `links.schedules`, `links.drivers`, `links.tracking`, `links.trips`, `links.history`, `links.users`, `links.auditLogs`, `links.profile`
- [ ] User menu: `menu.logout`, `menu.profile`, `menu.changePassword`
- [ ] Accessibility: `a11y.skipToContent`, `a11y.openMenu`, `a11y.closeMenu`, `a11y.mainNavigation`
- [ ] `navbar-links.ts` updated to use translation keys instead of hardcoded strings
- [ ] `navbar.tsx`, `navbar-mobile.tsx`, `app-layout.tsx` updated to use `useTranslation('nav')`
- [ ] Both `ro/nav.json` and `en/nav.json` complete
- [ ] Typecheck passes, lint clean

### TASK-011: Translate auth namespace
**Description:** Extract all authentication-related strings into `auth.json`. Covers login, register, forgot password, reset password, change password pages and their forms.

**Acceptance Criteria:**
- [ ] `auth.json` keys cover: form labels, placeholders, validation messages, page titles, submit buttons, links ("Don't have an account?", "Forgot password?"), success/error messages, role selection labels
- [ ] Password strength indicator labels translated
- [ ] Account status messages: locked, suspended
- [ ] All auth pages (`login.tsx`, `register.tsx`, `forgot-password.tsx`, `reset-password.tsx`, `change-password.tsx`) updated to use `useTranslation('auth')`
- [ ] Both `ro/auth.json` and `en/auth.json` complete
- [ ] Typecheck passes, lint clean

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
