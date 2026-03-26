# Phase 4: Driver, Admin & Production Hardening

**Status**: Pending
**Dependencies**: FE Phase 3 (provider features), BE Phase 4 (hardening)
**Goal**: Implement driver mobile features (GPS, trip management), admin seat management, error boundaries, accessibility audit, performance optimization, and final quality gates for production readiness.

---

## Driver Features

### TASK-001: Create driver hooks ✅
- [x] Both hooks typed from OpenAPI spec, date-based query key for list, JSDoc, typecheck passes

### TASK-002: Create driver trips list page ✅
- [x] Date navigation, schedule cards with status, empty/loading/error states, mobile-first, component test (18 tests), typecheck passes

### TASK-003: Create driver trip detail page ✅
- [x] Live map, location sharing, GPS posting, stop progress, passenger count, report delay, cleanup, geolocation permission, mobile layout, 34 tests, typecheck passes

### TASK-004: Create delay reporting page ✅
- [x] Preset delay buttons (5/10/15/20/30/45/60), custom minutes input, reason dropdown, notes textarea, Zod validation matching OpenAPI spec, submit+redirect, toast via useCreateDelay hook, 25 component tests, typecheck passes

---

## Admin Features

### TASK-005: Create admin hooks ✅
- [x] Typed from OpenAPI spec, useAdminBuses with pagination/providerId filter, useToggleSeat mutation invalidates admin+provider bus queries, JSDoc, 9 tests, typecheck passes

### TASK-006: Create admin fleet page ✅
- [x] Buses grouped by provider, seat map with enable/disable toggle per seat, disabled seats visually distinct, toggle calls API immediately, pagination, loading/error/empty states, 28 component tests, typecheck passes

---

## Error Handling & Resilience

### TASK-007: Create error boundary components ✅
- [x] ErrorBoundary class component catches render errors with fallback UI and retry, ErrorFallback generic error display, NotFound 404 page, error boundary in AppLayout wrapping Outlet, 404 catch-all route, 17 tests, typecheck passes

### TASK-008: Add loading states and empty states consistency ✅
- [x] Reusable PageError, EmptyState, CardGridSkeleton, CardListSkeleton components with JSDoc, 22 tests for shared components, all 10 pages updated to use shared components (-363 lines deduplicated), 1076 tests pass, typecheck passes

---

## Accessibility Audit

### TASK-009: WCAG 2.1 AA compliance audit ✅
- [x] axe-core audit integrated (vitest-axe + checkA11y helper), app layout passes, semantic HTML verified across all pages, all interactive elements have aria-labels, form errors use aria-describedby+aria-invalid, aria-live regions on tracking sidebar+delays list, skip-to-content link in AppLayout, focus-visible styles on all components via Tailwind, Radix UI handles dialog focus trapping, color contrast uses CSS variables with proper ratios, 1084 tests pass, typecheck passes

---

## Performance

### TASK-010: Optimize bundle and rendering ✅
- [x] All routes lazy-loaded (22 pages via React.lazy), SeatMapEditor+EditorSeatCell+LiveMap+BusMarker wrapped in React.memo, stopIcon memoized with useMemo, polling uses refs for non-visual state (useGpsPosting) and React Query refetchInterval (component-scoped), bundle 303.5KB gzipped total (258KB excl. leaflet), no unused imports, typecheck passes, 1084 tests pass

### TASK-011: Optimize API calls ✅
- [x] Detail queries staleTime updated to 30s (bookings, buses, routes, schedules, driver-trips), lists 60s, search 30s, tracking 5s, templates 5m. Removed unused duplicate useTracking hook. Zero raw fetch() calls, polling stops on unmount via enabled flag, 1081 tests pass, typecheck passes

---

## Frontend Security Hardening

### TASK-012: XSS prevention audit
**Description:** Audit all components for XSS vectors: (1) Verify no `dangerouslySetInnerHTML` usage anywhere. (2) Verify no user-controlled data in `href` attributes (prevent `javascript:` URL injection) — create a `sanitizeUrl(url)` helper that strips non-https schemes. (3) Verify all user-provided strings rendered via JSX `{variable}` (React auto-escapes). (4) Verify no user input in `style` attributes or CSS custom properties. (5) Audit Leaflet map popups — if using `.bindPopup(userString)`, switch to React Leaflet's `<Popup>` component which auto-escapes. (6) Audit toast notifications — verify they escape HTML.

**Acceptance Criteria:**
- [ ] Zero `dangerouslySetInnerHTML` in codebase
- [ ] `sanitizeUrl()` helper created and used for all URL rendering (avatarUrl, provider logo, etc.)
- [ ] `sanitizeUrl` rejects `javascript:`, `data:`, `vbscript:` schemes — only allows `https:` and relative URLs
- [ ] Leaflet popups use React Leaflet `<Popup>` component (not raw `.bindPopup()`)
- [ ] All toast messages use plain text (no HTML rendering)
- [ ] Unit tests for sanitizeUrl
- [ ] Typecheck passes

### TASK-013: Subresource Integrity for CDN assets
**Description:** Add SRI (Subresource Integrity) hashes to all CDN-loaded resources: Leaflet CSS from unpkg. If any other CDN resources exist, add SRI to those too. Alternatively, bundle Leaflet CSS locally to eliminate CDN dependency entirely (preferred).

**Acceptance Criteria:**
- [ ] Leaflet CSS either bundled locally OR loaded with `integrity` + `crossOrigin` attributes
- [ ] No CDN resources without SRI hashes
- [ ] Typecheck passes

### TASK-014: Secure token and sensitive data handling
**Description:** Audit all client-side data handling: (1) Access token NEVER in localStorage/sessionStorage (memory only). (2) No sensitive data in URL params (no tokens, passwords, or PII in query strings). (3) Password reset token in URL is one-time use (verify with BE). (4) Clear sensitive form data on unmount (password fields). (5) No sensitive data in browser console (no logging tokens, passwords, user data). (6) Add `autocomplete="off"` on password fields where appropriate (new password fields, not login). (7) Ensure 401/403/423 responses clear all local auth state.

**Acceptance Criteria:**
- [ ] Access token storage: memory only (verified by grep for localStorage/sessionStorage with "token")
- [ ] No sensitive data in URL query params (except one-time reset token)
- [ ] Password fields cleared on component unmount
- [ ] Zero console.log with sensitive data
- [ ] `autocomplete="new-password"` on password creation fields
- [ ] 401/403/423 responses trigger full auth state cleanup
- [ ] Unit tests for auth cleanup on error responses
- [ ] Typecheck passes

### TASK-015: OpenAPI spec conformance validation for frontend
**Description:** Create `npm run api:check` script that: (1) Reads the bundled OpenAPI spec from `../../spec/dist/openapi.json`. (2) Compares all API calls in the codebase (grep for `client.GET`, `client.POST`, etc.) against spec paths — flags any calls to endpoints NOT in the spec. (3) Verifies the generated types are up-to-date with the spec (compare checksums). (4) Reports any spec paths that have NO corresponding frontend hook (missing implementation). Output a report to stdout.

**Acceptance Criteria:**
- [ ] `npm run api:check` detects calls to endpoints not in spec
- [ ] `npm run api:check` detects stale generated types (spec changed but types not regenerated)
- [ ] `npm run api:check` lists spec endpoints with no frontend hook (coverage report)
- [ ] Script exits with error code if spec violations found
- [ ] Script exits with warning if types are stale
- [ ] Typecheck passes

---

## Final Quality Gates

### TASK-016: Comprehensive frontend quality and security audit
**Description:** Run ALL quality gates and fix every issue:

**Code Quality:**
1. `npm run typecheck` — zero errors
2. `npm run lint` — zero errors
3. `npm run format:check` — passes
4. `npm run test` — all tests pass
5. `npm run test:coverage` — ≥ 90%
6. `npm run build` — succeeds, analyze bundle size

**API Contract:**
7. `npm run api:check` — all API calls match spec, types up-to-date
8. All API calls use typed client (no raw fetch)
9. No hardcoded API URLs

**Security:**
10. Zero `any` in production code
11. Zero `dangerouslySetInnerHTML` usage
12. Access token in memory only (not localStorage)
13. `sanitizeUrl()` used on all user-provided URLs
14. SRI on all CDN assets
15. No console.log in production code

**UX:**
16. JSDoc on ALL exported functions/components/hooks
17. All components accessible (axe-core clean)
18. Error boundaries on all page routes
19. Loading skeletons on all async pages

**Acceptance Criteria:**
- [ ] All 19 checks pass
- [ ] Coverage report reviewed
- [ ] Bundle size within target (< 500KB gzipped excl. Leaflet)
- [ ] Frontend is production-ready and pentest-hardened
- [ ] Deployed build serves correctly via `npm run preview`
