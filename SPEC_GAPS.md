# OpenAPI Spec Gaps

## GET /api/v1/tracking (provider list endpoint)
- **Issue**: No endpoint to list all tracking data for a provider's buses in a single request. Currently must call `GET /api/v1/tracking/{busId}` individually per bus.
- **Found by**: FE Phase 3, TASK-001
- **Suggested fix**: Add `GET /api/v1/tracking` with provider auth that returns all active bus positions for the authenticated provider's fleet.
- **Blocking**: No — FE works around this by making parallel per-bus requests in `useProviderTracking()`.

## GET /api/v1/provider/analytics (dashboard analytics)
- **Issue**: No analytics/dashboard endpoint for providers. The PRD calls for total bookings, total revenue, average occupancy %, and revenue by route — but no API endpoint exists to serve aggregated analytics data.
- **Found by**: FE Phase 3, TASK-002
- **Suggested fix**: Add `GET /api/v1/provider/analytics` returning `{ totalBookings, totalRevenue, averageOccupancy, revenueByRoute: { routeId, routeName, revenue }[] }`.
- **Blocking**: No — FE dashboard shows stat counts (routes, buses, drivers, active schedules) from existing list endpoints. Revenue chart and occupancy stats are deferred until analytics endpoint exists.

## PUT /api/v1/buses/{id} (seat layout update)
- **Issue**: The `UpdateBusRequest` schema only accepts `licensePlate`, `model`, and `capacity` fields. There is no way to update individual seat types (e.g., changing a seat from STANDARD to PREMIUM) on an existing bus. The seat map editor UI is built but cannot persist seat type changes.
- **Found by**: FE Phase 3, TASK-005
- **Suggested fix**: Either extend `UpdateBusRequest` to accept an optional `seats: CreateSeatInput[]` field, or add a dedicated `PUT /api/v1/buses/{id}/seats` endpoint that accepts a full seat layout replacement.
- **Blocking**: No — FE seat map editor works with local state and shows a toast notification. When the spec is updated, the save handler in `EditBusDialog` can be wired to the API.
