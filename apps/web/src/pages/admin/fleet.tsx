import { useState, useMemo, useCallback } from 'react';
import { Bus as BusIcon, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageError } from '@/components/shared/error-state';
import { EmptyState } from '@/components/shared/empty-state';
import { useAdminBuses, useToggleSeat } from '@/hooks/use-admin';
import { useBusDetail } from '@/hooks/use-buses';
import { usePageTitle } from '@/hooks/use-page-title';
import { SeatGridPreview } from '@/components/fleet/create-bus-dialog';
import type { components } from '@/api/generated/types';

type Bus = components['schemas']['Bus'];
type Seat = components['schemas']['Seat'];

/* ---------- Loading Skeleton ---------- */

/** Skeleton placeholder for the admin fleet list while loading. */
function AdminFleetSkeleton() {
  const { t } = useTranslation('admin');
  return (
    <div className="space-y-6" aria-busy="true" aria-label={t('fleet.loadingLabel')}>
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="h-6 w-40" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 2 }, (_, j) => (
              <Card key={j}>
                <CardContent className="p-6">
                  <Skeleton className="mb-3 h-6 w-28" />
                  <Skeleton className="mb-2 h-4 w-36" />
                  <Skeleton className="mb-2 h-4 w-24" />
                  <Skeleton className="h-12 w-20" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Seat Toggle Grid ---------- */

/** Props for {@link SeatToggleGrid}. */
interface SeatToggleGridProps {
  /** Bus ID to fetch seats for. */
  busId: string;
  /** Number of seat rows. */
  rows: number;
  /** Number of seat columns. */
  columns: number;
}

/** Seat colour mapping based on type. */
const SEAT_ENABLED_COLORS: Record<string, string> = {
  STANDARD: 'bg-green-200 border-green-500 hover:bg-green-300',
  PREMIUM: 'bg-amber-200 border-amber-500 hover:bg-amber-300',
  DISABLED_ACCESSIBLE: 'bg-blue-200 border-blue-500 hover:bg-blue-300',
  BLOCKED: 'bg-gray-200 border-gray-500 hover:bg-gray-300',
};

const DISABLED_SEAT_STYLE = 'bg-red-100 border-red-400 hover:bg-red-200';

/** Seat type label icons. */
const SEAT_TYPE_ICONS: Record<string, string> = {
  STANDARD: '',
  PREMIUM: '★',
  DISABLED_ACCESSIBLE: '♿',
  BLOCKED: '✕',
};

/**
 * Interactive seat grid that loads seats for a bus and provides toggle buttons.
 *
 * Fetches bus detail (with seats) via `useBusDetail`. Each seat is rendered as
 * a clickable button that toggles enabled/disabled state via `useToggleSeat`.
 * Disabled seats are visually distinct (red tint + strikethrough label).
 */
function SeatToggleGrid({ busId, rows, columns }: SeatToggleGridProps) {
  const { t } = useTranslation('admin');
  const busQuery = useBusDetail(busId);
  const toggleSeat = useToggleSeat();
  const bus = busQuery.data?.data;

  const seats = bus?.seats;
  const seatMap = useMemo(() => {
    if (!seats) return new Map<string, Seat>();
    const map = new Map<string, Seat>();
    for (const seat of seats) {
      map.set(`${seat.row}-${seat.column}`, seat);
    }
    return map;
  }, [seats]);

  if (busQuery.isLoading) {
    return (
      <div aria-busy="true" aria-label={t('fleet.loadingSeats')} className="space-y-2 py-2">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-24 w-48" />
      </div>
    );
  }

  if (busQuery.isError) {
    return (
      <p role="alert" className="py-2 text-sm text-destructive">
        {t('fleet.error.seats')}
      </p>
    );
  }

  if (!bus?.seats || bus.seats.length === 0) {
    return <p className="py-2 text-sm text-muted-foreground">{t('fleet.empty.seats')}</p>;
  }

  const disabledCount = bus.seats.filter((s) => !s.isEnabled).length;
  const enabledCount = bus.seats.length - disabledCount;

  return (
    <div className="space-y-3 py-2">
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>{t('fleet.seatStats', { enabled: enabledCount, disabled: disabledCount })}</span>
      </div>
      <div
        className="inline-grid gap-1"
        style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
        role="grid"
        aria-label={t('fleet.seatGrid.label')}
      >
        {Array.from({ length: rows }, (_, r) =>
          Array.from({ length: columns }, (_, c) => {
            const seat = seatMap.get(`${r}-${c}`);
            if (!seat) {
              return (
                <div
                  key={`${r}-${c}`}
                  className="h-8 w-8 rounded border border-dashed border-gray-300"
                  role="gridcell"
                  aria-label={t('fleet.seatGrid.emptyCell')}
                />
              );
            }
            const colorClass = seat.isEnabled
              ? (SEAT_ENABLED_COLORS[seat.type] ?? SEAT_ENABLED_COLORS.STANDARD)
              : DISABLED_SEAT_STYLE;
            return (
              <button
                key={seat.id}
                role="gridcell"
                className={`flex h-8 w-8 items-center justify-center rounded border text-xs font-medium transition-colors ${colorClass} ${!seat.isEnabled ? 'line-through opacity-70' : ''}`}
                aria-label={t('fleet.seatGrid.seatLabel', {
                  label: seat.label,
                  type: t(`fleet.seatTypes.${seat.type}`).toLowerCase(),
                  state: seat.isEnabled
                    ? t('fleet.seatGrid.enabled')
                    : t('fleet.seatGrid.disabled'),
                  action: seat.isEnabled ? t('fleet.seatGrid.disable') : t('fleet.seatGrid.enable'),
                })}
                onClick={() => toggleSeat.mutate({ id: seat.id, isEnabled: !seat.isEnabled })}
                disabled={toggleSeat.isPending}
              >
                {SEAT_TYPE_ICONS[seat.type] || seat.label}
              </button>
            );
          }),
        )}
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-3 w-3 rounded border border-green-500 bg-green-200"
            aria-hidden="true"
          />
          {t('fleet.seatTypes.STANDARD')}
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-3 w-3 rounded border border-amber-500 bg-amber-200"
            aria-hidden="true"
          />
          {t('fleet.seatTypes.PREMIUM')}
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-3 w-3 rounded border border-blue-500 bg-blue-200"
            aria-hidden="true"
          />
          {t('fleet.seatTypes.DISABLED_ACCESSIBLE')}
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-3 w-3 rounded border border-red-400 bg-red-100"
            aria-hidden="true"
          />
          {t('fleet.seatTypes.BLOCKED')}
        </span>
      </div>
    </div>
  );
}

/* ---------- Admin Bus Card ---------- */

/** Props for {@link AdminBusCard}. */
interface AdminBusCardProps {
  /** Bus data to display. */
  bus: Bus;
  /** Whether this card's seat grid is expanded. */
  isExpanded: boolean;
  /** Toggle expansion of the seat grid. */
  onToggle: () => void;
}

/** Displays a single bus card with admin seat management controls. */
function AdminBusCard({ bus, isExpanded, onToggle }: AdminBusCardProps) {
  const { t } = useTranslation('admin');
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <BusIcon className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <h4 className="truncate font-semibold">{bus.licensePlate}</h4>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{bus.model}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {bus.capacity} seats · {bus.rows}×{bus.columns}
            </p>
            {!isExpanded && (
              <div className="mt-2">
                <SeatGridPreview rows={bus.rows} columns={bus.columns} seats={[]} />
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            aria-expanded={isExpanded}
            aria-label={`${isExpanded ? t('fleet.collapse') : t('fleet.manageSeats')} ${bus.licensePlate}`}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="mr-1 h-4 w-4" aria-hidden="true" />
                {t('fleet.collapse')}
              </>
            ) : (
              <>
                <ChevronDown className="mr-1 h-4 w-4" aria-hidden="true" />
                {t('fleet.manageSeats')}
              </>
            )}
          </Button>
        </div>
        {isExpanded && <SeatToggleGrid busId={bus.id} rows={bus.rows} columns={bus.columns} />}
      </CardContent>
    </Card>
  );
}

/* ---------- Provider Group ---------- */

/** Props for {@link ProviderGroup}. */
interface ProviderGroupProps {
  /** Provider display name. */
  providerName: string;
  /** Buses belonging to this provider. */
  buses: Bus[];
  /** Set of expanded bus IDs. */
  expandedBuses: Set<string>;
  /** Toggle expansion for a bus. */
  onToggleBus: (busId: string) => void;
}

/** Renders a group of buses belonging to a single provider. */
function ProviderGroup({ providerName, buses, expandedBuses, onToggleBus }: ProviderGroupProps) {
  return (
    <div>
      <h3 className="mb-3 text-lg font-semibold text-muted-foreground">
        {providerName}
      </h3>
      <div
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        aria-label={`Buses for ${providerName}`}
      >
        {buses.map((bus) => (
          <AdminBusCard
            key={bus.id}
            bus={bus}
            isExpanded={expandedBuses.has(bus.id)}
            onToggle={() => onToggleBus(bus.id)}
          />
        ))}
      </div>
    </div>
  );
}

/* ---------- Grouped Bus List ---------- */

/** Props for {@link GroupedBusList}. */
interface GroupedBusListProps {
  /** Buses to display, grouped by provider. */
  buses: Bus[];
  /** Set of expanded bus IDs. */
  expandedBuses: Set<string>;
  /** Toggle expansion for a bus. */
  onToggleBus: (busId: string) => void;
}

/** Renders buses grouped by provider name. */
function GroupedBusList({ buses, expandedBuses, onToggleBus }: GroupedBusListProps) {
  const groupedBuses = useMemo(() => {
    const groups = new Map<string, Bus[]>();
    for (const bus of buses) {
      const key = bus.providerName ?? bus.providerId;
      const existing = groups.get(key);
      if (existing) {
        existing.push(bus);
      } else {
        groups.set(key, [bus]);
      }
    }
    return groups;
  }, [buses]);

  return (
    <div className="space-y-8">
      {Array.from(groupedBuses.entries()).map(([providerName, providerBuses]) => (
        <ProviderGroup
          key={providerName}
          providerName={providerName}
          buses={providerBuses}
          expandedBuses={expandedBuses}
          onToggleBus={onToggleBus}
        />
      ))}
    </div>
  );
}

/* ---------- Pagination ---------- */

/** Props for {@link FleetPagination}. */
interface FleetPaginationProps {
  /** Current page number. */
  page: number;
  /** Total number of pages. */
  totalPages: number;
  /** Callback to change page. */
  onPageChange: (page: number) => void;
}

/** Pagination controls for the fleet list. */
function FleetPagination({ page, totalPages, onPageChange }: FleetPaginationProps) {
  const { t } = useTranslation('admin');
  return (
    <nav className="mt-8 flex items-center justify-center gap-4" aria-label="Fleet pagination">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        {t('pagination.previous')}
      </Button>
      <span className="text-sm text-muted-foreground">
        {t('pagination.pageOf', { page, totalPages })}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        {t('pagination.next')}
      </Button>
    </nav>
  );
}

/* ---------- Fleet Content ---------- */

/** Props for {@link FleetContent}. */
interface FleetContentProps {
  /** Whether data is loading. */
  isLoading: boolean;
  /** Whether there was a fetch error. */
  isError: boolean;
  /** The list of buses. */
  buses: Bus[];
  /** Retry callback for error state. */
  onRetry: () => void;
  /** Set of expanded bus IDs. */
  expandedBuses: Set<string>;
  /** Toggle expansion for a bus. */
  onToggleBus: (busId: string) => void;
}

/** Renders the appropriate fleet content based on query state. */
function FleetContent({
  isLoading,
  isError,
  buses,
  onRetry,
  expandedBuses,
  onToggleBus,
}: FleetContentProps) {
  const { t } = useTranslation('admin');
  if (isLoading) return <AdminFleetSkeleton />;
  if (isError) {
    return (
      <PageError
        title={t('fleet.error.title')}
        message={t('fleet.error.message')}
        onRetry={onRetry}
      />
    );
  }
  if (buses.length === 0) {
    return (
      <EmptyState
        icon={BusIcon}
        title={t('fleet.empty.title')}
        message={t('fleet.empty.message')}
      />
    );
  }
  return <GroupedBusList buses={buses} expandedBuses={expandedBuses} onToggleBus={onToggleBus} />;
}

/* ---------- Page ---------- */

/**
 * Admin fleet management page.
 *
 * Displays all buses across all providers, grouped by provider ID. Each bus
 * shows basic info and an expandable seat grid where individual seats can be
 * toggled enabled/disabled. Supports pagination and loading/error/empty states.
 *
 * @example
 * ```
 * // Route: /admin/fleet (requires ADMIN role)
 * <AdminFleetPage />
 * ```
 */
export default function AdminFleetPage() {
  const { t } = useTranslation('admin');
  usePageTitle(t('fleet.title'));
  const [page, setPage] = useState(1);
  const busesQuery = useAdminBuses({ page, pageSize: 20 });
  const [expandedBuses, setExpandedBuses] = useState<Set<string>>(new Set());

  const busesData = busesQuery.data;
  const buses = busesData?.data ?? [];
  const meta = busesData?.meta;
  const totalPages = meta?.totalPages ?? 1;

  const toggleBusExpansion = useCallback((busId: string) => {
    setExpandedBuses((prev) => {
      const next = new Set(prev);
      if (next.has(busId)) {
        next.delete(busId);
      } else {
        next.add(busId);
      }
      return next;
    });
  }, []);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">{t('fleet.title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('fleet.subtitle')}</p>
      </div>

      <section aria-labelledby="admin-fleet-heading">
        <h2 id="admin-fleet-heading" className="sr-only">
          {t('fleet.heading')}
        </h2>
        <FleetContent
          isLoading={busesQuery.isLoading}
          isError={busesQuery.isError && !busesData}
          buses={buses}
          onRetry={() => busesQuery.refetch()}
          expandedBuses={expandedBuses}
          onToggleBus={toggleBusExpansion}
        />
      </section>

      {totalPages > 1 && (
        <FleetPagination page={page} totalPages={totalPages} onPageChange={setPage} />
      )}
    </div>
  );
}
