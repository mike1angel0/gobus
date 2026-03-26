# OpenAPI Spec Gaps

This file is automatically populated by the FE ralph script when it detects issues in the OpenAPI spec.
The BE ralph script reads this file at the start of each iteration and fixes blocking gaps before continuing.

Format:
```
## [endpoint or schema name]
- **Issue**: [what's missing or wrong]
- **Found by**: FE Phase [N], TASK-[NNN]
- **Suggested fix**: [what the spec should say]
- **Blocking**: [yes/no]
```

---

## SearchResult schema
- **Issue**: Missing `activeDelay` field (delay minutes + reason) for displaying delay badges on search result cards. Also missing `stopTimes` array for expandable stop list in TripCard. Currently this data is only available via the separate `/api/v1/delays` and `/api/v1/trips/{scheduleId}` endpoints.
- **Found by**: FE Phase 2, TASK-004
- **Suggested fix**: Add optional `activeDelay: { delayMinutes: integer, reason?: string }` and optional `stopTimes: StopTime[]` to SearchResult schema
- **Blocking**: No — FE will show delay badge only when delay data is provided via optional props, and expandable stops will lazy-load from TripDetail endpoint

## BookingWithDetails schema / StopTime schema
- **Issue**: Missing geographic coordinates (lat/lng) on StopTime and BookingWithDetails. The my-trips page needs stop coordinates to display stop markers on the LiveMap for active trip tracking. Currently only bus position is available via `/api/v1/tracking/{busId}`.
- **Found by**: FE Phase 2, TASK-010
- **Suggested fix**: Add optional `lat: number` and `lng: number` to StopTime schema. Include `stopTimes` array in BookingWithDetails response so the LiveMap can render stop markers alongside the bus position.
- **Blocking**: No — FE shows LiveMap with bus position only (no stop markers) when tracking is active
