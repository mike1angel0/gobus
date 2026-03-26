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

## DriverTripDetail schema (busId missing)
- **Issue**: `DriverTripDetail` schema does not include `busId`. The driver trip detail page needs `busId` to post GPS tracking data via `POST /api/v1/tracking` (which requires `busId` in `TrackingUpdate`).
- **Found by**: FE Phase 4, TASK-003
- **Suggested fix**: Add `busId: string` field to the `DriverTripDetail` schema in the OpenAPI spec.
- **Blocking**: No — FE implements GPS posting but disables the feature when `busId` is unavailable. When the spec is fixed, tracking will work automatically.

## StopTime schema (missing coordinates)
- **Issue**: `StopTime` schema does not include `lat`/`lng` coordinates. The driver trip detail page needs stop coordinates to display the route on the map via `LiveMap` component.
- **Found by**: FE Phase 4, TASK-003
- **Suggested fix**: Add `lat: number (format: double)` and `lng: number (format: double)` fields to the `StopTime` schema.
- **Blocking**: No — FE shows the map with bus position only. When coordinates are added, the route polyline and stop markers will render automatically.

## DriverTripDetail (no passenger list)
- **Issue**: `DriverTripDetail` only provides `passengerCount` and `totalSeats`, not individual passenger/booking data. The PRD requests "Passenger list (from bookings)".
- **Found by**: FE Phase 4, TASK-003
- **Suggested fix**: Either add a `passengers: { name, seatLabel, bookingId }[]` field to `DriverTripDetail`, or add a `GET /api/v1/driver/trips/{scheduleId}/passengers` endpoint.
- **Blocking**: No — FE shows passenger count summary. When individual passenger data becomes available, it can be displayed as a list.
