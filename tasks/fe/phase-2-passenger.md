# Phase 2: Passenger Features — Search, Trip Details, Bookings

**Status**: Pending
**Dependencies**: FE Phase 1 (scaffold, API client, auth, shell), BE Phase 3 (search, booking, tracking endpoints)
**Goal**: Implement all passenger-facing features: trip search, trip detail with interactive seat selection, booking creation, and booking management. All API calls use the typed client generated from the OpenAPI spec.

---

## React Query Hooks

### ~~TASK-001: Create search hooks~~ ✅

### ~~TASK-002: Create booking hooks~~ ✅

---

## Search & Results

### TASK-003: Create SearchForm component
**Description:** Create `src/components/search/search-form.tsx`. City dropdown for origin and destination (15 European cities). Date picker. Swap button to swap origin/destination. Compact and full layout modes. On submit, navigates to `/search?origin=X&destination=Y&date=Z` with query params.

**Acceptance Criteria:**
- [ ] City dropdowns with all 15 cities
- [ ] Date picker (defaults to today, min: today)
- [ ] Swap button swaps origin/destination
- [ ] Form validation: origin ≠ destination, both required
- [ ] Navigates to search page with query params
- [ ] Compact mode for home page, full mode for search page
- [ ] Accessible: labels, keyboard navigation
- [ ] Component test
- [ ] Typecheck passes

### TASK-004: Create TripCard component
**Description:** Create `src/components/search/trip-card.tsx`. Displays: provider logo + name, departure/arrival times, route name, duration, price, available seats count, delay badge (if active delay). Expandable section showing stop list with times. Link to trip detail page.

**Acceptance Criteria:**
- [ ] All trip info displayed clearly
- [ ] Delay badge shows when delay active (color-coded by severity)
- [ ] Expandable stops section with stop names and times
- [ ] Available seats count with visual indicator
- [ ] Click navigates to `/trip/{scheduleId}?date=X`
- [ ] Responsive layout
- [ ] Accessible
- [ ] Component test
- [ ] Typecheck passes

### TASK-005: Create search results page
**Description:** Create `src/pages/search.tsx`. Reads query params (origin, destination, date). Uses `useSearchTrips` hook. Shows: search form (compact, pre-filled), results list with TripCard components, empty state ("No trips found"), loading skeleton, error state with retry.

**Acceptance Criteria:**
- [ ] Reads query params and fetches results
- [ ] Loading: skeleton cards (not spinner)
- [ ] Empty state: illustration + message + modify search CTA
- [ ] Error state: message + retry button
- [ ] Results list with TripCard for each result
- [ ] Auto-refetch on query param changes
- [ ] Component test (loading, empty, error, results states)
- [ ] Typecheck passes

---

## Trip Detail & Seat Selection

### TASK-006: Create SeatMap component
**Description:** Create `src/components/booking/seat-map.tsx`. Interactive grid layout based on bus rows/columns. Seat states: available (clickable), selected (highlighted), occupied (greyed, not clickable), blocked (X mark), disabled (⊘ mark), premium (gold border). Aisle gap between columns (configurable, default after col 2 for 4-column buses). Click to select/deselect. Legend showing all seat types. Shows seat label, type, and price on hover/focus (tooltip or aria-label).

**Acceptance Criteria:**
- [ ] Grid renders correctly for any rows/columns configuration
- [ ] All seat states rendered with distinct visual styles
- [ ] Click toggles selection (available seats only)
- [ ] Occupied/blocked/disabled seats not selectable
- [ ] Selected seats tracked and reported to parent via callback
- [ ] Aisle gap rendering
- [ ] Legend component showing all types
- [ ] Tooltip with seat label + type + price
- [ ] Accessible: keyboard navigable (arrow keys), aria-label per seat, role="grid"
- [ ] Component test for all states
- [ ] Typecheck passes

### TASK-007: Create DelayBadge component
**Description:** Create `src/components/shared/delay-badge.tsx`. Color-coded: on-time (green "On Time"), minor ≤15min (yellow "Delayed Xmin"), major >15min (red "Delayed Xmin"). Shows reason if provided. Size variants (sm/md).

**Acceptance Criteria:**
- [ ] Color coding by severity
- [ ] Shows delay minutes + optional reason
- [ ] Size variants
- [ ] Accessible (aria-label for screen readers)
- [ ] Component test
- [ ] Typecheck passes

### TASK-008: Create trip detail page
**Description:** Create `src/pages/trip/[id].tsx`. Uses `useTripDetails` hook. Displays: provider info, route name, departure/arrival times, stop list with times and segment prices, delay badge, live map (if tracking active), seat map for selection. Booking form: select boarding/alighting stops from dropdowns (filtered by route order), select seats from seat map, shows computed price (segment-based), submit button. On submit: calls `useCreateBooking`, redirects to /my-trips on success.

**Acceptance Criteria:**
- [ ] Full trip info displayed matching API response
- [ ] Seat map shows availability for selected tripDate
- [ ] Boarding/alighting stop dropdowns (boarding must be before alighting)
- [ ] Price computed from segment pricing on stop selection
- [ ] Submit creates booking via API
- [ ] 409 conflict shows "Seats already taken" error with option to refresh
- [ ] Loading/error states
- [ ] Component test for booking flow
- [ ] Typecheck passes

---

## Live Map

### TASK-009: Create LiveMap component
**Description:** Create `src/components/maps/live-map.tsx`. Uses `react-leaflet` with dark CartoDB tiles. Shows: route polyline between stops, stop markers with labels, bus position marker (if tracking active). Auto-fits bounds. Updates bus position without full re-render (via useRef for map instance). Configurable center/zoom fallback.

**Acceptance Criteria:**
- [ ] Dark tile theme
- [ ] Route polyline rendered from stop coordinates
- [ ] Stop markers with popup labels
- [ ] Bus marker updates position smoothly
- [ ] Auto-fit bounds to show all markers
- [ ] No full re-render on position update
- [ ] Component test (renders without error)
- [ ] Typecheck passes

---

## Booking Management

### TASK-010: Create my-trips page
**Description:** Create `src/pages/my-trips.tsx`. Uses `useBookings` hook (paginated). Tab split: Upcoming (CONFIRMED, future tripDate) and Past (COMPLETED or past tripDate). Each booking shows: route name, date, times, seats, price, status badge, delay info. Expandable detail: stop list, live tracking map (if active). Cancel button on upcoming bookings (with confirmation dialog).

**Acceptance Criteria:**
- [ ] Upcoming/Past tab split
- [ ] Booking cards with all info
- [ ] Expandable detail section
- [ ] Live map for active trips with tracking
- [ ] Cancel button with confirmation dialog
- [ ] Cancel calls API and invalidates queries
- [ ] Pagination (load more or page numbers)
- [ ] Loading skeleton, empty state ("No trips yet"), error state
- [ ] Component test
- [ ] Typecheck passes

---

## Quality Gates

### TASK-011: Run Phase 2 quality gates
**Description:** Run and fix all checks.

**Acceptance Criteria:**
- [ ] `npm run typecheck` — zero errors
- [ ] `npm run lint` — zero errors
- [ ] `npm run format:check` — passes
- [ ] `npm run test` — all pass
- [ ] `npm run test:coverage` ≥ 90%
- [ ] `npm run build` — succeeds
- [ ] Zero `any` in src/ (excluding test/)
- [ ] JSDoc on all exported functions/components/hooks
- [ ] All components accessible (WCAG 2.1 AA)
- [ ] All API calls use typed client (no raw fetch)
