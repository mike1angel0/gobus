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

---

## QA Batch 1 — Quality Analysis

**Coverage:** 95.74% (target 90%) — PASS
**Type Safety:** Zero `any` types — PASS
**JSDoc:** All Phase 6 exports documented — PASS
**Complexity:** No Phase 6 files exceed limits — PASS
**Lint:** Zero errors (2 warnings from prior phases) — PASS

### US-QA-001: Fix a11y: `<html lang>` not updated on language switch (WCAG 3.1.1)
**Priority:** High
**Description:** `index.html` has `<html lang="en">` hardcoded. When the user switches to Romanian via the LanguageSwitcher, the `lang` attribute is never updated. This violates WCAG 3.1.1 (Language of Page, Level A) and causes screen readers to announce Romanian text with English pronunciation.

**Acceptance Criteria:**
- [ ] Add a `languageChanged` listener (in `i18n/config.ts` or `root-layout.tsx`) that sets `document.documentElement.lang` to the current i18n language
- [ ] Set `<html lang="ro">` in `index.html` to match the default `fallbackLng: 'ro'`

### US-QA-002: Fix i18n: Hardcoded "Menu" string in navbar-mobile.tsx
**Priority:** High
**Description:** `navbar-mobile.tsx:85` contains `<span className="text-sm text-muted-foreground">Menu</span>` — a visible English label that is not passed through `t()`. This was missed during TASK-010 (nav namespace translation). The string will always render in English regardless of language setting.

**Acceptance Criteria:**
- [ ] Replace hardcoded `"Menu"` with `t('menu.title')` or equivalent nav namespace key
- [ ] Add the corresponding key to both `en/nav.json` and `ro/nav.json` translation files

### US-QA-003: Fix i18n: Replace hardcoded usePageTitle strings with t() calls
**Priority:** Medium
**Description:** Three pages pass hardcoded English strings to `usePageTitle()` instead of using `t()`, so their page titles do not change when the user switches language.

**Affected files:**
- `src/pages/home.tsx:10` — `usePageTitle('Home')`
- `src/pages/profile.tsx:44` — `usePageTitle('Profile')`
- `src/pages/placeholder.tsx:8` — `usePageTitle('Coming Soon')`

**Acceptance Criteria:**
- [ ] Replace all three hardcoded strings with `t()` calls using appropriate namespace keys
- [ ] Add corresponding keys to both `en` and `ro` translation files

### US-QA-004: Fix a11y: Improve LanguageSwitcher aria-label to include current language
**Priority:** Low
**Description:** The LanguageSwitcher button's `aria-label` says `"Switch language to EN"` but does not indicate the current language. A more descriptive label like `"Current language: Romanian. Switch to English"` better satisfies WCAG 4.1.2 (Name, Role, Value).

**Acceptance Criteria:**
- [ ] Update aria-label to include both current and target language (e.g. `"Language: {current}. Switch to {target}"`)
- [ ] Add the aria-label pattern as a translatable i18n key in both `en` and `ro` nav translation files
