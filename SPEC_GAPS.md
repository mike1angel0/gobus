# OpenAPI Spec Gaps

## GET /api/v1/tracking (provider list endpoint)
- **Issue**: No endpoint to list all tracking data for a provider's buses in a single request. Currently must call `GET /api/v1/tracking/{busId}` individually per bus.
- **Found by**: FE Phase 3, TASK-001
- **Suggested fix**: Add `GET /api/v1/tracking` with provider auth that returns all active bus positions for the authenticated provider's fleet.
- **Blocking**: No — FE works around this by making parallel per-bus requests in `useProviderTracking()`.
