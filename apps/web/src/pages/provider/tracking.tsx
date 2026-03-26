import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Radio } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageError } from '@/components/shared/error-state';
import { LiveMap } from '@/components/maps/live-map';
import type { BusPosition, MapStop } from '@/components/maps/live-map';
import { TrackingBusSidebar } from '@/components/tracking/tracking-bus-sidebar';
import type { TrackedBus } from '@/components/tracking/tracking-bus-sidebar';
import { ReportDelayDialog } from '@/components/tracking/report-delay-dialog';
import type { ScheduleOption } from '@/components/tracking/report-delay-dialog';
import { ActiveDelaysList } from '@/components/tracking/active-delays-list';
import { useBuses } from '@/hooks/use-buses';
import { useProviderTracking } from '@/hooks/use-provider-tracking';
import { usePageTitle } from '@/hooks/use-page-title';
import { useSchedules } from '@/hooks/use-schedules';
import { useDelays } from '@/hooks/use-delays';
import type { components } from '@/api/generated/types';

type BusTracking = components['schemas']['BusTracking'];

/* ---------- Custom Hook ---------- */

/** Aggregated data for the tracking page. */
interface TrackingPageData {
  /** Buses with their tracking data. */
  trackedBuses: TrackedBus[];
  /** Schedule options for the delay report form. */
  scheduleOptions: ScheduleOption[];
  /** Whether the initial data is loading. */
  isLoading: boolean;
  /** Whether loading failed. */
  isError: boolean;
  /** Retry all queries. */
  refetch: () => void;
}

/**
 * Custom hook aggregating buses, tracking, and schedules data for the tracking page.
 *
 * @returns Combined data for rendering the tracking page.
 */
function useTrackingPageData(): TrackingPageData {
  const busesQuery = useBuses({ page: 1, pageSize: 100 });
  const busesData = busesQuery.data?.data;
  const buses = useMemo(() => busesData ?? [], [busesData]);
  const busIds = useMemo(() => buses.map((b) => b.id), [buses]);

  const trackingQuery = useProviderTracking(busIds, busIds.length > 0);
  const schedulesQuery = useSchedules({ status: 'ACTIVE', page: 1, pageSize: 100 });

  const trackingRaw = trackingQuery.data;
  const trackingData = useMemo(
    () => (trackingRaw ?? []) as Array<{ data: BusTracking } | null>,
    [trackingRaw],
  );

  const trackedBuses: TrackedBus[] = useMemo(
    () =>
      buses.map((bus) => {
        const match = trackingData.find((t) => t?.data?.busId === bus.id);
        return { bus, tracking: match?.data ?? null };
      }),
    [buses, trackingData],
  );

  const scheduleOptions: ScheduleOption[] = useMemo(
    () =>
      (schedulesQuery.data?.data ?? []).map((s) => ({
        id: s.id,
        label: `${s.routeId} — ${new Date(s.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      })),
    [schedulesQuery.data],
  );

  const isLoading = busesQuery.isLoading;
  const isError = busesQuery.isError && !busesQuery.data;

  function refetch() {
    busesQuery.refetch();
    trackingQuery.refetch();
    schedulesQuery.refetch();
  }

  return { trackedBuses, scheduleOptions, isLoading, isError, refetch };
}

/* ---------- Map Section ---------- */

/** Props for {@link TrackingMapSection}. */
interface TrackingMapSectionProps {
  /** All bus positions to render on the map. */
  busPositions: Array<{ busId: string; position: BusPosition }>;
  /** Selected bus ID to focus map on. */
  selectedBusId: string | null;
}

/** Full-width map showing all active buses. */
function TrackingMapSection({ busPositions, selectedBusId }: TrackingMapSectionProps) {
  const selected = busPositions.find((bp) => bp.busId === selectedBusId);
  const center = selected ? { lat: selected.position.lat, lng: selected.position.lng } : undefined;
  const zoom = selected ? 13 : undefined;

  const stops: MapStop[] = busPositions.map((bp) => ({
    name: bp.busId,
    lat: bp.position.lat,
    lng: bp.position.lng,
  }));

  return (
    <LiveMap
      stops={stops}
      busPosition={selected?.position}
      center={center}
      zoom={zoom}
      className="h-full w-full"
    />
  );
}

/* ---------- Loading Skeleton ---------- */

/** Skeleton placeholder for the tracking page while loading. */
function TrackingLoadingSkeleton() {
  const { t } = useTranslation('provider');

  return (
    <div
      className="flex h-full flex-col lg:flex-row"
      aria-busy="true"
      aria-label={t('tracking.loadingLabel')}
    >
      <div className="h-64 w-full lg:h-full lg:flex-1">
        <Skeleton className="h-full w-full" />
      </div>
      <div className="w-full space-y-3 p-4 lg:w-80 lg:overflow-y-auto">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

/* ---------- Page Content ---------- */

/** Props for {@link TrackingContent}. */
interface TrackingContentProps {
  /** Aggregated tracking page data. */
  data: TrackingPageData;
}

/** Main content of the tracking page with map and sidebar. */
function TrackingContent({ data }: TrackingContentProps) {
  const { t } = useTranslation('provider');
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);
  const { trackedBuses, scheduleOptions } = data;

  const busPositions = useMemo(
    () =>
      trackedBuses
        .filter((tb) => tb.tracking?.isActive)
        .map((tb) => ({
          busId: tb.bus.id,
          position: {
            lat: tb.tracking!.lat,
            lng: tb.tracking!.lng,
            heading: tb.tracking!.heading,
          },
        })),
    [trackedBuses],
  );

  const selectedTracking = trackedBuses.find((tb) => tb.bus.id === selectedBusId)?.tracking;
  const todayDate = new Date().toISOString().split('T')[0];

  const delaysQuery = useDelays({
    scheduleId: selectedTracking?.scheduleId ?? '',
    tripDate: todayDate,
    page: 1,
    pageSize: 50,
  });

  const delays = delaysQuery.data?.data ?? [];

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col lg:flex-row">
      {/* Map area */}
      <div className="relative h-64 w-full lg:h-full lg:flex-1">
        <TrackingMapSection busPositions={busPositions} selectedBusId={selectedBusId} />
      </div>

      {/* Sidebar - scrollable on desktop, bottom sheet style on mobile */}
      <aside
        className="flex w-full flex-col gap-4 overflow-y-auto border-t p-4 lg:w-80 lg:border-l lg:border-t-0"
        aria-label={t('tracking.sidebarLabel')}
      >
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Radio className="h-5 w-5 text-primary" aria-hidden="true" />
            {t('tracking.sidebarTitle')}
          </h2>
          <ReportDelayDialog schedules={scheduleOptions}>
            <Button variant="outline" size="sm">
              <AlertTriangle className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              {t('tracking.reportDelay')}
            </Button>
          </ReportDelayDialog>
        </div>

        <TrackingBusSidebar
          trackedBuses={trackedBuses}
          selectedBusId={selectedBusId}
          onSelectBus={setSelectedBusId}
          isLoading={false}
        />

        {/* Active delays section */}
        {selectedTracking?.scheduleId && (
          <div>
            <h3 className="mb-2 text-sm font-medium">{t('tracking.activeDelays')}</h3>
            <ActiveDelaysList delays={delays} isLoading={delaysQuery.isLoading} />
          </div>
        )}
      </aside>
    </div>
  );
}

/* ---------- Page ---------- */

/**
 * Provider fleet tracking page with live map and bus sidebar.
 *
 * Displays a full-width map showing all active buses with 5-second polling.
 * A sidebar lists all fleet buses with real-time info (speed, stop, last update).
 * Clicking a bus centers the map on it and shows its active delays.
 * Includes a delay reporting dialog for active schedules.
 *
 * @example
 * ```
 * // Route: /provider/tracking (requires PROVIDER role)
 * <ProviderTrackingPage />
 * ```
 */
export default function ProviderTrackingPage() {
  const { t } = useTranslation('provider');
  usePageTitle(t('tracking.title'));
  const data = useTrackingPageData();

  if (data.isLoading) {
    return <TrackingLoadingSkeleton />;
  }

  if (data.isError) {
    return (
      <PageError
        title={t('tracking.error.title')}
        message={t('tracking.error.message')}
        onRetry={data.refetch}
      />
    );
  }

  return <TrackingContent data={data} />;
}
