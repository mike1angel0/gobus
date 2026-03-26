import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  MapPin,
  Clock,
  Bus,
  Users,
  AlertCircle,
  Navigation,
  CheckCircle2,
  Circle,
  ChevronLeft,
  AlertTriangle,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useDriverTripDetail, useDriverTripPassengers } from '@/hooks/use-driver-trips';
import { PassengerList } from '@/components/driver/passenger-list';
import { useUpdateTracking } from '@/hooks/use-provider-tracking';
import { useToast } from '@/hooks/use-toast';
import { LiveMap } from '@/components/maps/live-map';
import type { BusPosition, MapStop } from '@/components/maps/live-map';
import type { components } from '@/api/generated/types';

type DriverTripDetail = components['schemas']['DriverTripDetail'];
type StopTime = components['schemas']['StopTime'];

/** GPS posting interval in milliseconds. */
const GPS_INTERVAL_MS = 5_000;

/* ---------- Loading Skeleton ---------- */

/** Skeleton placeholder shown while trip detail loads. */
function TripDetailSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading trip details">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full rounded-lg" />
      <Skeleton className="h-10 w-full" />
      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}

/* ---------- Error State ---------- */

/** Props for {@link TripDetailError}. */
interface TripDetailErrorProps {
  /** Retry callback. */
  onRetry: () => void;
}

/** Error state shown when trip detail fails to load. */
function TripDetailError({ onRetry }: TripDetailErrorProps) {
  return (
    <div className="flex flex-col items-center py-16 text-center" role="alert">
      <AlertCircle className="mb-4 h-16 w-16 text-destructive" aria-hidden="true" />
      <h2 className="mb-2 text-xl font-semibold">Failed to load trip details</h2>
      <p className="mb-6 max-w-md text-muted-foreground">
        We couldn&apos;t load the trip information. Please try again.
      </p>
      <Button onClick={onRetry} variant="outline">
        Try again
      </Button>
    </div>
  );
}

/* ---------- Stop Progress Tracker ---------- */

/** Props for {@link StopProgressTracker}. */
interface StopProgressTrackerProps {
  /** Ordered list of stops. */
  stops: StopTime[];
  /** Index of the current stop (0-based). Stops before this index are marked as passed. */
  currentStopIndex: number;
  /** Callback when driver taps "Arrived" on the next stop. */
  onAdvance: () => void;
  /** Whether the advance action is pending. */
  isAdvancing: boolean;
}

/** Displays an ordered list of stops with check marks for passed stops. */
function StopProgressTracker({
  stops,
  currentStopIndex,
  onAdvance,
  isAdvancing,
}: StopProgressTrackerProps) {
  const sortedStops = [...stops].sort((a, b) => a.orderIndex - b.orderIndex);
  const isLastStop = currentStopIndex >= sortedStops.length - 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Stop Progress</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-3" aria-label="Stop progress">
          {sortedStops.map((stop, idx) => {
            const isPassed = idx < currentStopIndex;
            const isCurrent = idx === currentStopIndex;
            const time = format(new Date(stop.arrivalTime), 'HH:mm');

            return (
              <li
                key={stop.id}
                className={`flex items-center gap-3 rounded-md px-2 py-1.5 ${
                  isCurrent ? 'bg-primary/10' : ''
                }`}
                aria-current={isCurrent ? 'step' : undefined}
              >
                {isPassed ? (
                  <CheckCircle2
                    className="h-5 w-5 shrink-0 text-green-600"
                    aria-label="Passed"
                  />
                ) : isCurrent ? (
                  <Navigation
                    className="h-5 w-5 shrink-0 text-primary"
                    aria-label="Current stop"
                  />
                ) : (
                  <Circle
                    className="h-5 w-5 shrink-0 text-muted-foreground"
                    aria-label="Upcoming"
                  />
                )}
                <span className={`flex-1 text-sm ${isPassed ? 'text-muted-foreground line-through' : 'font-medium'}`}>
                  {stop.stopName}
                </span>
                <span className="text-xs text-muted-foreground">{time}</span>
              </li>
            );
          })}
        </ol>

        {!isLastStop && (
          <Button
            className="mt-4 w-full"
            onClick={onAdvance}
            disabled={isAdvancing}
            aria-label={`Arrived at ${sortedStops[currentStopIndex + 1]?.stopName ?? 'next stop'}`}
          >
            <MapPin className="mr-2 h-4 w-4" aria-hidden="true" />
            {isAdvancing ? 'Updating...' : 'Arrived at Next Stop'}
          </Button>
        )}

        {isLastStop && (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            All stops completed
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------- Location Sharing Toggle ---------- */

/** Geolocation permission state. */
type GeoPermission = 'prompt' | 'granted' | 'denied' | 'unavailable';

/** Props for {@link LocationSharingToggle}. */
interface LocationSharingToggleProps {
  /** Whether location sharing is currently active. */
  isSharing: boolean;
  /** Callback to toggle sharing on/off. */
  onToggle: () => void;
  /** Current geolocation permission state. */
  permission: GeoPermission;
}

/** Toggle button for starting/stopping location sharing. */
function LocationSharingToggle({ isSharing, onToggle, permission }: LocationSharingToggleProps) {
  const isDisabled = permission === 'denied' || permission === 'unavailable';

  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <h3 className="font-medium">Location Sharing</h3>
          <p className="text-sm text-muted-foreground">
            {permission === 'denied'
              ? 'Location permission denied. Enable in browser settings.'
              : permission === 'unavailable'
                ? 'Geolocation is not available in this browser.'
                : isSharing
                  ? 'Sharing your live position'
                  : 'Share your location with passengers'}
          </p>
        </div>
        <Button
          variant={isSharing ? 'destructive' : 'default'}
          onClick={onToggle}
          disabled={isDisabled}
          aria-label={isSharing ? 'Stop sharing location' : 'Start sharing location'}
        >
          <Navigation className="mr-2 h-4 w-4" aria-hidden="true" />
          {isSharing ? 'Stop Sharing' : 'Start Sharing'}
        </Button>
      </CardContent>
    </Card>
  );
}

/* ---------- Trip Info Header ---------- */

/** Props for {@link TripInfoHeader}. */
interface TripInfoHeaderProps {
  /** Trip detail data. */
  trip: DriverTripDetail;
}

/** Displays trip route, times, bus, and passenger info. */
function TripInfoHeader({ trip }: TripInfoHeaderProps) {
  const depTime = format(new Date(trip.departureTime), 'HH:mm');
  const arrTime = format(new Date(trip.arrivalTime), 'HH:mm');
  const tripDate = format(new Date(trip.tripDate), 'MMM d, yyyy');

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-semibold">{trip.routeName}</h2>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
              trip.status === 'CANCELLED'
                ? 'bg-red-100 text-red-700'
                : 'bg-blue-100 text-blue-700'
            }`}
          >
            {trip.status}
          </span>
        </div>

        <dl className="mt-3 space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <dt className="sr-only">Date</dt>
            <dd>{tripDate}</dd>
          </div>
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
            <dd>
              {trip.busLicensePlate} · {trip.busModel}
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="sr-only">Passengers</dt>
            <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
            <dd>
              {trip.passengerCount} / {trip.totalSeats} passengers
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

/* ---------- Geolocation Hook ---------- */

/** Result from the {@link useGeolocation} hook. */
interface GeolocationState {
  /** Current position from GPS. */
  position: { lat: number; lng: number; heading: number; speed: number } | null;
  /** Permission state. */
  permission: GeoPermission;
  /** Whether watching is active. */
  isWatching: boolean;
  /** Start watching position. */
  startWatching: () => void;
  /** Stop watching position. */
  stopWatching: () => void;
}

/**
 * Custom hook that manages browser geolocation watching.
 *
 * Handles permission checks, starts/stops `watchPosition`, and cleans up on unmount.
 * Converts geolocation coords to the format needed for tracking updates.
 *
 * @returns Geolocation state including position, permission, and control functions.
 */
function useGeolocation(): GeolocationState {
  const [position, setPosition] = useState<GeolocationState['position']>(null);
  const [permission, setPermission] = useState<GeoPermission>(() =>
    typeof navigator !== 'undefined' && !navigator.geolocation ? 'unavailable' : 'prompt',
  );
  const [isWatching, setIsWatching] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  // Check initial permission state
  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.permissions?.query({ name: 'geolocation' }).then((result) => {
      setPermission(result.state as GeoPermission);
      result.addEventListener('change', () => {
        setPermission(result.state as GeoPermission);
      });
    }).catch(() => {
      // permissions API not supported, we'll know when we try
    });
  }, []);

  const startWatching = useCallback(() => {
    if (!navigator.geolocation) {
      setPermission('unavailable');
      return;
    }

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setPermission('granted');
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading: pos.coords.heading ?? 0,
          speed: pos.coords.speed != null ? Math.max(0, pos.coords.speed * 3.6) : 0, // m/s to km/h
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setPermission('denied');
        }
        setIsWatching(false);
      },
      { enableHighAccuracy: true, maximumAge: 3000 },
    );

    watchIdRef.current = id;
    setIsWatching(true);
  }, []);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsWatching(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return { position, permission, isWatching, startWatching, stopWatching };
}

/* ---------- GPS Posting Hook ---------- */

/**
 * Posts GPS position to the tracking endpoint at a fixed interval.
 *
 * Only active when `enabled` is true and position data is available.
 * Uses refs for non-visual state to avoid re-renders from interval ticks.
 *
 * @param params - Tracking parameters including busId, position, and interval.
 */
function useGpsPosting({
  busId,
  scheduleId,
  tripDate,
  position,
  currentStopIndex,
  enabled,
}: {
  busId: string | undefined;
  scheduleId: string;
  tripDate: string;
  position: { lat: number; lng: number; heading: number; speed: number } | null;
  currentStopIndex: number;
  enabled: boolean;
}) {
  const updateTracking = useUpdateTracking();
  const positionRef = useRef(position);
  const stopIndexRef = useRef(currentStopIndex);

  // Sync refs in effects to avoid lint warnings about render-time ref access
  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  useEffect(() => {
    stopIndexRef.current = currentStopIndex;
  }, [currentStopIndex]);

  useEffect(() => {
    if (!enabled || !busId) return;

    const intervalId = setInterval(() => {
      const pos = positionRef.current;
      if (!pos) return;

      updateTracking.mutate({
        busId,
        lat: pos.lat,
        lng: pos.lng,
        speed: pos.speed,
        heading: pos.heading,
        currentStopIndex: stopIndexRef.current,
        scheduleId,
        tripDate,
      });
    }, GPS_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [enabled, busId, scheduleId, tripDate, updateTracking]);
}

/* ---------- Page ---------- */

/**
 * Driver trip detail page.
 *
 * Displays route info, live map with current position, stop progress tracker
 * with manual advance, passenger count, location sharing toggle, and report
 * delay navigation. Uses browser geolocation API to post GPS to the tracking
 * endpoint every 5 seconds when sharing is enabled.
 *
 * Route: `/driver/trip/:id?date=YYYY-MM-DD` (requires DRIVER role)
 *
 * @example
 * ```tsx
 * <DriverTripDetailPage />
 * ```
 */
export default function DriverTripDetailPage() {
  const { id: scheduleId = '' } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const date = searchParams.get('date') ?? undefined;

  const { data, isLoading, isError, refetch } = useDriverTripDetail(scheduleId, date);
  const trip = data?.data;

  const {
    data: passengersData,
    isLoading: passengersLoading,
    isError: passengersError,
    refetch: refetchPassengers,
  } = useDriverTripPassengers(scheduleId, date);

  const [currentStopIndex, setCurrentStopIndex] = useState(0);
  const [isAdvancing, setIsAdvancing] = useState(false);

  const geo = useGeolocation();

  // busId from trip detail (spec gap: not yet in DriverTripDetail schema)
  const busId = (trip as Record<string, unknown> | undefined)?.busId as string | undefined;

  // Post GPS every 5s when sharing
  useGpsPosting({
    busId,
    scheduleId,
    tripDate: date ?? format(new Date(), 'yyyy-MM-dd'),
    position: geo.position,
    currentStopIndex,
    enabled: geo.isWatching && !!busId,
  });

  // Build map data
  const mapStops: MapStop[] = (trip?.stops ?? [])
    .filter((s) => s.lat != null && s.lng != null)
    .map((s) => ({
      name: s.stopName,
      lat: s.lat!,
      lng: s.lng!,
    }));

  const busPosition: BusPosition | undefined = geo.position
    ? { lat: geo.position.lat, lng: geo.position.lng, heading: geo.position.heading }
    : undefined;

  const handleToggleSharing = useCallback(() => {
    if (geo.isWatching) {
      geo.stopWatching();
      toast({ title: 'Location sharing stopped' });
    } else {
      geo.startWatching();
      toast({ title: 'Location sharing started', description: 'Passengers can now see your position.' });
    }
  }, [geo, toast]);

  const handleAdvanceStop = useCallback(() => {
    if (!trip) return;
    const sortedStops = [...trip.stops].sort((a, b) => a.orderIndex - b.orderIndex);
    if (currentStopIndex >= sortedStops.length - 1) return;

    setIsAdvancing(true);
    setCurrentStopIndex((prev) => prev + 1);
    toast({
      title: 'Stop updated',
      description: `Arrived at ${sortedStops[currentStopIndex + 1]?.stopName ?? 'next stop'}`,
    });
    setIsAdvancing(false);
  }, [trip, currentStopIndex, toast]);

  const handleReportDelay = useCallback(() => {
    navigate(`/driver/delay?scheduleId=${scheduleId}&date=${date ?? ''}`);
  }, [navigate, scheduleId, date]);

  const handleBack = useCallback(() => {
    navigate('/driver');
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-6">
        <h1 className="mb-6 text-2xl font-bold">Trip Details</h1>
        <TripDetailSkeleton />
      </div>
    );
  }

  if (isError || !trip) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-6">
        <h1 className="mb-6 text-2xl font-bold">Trip Details</h1>
        <TripDetailError onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-6">
      {/* Back button */}
      <div className="mb-4">
        <Button variant="ghost" size="sm" onClick={handleBack} aria-label="Back to trips list">
          <ChevronLeft className="mr-1 h-4 w-4" aria-hidden="true" />
          Back
        </Button>
      </div>

      <h1 className="mb-6 text-2xl font-bold">Trip Details</h1>

      <div className="space-y-4">
        {/* Trip info */}
        <TripInfoHeader trip={trip} />

        {/* Live Map */}
        <section aria-labelledby="map-heading">
          <h2 id="map-heading" className="sr-only">
            Live Map
          </h2>
          <div className="h-64 overflow-hidden rounded-lg">
            <LiveMap stops={mapStops} busPosition={busPosition} />
          </div>
        </section>

        {/* Location sharing */}
        <LocationSharingToggle
          isSharing={geo.isWatching}
          onToggle={handleToggleSharing}
          permission={geo.permission}
        />

        {/* Stop progress */}
        <section aria-labelledby="stops-heading">
          <h2 id="stops-heading" className="sr-only">
            Stop Progress
          </h2>
          <StopProgressTracker
            stops={trip.stops}
            currentStopIndex={currentStopIndex}
            onAdvance={handleAdvanceStop}
            isAdvancing={isAdvancing}
          />
        </section>

        {/* Passenger manifest */}
        <section aria-labelledby="passengers-heading">
          <h2 id="passengers-heading" className="sr-only">
            Passenger Manifest
          </h2>
          <PassengerList
            passengers={passengersData?.data}
            totalSeats={trip.totalSeats}
            isLoading={passengersLoading}
            isError={passengersError}
            onRetry={refetchPassengers}
          />
        </section>

        {/* Report delay */}
        <Button
          variant="outline"
          className="w-full"
          onClick={handleReportDelay}
          aria-label="Report a delay"
        >
          <AlertTriangle className="mr-2 h-4 w-4" aria-hidden="true" />
          Report Delay
        </Button>
      </div>
    </div>
  );
}
