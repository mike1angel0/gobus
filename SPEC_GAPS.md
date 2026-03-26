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
