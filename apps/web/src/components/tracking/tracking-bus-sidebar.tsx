import { formatDistanceToNow } from 'date-fns';
import { Bus, MapPin, Gauge, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { components } from '@/api/generated/types';

type BusType = components['schemas']['Bus'];
type BusTracking = components['schemas']['BusTracking'];

/** A bus with its optional live tracking data. */
export interface TrackedBus {
  /** Bus record. */
  bus: BusType;
  /** Live tracking data (null if no tracking data available). */
  tracking: BusTracking | null;
}

/** Props for {@link TrackingBusSidebar}. */
export interface TrackingBusSidebarProps {
  /** Buses with their tracking data. */
  trackedBuses: TrackedBus[];
  /** Currently selected bus ID (highlighted in the sidebar). */
  selectedBusId: string | null;
  /** Callback when a bus is clicked. */
  onSelectBus: (busId: string) => void;
  /** Whether the data is loading. */
  isLoading: boolean;
}

/** Skeleton placeholder for the bus sidebar while loading. */
function SidebarSkeleton() {
  const { t } = useTranslation('tracking');
  return (
    <div className="space-y-3" aria-busy="true" aria-label={t('busSidebar.loadingLabel')}>
      {Array.from({ length: 4 }, (_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <Skeleton className="mb-2 h-5 w-24" />
            <Skeleton className="mb-1 h-4 w-32" />
            <Skeleton className="h-4 w-20" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * Formats a tracking timestamp as a relative time string.
 *
 * @param updatedAt - ISO 8601 timestamp.
 * @returns Human-readable relative time (e.g., "2 minutes ago").
 */
function formatUpdatedAt(updatedAt: string): string {
  return formatDistanceToNow(new Date(updatedAt), { addSuffix: true });
}

/** Props for {@link BusCard}. */
interface BusCardProps {
  /** Bus with tracking data. */
  trackedBus: TrackedBus;
  /** Whether this bus is currently selected. */
  isSelected: boolean;
  /** Callback when clicked. */
  onSelect: () => void;
}

/** A single bus card in the sidebar showing real-time info. */
function BusCard({ trackedBus, isSelected, onSelect }: BusCardProps) {
  const { t } = useTranslation('tracking');
  const { bus, tracking } = trackedBus;

  return (
    <Card className={isSelected ? 'ring-2 ring-primary' : ''}>
      <CardContent className="p-4">
        <Button
          variant="ghost"
          className="h-auto w-full justify-start p-0 text-left"
          onClick={onSelect}
          aria-label={t('busSidebar.selectBusLabel', { licensePlate: bus.licensePlate })}
          aria-pressed={isSelected}
        >
          <div className="w-full space-y-2">
            <div className="flex items-center gap-2">
              <Bus className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <span className="truncate font-semibold">{bus.licensePlate}</span>
              {tracking?.isActive && (
                <span
                  className="ml-auto inline-flex h-2 w-2 rounded-full bg-green-500"
                  aria-label={t('busSidebar.active')}
                />
              )}
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p className="truncate">{bus.model}</p>
              {tracking ? (
                <>
                  <p className="flex items-center gap-1">
                    <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                    {t('busSidebar.stopLabel', { stopIndex: tracking.currentStopIndex + 1 })}
                  </p>
                  <p className="flex items-center gap-1">
                    <Gauge className="h-3 w-3 shrink-0" aria-hidden="true" />
                    {t('busSidebar.speedValue', { speed: tracking.speed.toFixed(0) })}
                  </p>
                  <p className="flex items-center gap-1">
                    <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
                    {formatUpdatedAt(tracking.updatedAt)}
                  </p>
                </>
              ) : (
                <p className="italic">{t('busSidebar.noTrackingData')}</p>
              )}
            </div>
          </div>
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * Sidebar listing all provider buses with their real-time tracking status.
 *
 * Shows bus license plate, model, current stop index, speed, and last updated time.
 * Clicking a bus selects it and signals the parent to center the map on it.
 * Active buses show a green dot indicator.
 *
 * @example
 * ```tsx
 * <TrackingBusSidebar
 *   trackedBuses={buses}
 *   selectedBusId={selected}
 *   onSelectBus={setSelected}
 *   isLoading={false}
 * />
 * ```
 */
export function TrackingBusSidebar({
  trackedBuses,
  selectedBusId,
  onSelectBus,
  isLoading,
}: TrackingBusSidebarProps) {
  const { t } = useTranslation('tracking');

  if (isLoading) {
    return <SidebarSkeleton />;
  }

  if (trackedBuses.length === 0) {
    return (
      <div className="flex flex-col items-center py-8 text-center" role="status">
        <Bus className="mb-3 h-10 w-10 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{t('busSidebar.emptyTitle')}</p>
      </div>
    );
  }

  return (
    <div
      className="space-y-3"
      role="list"
      aria-label={t('busSidebar.listLabel')}
      aria-live="polite"
    >
      {trackedBuses.map((tb) => (
        <div key={tb.bus.id} role="listitem">
          <BusCard
            trackedBus={tb}
            isSelected={selectedBusId === tb.bus.id}
            onSelect={() => onSelectBus(tb.bus.id)}
          />
        </div>
      ))}
    </div>
  );
}
