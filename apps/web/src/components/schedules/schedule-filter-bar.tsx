import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/** Shared CSS class for filter select elements. */
const SELECT_CLASS =
  'flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** Props for {@link ScheduleFilterBar}. */
export interface ScheduleFilterBarProps {
  /** Current route filter. */
  routeId: string;
  /** Current bus filter. */
  busId: string;
  /** Current status filter. */
  status: string;
  /** Current from date filter. */
  fromDate: string;
  /** Current to date filter. */
  toDate: string;
  /** Route options. */
  routes: Array<{ id: string; name: string }>;
  /** Bus options. */
  buses: Array<{ id: string; licensePlate: string }>;
  /** Callback for route filter change. */
  onRouteChange: (value: string) => void;
  /** Callback for bus filter change. */
  onBusChange: (value: string) => void;
  /** Callback for status filter change. */
  onStatusChange: (value: string) => void;
  /** Callback for from date filter change. */
  onFromDateChange: (value: string) => void;
  /** Callback for to date filter change. */
  onToDateChange: (value: string) => void;
}

/**
 * Filter bar with route, bus, status dropdowns and date range inputs
 * for the schedule management page.
 */
export function ScheduleFilterBar({
  routeId,
  busId,
  status,
  fromDate,
  toDate,
  routes,
  buses,
  onRouteChange,
  onBusChange,
  onStatusChange,
  onFromDateChange,
  onToDateChange,
}: ScheduleFilterBarProps) {
  return (
    <div
      className="mb-6 flex flex-wrap items-end gap-3"
      role="search"
      aria-label="Schedule filters"
    >
      <div className="space-y-1">
        <Label htmlFor="filter-route" className="text-xs">Route</Label>
        <select
          id="filter-route"
          className={SELECT_CLASS}
          value={routeId}
          onChange={(e) => onRouteChange(e.target.value)}
        >
          <option value="">All routes</option>
          {routes.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="filter-bus" className="text-xs">Bus</Label>
        <select
          id="filter-bus"
          className={SELECT_CLASS}
          value={busId}
          onChange={(e) => onBusChange(e.target.value)}
        >
          <option value="">All buses</option>
          {buses.map((b) => (
            <option key={b.id} value={b.id}>{b.licensePlate}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="filter-status" className="text-xs">Status</Label>
        <select
          id="filter-status"
          className={SELECT_CLASS}
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="filter-from-date" className="text-xs">From</Label>
        <Input
          id="filter-from-date"
          type="date"
          className="h-9 w-36"
          value={fromDate}
          onChange={(e) => onFromDateChange(e.target.value)}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="filter-to-date" className="text-xs">To</Label>
        <Input
          id="filter-to-date"
          type="date"
          className="h-9 w-36"
          value={toDate}
          onChange={(e) => onToDateChange(e.target.value)}
        />
      </div>
    </div>
  );
}
