import { useState, useMemo, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, ArrowLeft, Clock, MapPin, Bus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SeatMap } from '@/components/booking/seat-map';
import { useTripDetails } from '@/hooks/use-search';
import { useCreateBooking } from '@/hooks/use-bookings';
import { usePageTitle } from '@/hooks/use-page-title';
import type { components } from '@/api/generated/types';

type TripDetail = components['schemas']['TripDetail'];
type StopTime = components['schemas']['StopTime'];

/**
 * Formats an ISO datetime string to a short time string (e.g., "14:30").
 * @param iso - ISO 8601 datetime string
 * @returns Formatted time string in HH:MM format
 */
function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Formats a price as a currency string.
 * @param price - Numeric price value
 * @returns Formatted price string (e.g., "$12.50")
 */
function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}

/**
 * Computes the human-readable duration between two ISO datetime strings.
 * @param departure - Departure ISO datetime
 * @param arrival - Arrival ISO datetime
 * @returns Formatted duration string (e.g., "2h 30m")
 */
function formatDuration(departure: string, arrival: string): string {
  const diffMs = new Date(arrival).getTime() - new Date(departure).getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

/**
 * Computes the segment price between two stops using cumulative priceFromStart.
 * @param stops - Ordered array of stop times
 * @param boardingStop - Name of the boarding stop
 * @param alightingStop - Name of the alighting stop
 * @returns Segment price, or null if stops not found
 */
function computeSegmentPrice(
  stops: StopTime[],
  boardingStop: string,
  alightingStop: string,
): number | null {
  const boarding = stops.find((s) => s.stopName === boardingStop);
  const alighting = stops.find((s) => s.stopName === alightingStop);
  if (!boarding || !alighting) return null;
  return alighting.priceFromStart - boarding.priceFromStart;
}

/**
 * Skeleton loader displayed while trip detail data is being fetched.
 */
function TripDetailSkeleton() {
  const { t } = useTranslation('search');
  return (
    <div className="space-y-6" aria-busy="true" aria-label={t('tripDetail.loadingAriaLabel')}>
      <Skeleton className="h-8 w-48" />
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-6 w-24" />
          </div>
          <div className="flex items-center gap-8">
            <Skeleton className="h-10 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-10 w-20" />
          </div>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-4 pt-6">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

/** Props for the {@link ErrorState} component. */
interface ErrorStateProps {
  /** Callback invoked when the user clicks the retry button. */
  onRetry: () => void;
}

/**
 * Error state shown when the trip detail fetch fails.
 */
function ErrorState({ onRetry }: ErrorStateProps) {
  const { t } = useTranslation('search');
  return (
    <div className="flex flex-col items-center py-16 text-center" role="alert">
      <AlertCircle className="mb-4 h-16 w-16 text-destructive" aria-hidden="true" />
      <h2 className="mb-2 text-xl font-semibold">{t('tripDetail.error.title')}</h2>
      <p className="mb-6 max-w-md text-muted-foreground">{t('tripDetail.error.message')}</p>
      <Button onClick={onRetry} variant="outline">
        {t('tripDetail.error.retry')}
      </Button>
    </div>
  );
}

/** Props for the {@link StopList} component. */
interface StopListProps {
  /** Ordered array of stop times. */
  stops: StopTime[];
}

/**
 * Renders the ordered list of stops with times and cumulative prices.
 */
function StopList({ stops }: StopListProps) {
  const { t } = useTranslation('search');
  return (
    <ol className="space-y-2" aria-label={t('tripDetail.tripStops')}>
      {stops.map((stop, index) => (
        <li key={stop.id} className="flex items-start gap-3">
          <div className="flex flex-col items-center">
            <div
              className={
                'mt-1 h-3 w-3 rounded-full border-2 ' +
                (index === 0 || index === stops.length - 1
                  ? 'border-primary bg-primary'
                  : 'border-muted-foreground bg-background')
              }
              aria-hidden="true"
            />
            {index < stops.length - 1 && (
              <div className="h-6 w-px bg-muted-foreground/30" aria-hidden="true" />
            )}
          </div>
          <div className="flex flex-1 items-baseline justify-between gap-2">
            <div>
              <span className="font-medium">{stop.stopName}</span>
              <span className="ml-2 text-sm text-muted-foreground">
                {formatTime(stop.departureTime)}
              </span>
            </div>
            <span className="text-sm text-muted-foreground">
              {formatPrice(stop.priceFromStart)}
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Props for the {@link BookingForm} component. */
interface BookingFormProps {
  /** The full trip detail data. */
  trip: TripDetail;
  /** Currently selected seat IDs from the seat map. */
  selectedSeatIds: string[];
  /** Callback to update selected seats. */
  onSelectionChange: (seatIds: string[]) => void;
}

/**
 * Booking form with boarding/alighting stop dropdowns, seat map, price summary, and submit button.
 */
function BookingForm({ trip, selectedSeatIds, onSelectionChange }: BookingFormProps) {
  const { t } = useTranslation('search');
  const navigate = useNavigate();
  const createBooking = useCreateBooking();

  const [boardingStop, setBoardingStop] = useState('');
  const [alightingStop, setAlightingStop] = useState('');

  const sortedStops = useMemo(
    () => [...trip.stopTimes].sort((a, b) => a.orderIndex - b.orderIndex),
    [trip.stopTimes],
  );

  const boardingIndex = useMemo(
    () => sortedStops.findIndex((s) => s.stopName === boardingStop),
    [sortedStops, boardingStop],
  );

  const alightingOptions = useMemo(
    () => (boardingIndex >= 0 ? sortedStops.slice(boardingIndex + 1) : []),
    [sortedStops, boardingIndex],
  );

  const segmentPrice = useMemo(
    () =>
      boardingStop && alightingStop
        ? computeSegmentPrice(sortedStops, boardingStop, alightingStop)
        : null,
    [sortedStops, boardingStop, alightingStop],
  );

  const selectedSeatLabels = useMemo(() => {
    const seatMap = new Map(trip.seats.map((s) => [s.id, s.label]));
    return selectedSeatIds.map((id) => seatMap.get(id)).filter(Boolean) as string[];
  }, [trip.seats, selectedSeatIds]);

  const totalPrice = segmentPrice !== null ? segmentPrice * selectedSeatIds.length : null;

  const canSubmit =
    boardingStop !== '' &&
    alightingStop !== '' &&
    selectedSeatIds.length > 0 &&
    !createBooking.isPending;

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    createBooking.mutate(
      {
        scheduleId: trip.scheduleId,
        seatLabels: selectedSeatLabels,
        boardingStop,
        alightingStop,
        tripDate: trip.tripDate,
      },
      {
        onSuccess: () => {
          navigate('/my-trips');
        },
      },
    );
  }, [
    canSubmit,
    createBooking,
    trip.scheduleId,
    trip.tripDate,
    selectedSeatLabels,
    boardingStop,
    alightingStop,
    navigate,
  ]);

  const handleBoardingChange = useCallback(
    (value: string) => {
      setBoardingStop(value);
      // Reset alighting if it's no longer valid
      const newBoardingIndex = sortedStops.findIndex((s) => s.stopName === value);
      const currentAlightingIndex = sortedStops.findIndex((s) => s.stopName === alightingStop);
      if (currentAlightingIndex <= newBoardingIndex) {
        setAlightingStop('');
      }
    },
    [sortedStops, alightingStop],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('tripDetail.booking.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stop Selection */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="boarding-stop" className="mb-1.5 block text-sm font-medium">
              {t('tripDetail.booking.boardingStop')}
            </label>
            <select
              id="boarding-stop"
              value={boardingStop}
              onChange={(e) => handleBoardingChange(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={t('tripDetail.booking.selectBoarding')}
            >
              <option value="">{t('tripDetail.booking.selectStop')}</option>
              {sortedStops.slice(0, -1).map((stop) => (
                <option key={stop.id} value={stop.stopName}>
                  {stop.stopName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="alighting-stop" className="mb-1.5 block text-sm font-medium">
              {t('tripDetail.booking.alightingStop')}
            </label>
            <select
              id="alighting-stop"
              value={alightingStop}
              onChange={(e) => setAlightingStop(e.target.value)}
              disabled={boardingStop === ''}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={t('tripDetail.booking.selectAlighting')}
            >
              <option value="">{t('tripDetail.booking.selectStop')}</option>
              {alightingOptions.map((stop) => (
                <option key={stop.id} value={stop.stopName}>
                  {stop.stopName}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Seat Map */}
        <div>
          <h3 className="mb-3 text-sm font-medium">{t('tripDetail.selectSeats')}</h3>
          <SeatMap
            seats={trip.seats}
            selectedSeatIds={selectedSeatIds}
            onSelectionChange={onSelectionChange}
            basePrice={trip.basePrice}
          />
        </div>

        {/* Price Summary */}
        {totalPrice !== null && selectedSeatIds.length > 0 && (
          <div
            className="rounded-md bg-muted p-4"
            aria-label={t('tripDetail.booking.priceSummary')}
            role="region"
          >
            <div className="flex items-center justify-between text-sm">
              <span>
                {t('tripDetail.booking.seatCount', { count: selectedSeatIds.length })} ×{' '}
                {formatPrice(segmentPrice ?? 0)}
              </span>
              <span className="text-lg font-bold">{formatPrice(totalPrice)}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('tripDetail.booking.seats')} {selectedSeatLabels.join(', ')}
            </p>
          </div>
        )}

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full"
          size="lg"
          aria-label={t('tripDetail.booking.confirmAriaLabel')}
        >
          {createBooking.isPending
            ? t('tripDetail.booking.confirming')
            : t('tripDetail.booking.confirm')}
        </Button>
      </CardContent>
    </Card>
  );
}

/** Props for the {@link TripDetailContent} component. */
interface TripDetailContentProps {
  /** The trip detail data. */
  trip: TripDetail;
}

/**
 * Renders the trip info card and booking form once data is loaded.
 */
function TripDetailContent({ trip }: TripDetailContentProps) {
  const { t } = useTranslation('search');
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);

  const sortedStops = useMemo(
    () => [...trip.stopTimes].sort((a, b) => a.orderIndex - b.orderIndex),
    [trip.stopTimes],
  );

  return (
    <div className="space-y-6">
      {/* Trip Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>{trip.routeName}</CardTitle>
            {trip.status === 'CANCELLED' && (
              <span className="rounded bg-destructive/10 px-2 py-0.5 text-sm font-medium text-destructive">
                {t('tripDetail.cancelled')}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            <Bus className="mr-1 inline-block h-4 w-4" aria-hidden="true" />
            {trip.providerName}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Times */}
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold">{formatTime(trip.departureTime)}</p>
              <p className="text-xs text-muted-foreground">{t('tripDetail.departure')}</p>
            </div>
            <div className="flex flex-1 flex-col items-center gap-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" aria-hidden="true" />
                {formatDuration(trip.departureTime, trip.arrivalTime)}
              </div>
              <div className="h-px w-full bg-border" aria-hidden="true" />
              <p className="text-xs text-muted-foreground">{trip.tripDate}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{formatTime(trip.arrivalTime)}</p>
              <p className="text-xs text-muted-foreground">{t('tripDetail.arrival')}</p>
            </div>
          </div>

          {/* Base Price */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{t('tripDetail.from')}</span>
            <span className="text-lg font-bold text-primary">{formatPrice(trip.basePrice)}</span>
          </div>

          {/* Stops */}
          <div>
            <h3 className="mb-3 flex items-center gap-1 text-sm font-medium">
              <MapPin className="h-4 w-4" aria-hidden="true" />
              {t('tripDetail.stopsCount', { count: sortedStops.length })}
            </h3>
            <StopList stops={sortedStops} />
          </div>
        </CardContent>
      </Card>

      {/* Booking Form */}
      {trip.status === 'ACTIVE' && (
        <BookingForm
          trip={trip}
          selectedSeatIds={selectedSeatIds}
          onSelectionChange={setSelectedSeatIds}
        />
      )}
    </div>
  );
}

/**
 * Trip detail page that displays full trip information and a booking form.
 *
 * Features:
 * - Full trip info: provider, route name, departure/arrival times, trip date
 * - Stop list with times and cumulative segment prices
 * - Interactive seat map for seat selection
 * - Boarding/alighting stop dropdowns (boarding must come before alighting)
 * - Computed segment price based on selected stops
 * - Booking submission via typed API client with 409 conflict handling
 * - Skeleton loading state, error state with retry
 * - Redirects to /my-trips on successful booking
 *
 * @example
 * ```
 * // URL: /trip/sched_abc123?date=2026-04-01
 * <TripDetailPage />
 * ```
 */
export default function TripDetailPage() {
  const { t } = useTranslation('search');
  usePageTitle(t('tripDetail.pageTitle'));
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const date = searchParams.get('date') ?? '';

  const { data, isLoading, isError, refetch } = useTripDetails({
    scheduleId: id ?? '',
    date,
  });

  const trip = data?.data;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <Link
        to="/search"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t('tripDetail.backToSearch')}
      </Link>

      <h1 className="mb-6 text-2xl font-bold">{t('tripDetail.heading')}</h1>

      {isLoading && <TripDetailSkeleton />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {trip && <TripDetailContent trip={trip} />}
    </div>
  );
}
