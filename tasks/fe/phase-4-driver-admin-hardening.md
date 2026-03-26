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

### TASK-012: XSS prevention audit ✅
- [x] Zero dangerouslySetInnerHTML, sanitizeUrl() helper with 17 tests, Leaflet uses React <Popup>, toasts use Radix plain text, no dynamic href/src bindings, no user input in style attrs, typecheck passes

### TASK-013: Subresource Integrity for CDN assets ✅
- [x] Leaflet CSS bundled locally via `import 'leaflet/dist/leaflet.css'` (no CDN), zero CDN link/script tags in index.html, only external URL is CartoDB tile server (dynamic runtime tiles, not SRI-eligible), typecheck passes

### TASK-014: Secure token and sensitive data handling ✅
- [x] Access token in memory only, 403/423 middleware callback for auth cleanup, password fields cleared on unmount (login/register/change-password/reset-password), autocomplete="new-password" on creation fields, 5 new auth cleanup tests, 1102 tests pass, typecheck passes

### TASK-015: OpenAPI spec conformance validation for frontend ✅
- [x] `npm run api:check` detects calls to endpoints not in spec, detects stale types, lists coverage report, exits with error/warning codes, 6 tests, typecheck passes

---

## Final Quality Gates

### TASK-016: Comprehensive frontend quality and security audit ✅
- [x] All 19 checks pass (typecheck, lint, format, test, coverage ≥90%, build, api:check, zero any/dangerouslySetInnerHTML/console.log/raw fetch, access token in memory, SRI N/A no CDN, JSDoc on exports, axe-core clean, error boundaries, skeletons), coverage reviewed (96.48% stmts, 90% branches, 97.5% funcs, 97.51% lines), bundle 258KB gzipped excl. Leaflet (< 500KB target), 1113 tests pass, typecheck passes

---

## QA Audit — Batch 1

**Run date**: 2026-03-26
**Coverage**: 96.48% stmts | 90% branches | 97.5% funcs | 97.51% lines (1119 tests)
**Type safety**: Zero `: any` / `as any` in production code
**Accessibility**: Zero WCAG 2.1 AA violations (axe-core clean, semantic HTML, aria-labels, skip-to-content)
**Lint**: 0 errors, 1 warning (React Hook Form + React Compiler incompatibility — not actionable)
**Typecheck**: Clean

### Complexity

#### US-QA-001: Refactor `pages/driver/trip-detail.tsx` (610 lines, limit 500)
- **Priority**: P3 (Complexity)
- **AC-1**: Extract `useGpsPosting` hook into a separate `hooks/use-gps-posting.ts` file
- **AC-2**: File is under 500 lines after extraction

### Coverage — Branch Gaps

#### US-QA-002: Improve branch coverage for `pages/driver/trip-detail.tsx` (79.31% branches)
- **Priority**: P3 (Coverage)
- **AC-1**: Add tests covering uncovered branches at lines 219-220, 269-270, 319-320, 407-423 (GPS error paths, geolocation denial, stop completion edge cases)
- **AC-2**: Branch coverage reaches ≥90%

#### US-QA-003: Improve branch coverage for `contexts/auth-context.tsx` (75% branches)
- **Priority**: P3 (Coverage)
- **AC-1**: Add tests for uncovered branches at lines 108, 200-201, 210 (refresh token failure, concurrent refresh race, 403/423 middleware callback paths)
- **AC-2**: Branch coverage reaches ≥90%

#### US-QA-004: Improve branch coverage for `pages/provider/schedules.tsx` (78.57% branches)
- **Priority**: P3 (Coverage)
- **AC-1**: Add tests for uncovered branches at lines 265, 491-492 (filter edge cases, pagination boundary, empty schedule list with active filters)
- **AC-2**: Branch coverage reaches ≥90%

#### US-QA-005: Improve branch coverage for `pages/driver/trip-detail.tsx` function coverage (88.57%)
- **Priority**: P3 (Coverage)
- **AC-1**: Add tests for uncovered functions (GPS cleanup callback, watchPosition error handler, location sharing toggle off)
- **AC-2**: Function coverage reaches ≥95%

#### US-QA-006: Improve branch coverage for `pages/provider/routes.tsx` (86.11% branches)
- **Priority**: P3 (Coverage)
- **AC-1**: Add tests for uncovered branches at lines 205-206, 305-306, 315-316 (route creation validation errors, stops builder edge cases, delete confirmation)
- **AC-2**: Branch coverage reaches ≥90%

#### US-QA-007: Improve branch coverage for `pages/provider/fleet.tsx` (90% branches, 77.77% funcs)
- **Priority**: P3 (Coverage)
- **AC-1**: Add tests for uncovered functions at lines 65, 209 (bus template selection handler, pagination handler)
- **AC-2**: Function coverage reaches ≥90%
