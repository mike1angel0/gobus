# OpenAPI Spec Gaps

## GET /api/v1/admin/schedules (missing)
- **Issue**: No admin endpoint to list/count schedules across all providers. The admin dashboard PRD requires "total active schedules" stat card, but there's no admin schedules endpoint.
- **Found by**: FE Phase 5, TASK-006
- **Suggested fix**: Add `GET /api/v1/admin/schedules` with pagination and status filter (matching existing provider schedules endpoint pattern), or add a `GET /api/v1/admin/stats` summary endpoint.
- **Blocking**: No — FE dashboard shows audit events count instead of schedules. Can be updated when endpoint is added.
