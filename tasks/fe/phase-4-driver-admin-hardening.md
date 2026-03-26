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

### TASK-003: Create driver trip detail page
**Description:** Create `src/pages/driver/trip/[id].tsx`. Displays: route info, live map with route + current position, stop progress tracker (list of stops with check marks for passed stops). Features: "Start Sharing Location" toggle (uses `navigator.geolocation.watchPosition`), posts GPS to `POST /api/v1/tracking` every 5 seconds. Stop progress: manual "Arrived at stop" button increments currentStopIndex. Passenger list (from bookings). "Report Delay" button navigates to delay form.

**Acceptance Criteria:**
- [ ] Live map showing route and current position
- [ ] Location sharing toggle using browser geolocation API
- [ ] GPS posted to tracking endpoint every 5s when sharing
- [ ] Stop progress tracker with manual advance button
- [ ] Passenger list from bookings
- [ ] Report delay button
- [ ] Cleanup: stops GPS posting on unmount / toggle off
- [ ] Geolocation permission handling (request, denied state)
- [ ] Mobile-optimized layout
- [ ] Component test
- [ ] Typecheck passes

### TASK-004: Create delay reporting page
**Description:** Create `src/pages/driver/delay.tsx`. Form: preset delay buttons (5, 10, 15, 20, 30, 45, 60 min), custom input for other values. Reason dropdown (Traffic, Mechanical, Weather, Other). Optional notes. Submit calls `useCreateDelay`. Redirects back to trip detail on success.

**Acceptance Criteria:**
- [ ] Preset delay buttons for quick selection
- [ ] Custom minutes input
- [ ] Reason dropdown with all DelayReason options
- [ ] Notes textarea (optional)
- [ ] Zod validation
- [ ] Submit + redirect on success
- [ ] Toast notification
- [ ] Component test
- [ ] Typecheck passes

---

## Admin Features

### TASK-005: Create admin hooks
**Description:** Create `src/hooks/use-admin.ts`: `useAdminBuses(pagination)` — all buses across providers. `useToggleSeat()` — mutation to enable/disable seat.

**Acceptance Criteria:**
- [ ] Typed from OpenAPI spec
- [ ] Toggle mutation invalidates bus detail query
- [ ] JSDoc
- [ ] Typecheck passes

### TASK-006: Create admin fleet page
**Description:** Create `src/pages/admin/fleet.tsx`. List all buses from all providers (grouped by provider). For each bus: show provider name, bus info, seat map in view mode with enable/disable toggles per seat. Click seat toggles enabled state via API. Visual indicator for disabled seats.

**Acceptance Criteria:**
- [ ] Buses grouped by provider
- [ ] Seat map with enable/disable toggle per seat
- [ ] Disabled seats visually distinct
- [ ] Toggle calls API immediately (optimistic update)
- [ ] Pagination
- [ ] Loading/error states
- [ ] Component test
- [ ] Typecheck passes

---

## Error Handling & Resilience

### TASK-007: Create error boundary components
**Description:** Create `src/components/error/error-boundary.tsx` (React error boundary wrapping pages, shows friendly error UI with retry). Create `src/components/error/not-found.tsx` (404 page). Create `src/components/error/error-fallback.tsx` (generic error display with retry button). Add error boundaries at route level in router.tsx.

**Acceptance Criteria:**
- [ ] Error boundary catches render errors, shows fallback UI
- [ ] Fallback includes error message + retry button
- [ ] 404 page for unknown routes
- [ ] Error boundaries at page level (one page crash doesn't break app)
- [ ] Component test for error boundary
- [ ] Typecheck passes

### TASK-008: Add loading states and empty states consistency
**Description:** Audit all pages for consistent UX patterns: loading (skeleton screens, not spinners), empty state (illustration + message + action CTA), error state (message + retry). Create reusable components: `src/components/shared/loading-skeleton.tsx`, `src/components/shared/empty-state.tsx`, `src/components/shared/error-state.tsx`.

**Acceptance Criteria:**
- [ ] Reusable skeleton, empty state, error state components
- [ ] All pages use consistent loading patterns (skeletons)
- [ ] All pages have empty states with actionable CTAs
- [ ] All pages have error states with retry
- [ ] JSDoc on components
- [ ] Typecheck passes

---

## Accessibility Audit

### TASK-009: WCAG 2.1 AA compliance audit
**Description:** Audit all components and pages for accessibility:
- Semantic HTML (headings hierarchy, landmarks, lists)
- All interactive elements have labels (aria-label or visible label)
- Keyboard navigation (tab order, focus management, skip-to-content)
- Color contrast ≥ 4.5:1 (check dark theme)
- Focus visible styles on all interactive elements
- Screen reader announcements for dynamic content (aria-live regions for tracking updates, toast notifications)
- Form error association (aria-describedby linking errors to fields)

Fix all issues found.

**Acceptance Criteria:**
- [ ] All pages pass axe-core audit (zero critical/serious violations)
- [ ] Keyboard navigation works on all interactive components
- [ ] Focus management on modals/dialogs (trap focus, return focus on close)
- [ ] Skip-to-content link on app layout
- [ ] Color contrast verified on dark theme
- [ ] Screen reader tested (at minimum: VoiceOver macOS)
- [ ] Typecheck passes

---

## Performance

### TASK-010: Optimize bundle and rendering
**Description:** Review and optimize:
- All pages use React.lazy + Suspense (code splitting per route)
- React.memo on expensive components (SeatMap, LiveMap, TripCard list)
- useCallback/useMemo where render cost is measurable
- Image optimization (if any images, use lazy loading)
- No unnecessary re-renders from polling (use refs for non-visual state)
- Bundle analysis: ensure no large libraries loaded unnecessarily

**Acceptance Criteria:**
- [ ] All routes lazy-loaded
- [ ] SeatMap and LiveMap memoized
- [ ] Polling doesn't cause full-page re-renders
- [ ] Bundle size < 500KB gzipped (excluding leaflet)
- [ ] No unused imports or dead code
- [ ] Typecheck passes

### TASK-011: Optimize API calls
**Description:** Review all React Query usage:
- Proper staleTime per query type (search: 30s, lists: 60s, details: 30s, tracking: 5s)
- No duplicate queries (shared query keys)
- Request deduplication (React Query handles this, verify no manual fetch())
- Abort unnecessary requests on unmount (React Query handles, verify)
- No raw `fetch()` calls — all through typed API client

**Acceptance Criteria:**
- [ ] All queries have appropriate staleTime
- [ ] No duplicate queries on same page
- [ ] No raw fetch() calls in components
- [ ] Tracking polling stops when page unmounts
- [ ] Typecheck passes

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
