import { AlertCircle, UserCheck, Users } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { components } from '@/api/generated/types';

type DriverTripPassenger = components['schemas']['DriverTripPassenger'];

/** Props for the {@link PassengerList} component. */
export interface PassengerListProps {
  /** List of passengers for the trip. */
  passengers: DriverTripPassenger[] | undefined;
  /** Total seat capacity for the bus. */
  totalSeats: number;
  /** Whether the passenger data is loading. */
  isLoading: boolean;
  /** Whether the passenger query errored. */
  isError: boolean;
  /** Retry callback when loading fails. */
  onRetry: () => void;
}

/* ---------- Loading Skeleton ---------- */

/** Skeleton placeholder shown while passenger data loads. */
function PassengerListSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading passengers">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/* ---------- Error State ---------- */

/** Props for {@link PassengerListError}. */
interface PassengerListErrorProps {
  /** Retry callback. */
  onRetry: () => void;
}

/** Error state shown when passenger data fails to load. */
function PassengerListError({ onRetry }: PassengerListErrorProps) {
  return (
    <div className="flex flex-col items-center py-6 text-center" role="alert">
      <AlertCircle className="mb-2 h-10 w-10 text-destructive" aria-hidden="true" />
      <p className="mb-3 text-sm text-muted-foreground">Failed to load passenger list</p>
      <Button onClick={onRetry} variant="outline" size="sm">
        Try again
      </Button>
    </div>
  );
}

/* ---------- Empty State ---------- */

/** Empty state when no passengers are booked. */
function PassengerListEmpty() {
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <Users className="mb-2 h-10 w-10 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">No passengers booked for this trip</p>
    </div>
  );
}

/* ---------- Passenger Row ---------- */

/** Props for {@link PassengerRow}. */
interface PassengerRowProps {
  /** Passenger data. */
  passenger: DriverTripPassenger;
}

/** Single passenger row displaying name, stops, seats, and status. */
function PassengerRow({ passenger }: PassengerRowProps) {
  const isCancelled = passenger.status === 'CANCELLED';

  return (
    <li className="flex items-start gap-3 rounded-md px-2 py-2">
      <UserCheck
        className={`mt-0.5 h-5 w-5 shrink-0 ${isCancelled ? 'text-muted-foreground' : 'text-green-600'}`}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${isCancelled ? 'text-muted-foreground line-through' : ''}`}>
          {passenger.passengerName}
        </p>
        <p className="text-xs text-muted-foreground">
          {passenger.boardingStop} → {passenger.alightingStop}
        </p>
        {passenger.seatLabels.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Seats: {passenger.seatLabels.join(', ')}
          </p>
        )}
      </div>
      <Badge
        variant={isCancelled ? 'destructive' : 'default'}
        className="shrink-0"
      >
        {passenger.status}
      </Badge>
    </li>
  );
}

/* ---------- Content Resolver ---------- */

/** Props for {@link PassengerListContent}. */
interface PassengerListContentProps {
  /** Passenger list data. */
  passengers: DriverTripPassenger[] | undefined;
  /** Whether data is loading. */
  isLoading: boolean;
  /** Whether the query errored. */
  isError: boolean;
  /** Retry callback. */
  onRetry: () => void;
}

/** Resolves which content to show based on loading/error/data state. */
function PassengerListContent({ passengers, isLoading, isError, onRetry }: PassengerListContentProps) {
  if (isLoading) return <PassengerListSkeleton />;
  if (isError) return <PassengerListError onRetry={onRetry} />;
  if (!passengers || passengers.length === 0) return <PassengerListEmpty />;

  return (
    <ul className="space-y-1" aria-label="Passenger list">
      {passengers.map((passenger) => (
        <PassengerRow key={passenger.bookingId} passenger={passenger} />
      ))}
    </ul>
  );
}

/* ---------- Main Component ---------- */

/**
 * Displays the passenger manifest for a driver's trip.
 *
 * Shows each passenger's name, boarding/alighting stops, seat labels, and
 * booking status. Includes a count header, loading skeleton, error state
 * with retry, and empty state.
 *
 * @param props - {@link PassengerListProps}
 *
 * @example
 * ```tsx
 * <PassengerList
 *   passengers={passengers}
 *   totalSeats={40}
 *   isLoading={false}
 *   isError={false}
 *   onRetry={refetch}
 * />
 * ```
 */
export function PassengerList({
  passengers,
  totalSeats,
  isLoading,
  isError,
  onRetry,
}: PassengerListProps) {
  const showCount = !isLoading && !isError && !!passengers;
  const confirmedCount = passengers?.filter((p) => p.status === 'CONFIRMED').length ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5" aria-hidden="true" />
          Passengers
          {showCount && (
            <span className="text-sm font-normal text-muted-foreground">
              ({confirmedCount} / {totalSeats})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <PassengerListContent
          passengers={passengers}
          isLoading={isLoading}
          isError={isError}
          onRetry={onRetry}
        />
      </CardContent>
    </Card>
  );
}
