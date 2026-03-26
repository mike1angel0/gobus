import { useState, useCallback, useMemo } from 'react';
import { format, addDays, subDays } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Clock, Bus, Calendar } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CardListSkeleton } from '@/components/shared/loading-skeleton';
import { PageError } from '@/components/shared/error-state';
import { EmptyState } from '@/components/shared/empty-state';
import { useDriverTrips } from '@/hooks/use-driver-trips';
import { usePageTitle } from '@/hooks/use-page-title';
import type { components } from '@/api/generated/types';

type DriverTrip = components['schemas']['DriverTrip'];

/* ---------- Helpers ---------- */

/** Returns the trip status based on current time compared to departure/arrival. */
function deriveTripStatus(
  trip: DriverTrip,
): 'upcoming' | 'in-progress' | 'completed' | 'cancelled' {
  if (trip.status === 'CANCELLED') return 'cancelled';
  const now = new Date();
  const dep = new Date(trip.departureTime);
  const arr = new Date(trip.arrivalTime);
  if (now < dep) return 'upcoming';
  if (now >= dep && now <= arr) return 'in-progress';
  return 'completed';
}

/** Status badge color map. */
const STATUS_STYLES: Record<ReturnType<typeof deriveTripStatus>, string> = {
  upcoming: 'bg-blue-100 text-blue-700',
  'in-progress': 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

/** Status display key map for i18n. */
const STATUS_KEYS: Record<ReturnType<typeof deriveTripStatus>, string> = {
  upcoming: 'trips.status.upcoming',
  'in-progress': 'trips.status.in-progress',
  completed: 'trips.status.completed',
  cancelled: 'trips.status.cancelled',
};

/* ---------- Trip Card ---------- */

/** Props for {@link TripCard}. */
interface TripCardProps {
  /** Trip data to display. */
  trip: DriverTrip;
  /** Callback when the card is tapped/clicked. */
  onSelect: (scheduleId: string) => void;
}

/** Displays a single trip card with route, times, bus, and status. */
function TripCard({ trip, onSelect }: TripCardProps) {
  const { t } = useTranslation('driver');
  const tripStatus = deriveTripStatus(trip);
  const depTime = format(new Date(trip.departureTime), 'HH:mm');
  const arrTime = format(new Date(trip.arrivalTime), 'HH:mm');
  const statusLabel = t(STATUS_KEYS[tripStatus]);

  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md"
      role="button"
      tabIndex={0}
      aria-label={t('trips.tripLabel', { route: trip.routeName, depTime, arrTime, status: statusLabel })}
      onClick={() => onSelect(trip.scheduleId)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(trip.scheduleId);
        }
      }}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <h3 className="truncate font-semibold">{trip.routeName}</h3>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[tripStatus]}`}
          >
            {statusLabel}
          </span>
        </div>

        <dl className="mt-3 space-y-1 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <dt className="sr-only">Times</dt>
            <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
            <dd>
              {depTime} → {arrTime}
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="sr-only">Bus</dt>
            <Bus className="h-4 w-4 shrink-0" aria-hidden="true" />
            <dd>{trip.busLicensePlate}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

/* ---------- Trip List Content ---------- */

/** Props for {@link TripListContent}. */
interface TripListContentProps {
  /** Whether data is loading. */
  isLoading: boolean;
  /** Whether there is an error. */
  isError: boolean;
  /** Trip data. */
  trips: DriverTrip[];
  /** Retry callback. */
  onRetry: () => void;
  /** Trip selection callback. */
  onSelect: (scheduleId: string) => void;
}

/** Renders the appropriate content based on query state. */
function TripListContent({ isLoading, isError, trips, onRetry, onSelect }: TripListContentProps) {
  const { t } = useTranslation('driver');

  if (isLoading) return <CardListSkeleton label={t('trips.loadingTrips')} />;
  if (isError) {
    return (
      <PageError
        title={t('trips.errorTitle')}
        message={t('trips.errorMessage')}
        onRetry={onRetry}
      />
    );
  }
  if (trips.length === 0) {
    return (
      <EmptyState
        icon={Calendar}
        title={t('trips.noTripsTitle')}
        message={t('trips.noTripsMessage')}
      />
    );
  }

  return (
    <div className="space-y-4" aria-label={t('trips.listLabel')}>
      {trips.map((trip) => (
        <TripCard key={trip.scheduleId} trip={trip} onSelect={onSelect} />
      ))}
    </div>
  );
}

/* ---------- Date Navigation ---------- */

/** Props for {@link DateNav}. */
interface DateNavProps {
  /** Currently selected date. */
  selectedDate: Date;
  /** Callback to navigate to previous day. */
  onPrev: () => void;
  /** Callback to navigate to next day. */
  onNext: () => void;
}

/** Date navigation with prev/next day buttons. */
function DateNav({ selectedDate, onPrev, onNext }: DateNavProps) {
  const { t } = useTranslation('driver');
  const dateLabel = format(selectedDate, 'EEEE, MMM d, yyyy');
  const isToday = format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="flex items-center justify-center gap-3">
      <Button variant="outline" size="icon" onClick={onPrev} aria-label={t('trips.previousDay')}>
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </Button>
      <span className="min-w-48 text-center font-medium" aria-live="polite">
        {dateLabel}
        {isToday && (
          <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
            {t('trips.today')}
          </span>
        )}
      </span>
      <Button variant="outline" size="icon" onClick={onNext} aria-label={t('trips.nextDay')}>
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}

/* ---------- Page ---------- */

/**
 * Driver trips list page.
 *
 * Shows the driver's assigned schedule cards for a selected date with
 * date navigation (prev/next day). Cards display route name, departure/arrival
 * times, bus info, and time-derived status. Tapping a card navigates to
 * the trip detail page. Mobile-first responsive layout for driver use.
 *
 * @example
 * ```
 * // Route: /driver (requires DRIVER role)
 * <DriverTripsPage />
 * ```
 */
export default function DriverTripsPage() {
  const { t } = useTranslation('driver');
  usePageTitle(t('trips.title'));
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const navigate = useNavigate();

  const dateStr = useMemo(() => format(selectedDate, 'yyyy-MM-dd'), [selectedDate]);

  const { data, isLoading, isError, refetch } = useDriverTrips({ date: dateStr });
  const trips = data?.data ?? [];

  const handlePrev = useCallback(() => setSelectedDate((d) => subDays(d, 1)), []);
  const handleNext = useCallback(() => setSelectedDate((d) => addDays(d, 1)), []);

  const handleSelect = useCallback(
    (scheduleId: string) => {
      navigate(`/driver/trip/${scheduleId}?date=${dateStr}`);
    },
    [navigate, dateStr],
  );

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-6">
      <h1 className="mb-6 text-2xl font-bold">{t('trips.title')}</h1>

      <div className="mb-6">
        <DateNav selectedDate={selectedDate} onPrev={handlePrev} onNext={handleNext} />
      </div>

      <section aria-labelledby="trips-heading">
        <h2 id="trips-heading" className="sr-only">
          {t('trips.heading')}
        </h2>
        <TripListContent
          isLoading={isLoading}
          isError={isError && !data}
          trips={trips}
          onRetry={refetch}
          onSelect={handleSelect}
        />
      </section>
    </div>
  );
}
