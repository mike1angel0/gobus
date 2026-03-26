import { useState, useMemo } from 'react';
import { Luggage, AlertCircle } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { BookingCard } from '@/components/booking/booking-card';
import { useBookings } from '@/hooks/use-bookings';
import type { components } from '@/api/generated/types';

type Booking = components['schemas']['Booking'];

/** Number of bookings to fetch per page. */
const PAGE_SIZE = 10;

/** Active tab on the my-trips page. */
type Tab = 'upcoming' | 'past';

/**
 * Checks whether a booking's trip date is in the future or today.
 * Compares date strings (YYYY-MM-DD portion) to avoid timezone issues.
 */
function isFutureOrToday(tripDate: string): boolean {
  const trip = new Date(tripDate);
  const today = new Date();
  // Compare date portion only
  trip.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return trip >= today;
}

/**
 * Splits bookings into upcoming and past categories.
 * - Upcoming: CONFIRMED bookings with future/today trip date
 * - Past: COMPLETED, CANCELLED, or CONFIRMED with past trip date
 */
function splitBookings(bookings: Booking[]): { upcoming: Booking[]; past: Booking[] } {
  const upcoming: Booking[] = [];
  const past: Booking[] = [];

  for (const booking of bookings) {
    if (booking.status === 'CONFIRMED' && isFutureOrToday(booking.tripDate)) {
      upcoming.push(booking);
    } else {
      past.push(booking);
    }
  }

  return { upcoming, past };
}

/** Renders skeleton cards during loading. */
function BookingSkeleton() {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-6 w-20" />
      </div>
      <div className="mt-3 flex gap-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-28" />
      </div>
    </Card>
  );
}

/** Skeleton list shown during loading. */
function LoadingSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading bookings">
      {Array.from({ length: 3 }, (_, i) => (
        <BookingSkeleton key={i} />
      ))}
    </div>
  );
}

/** Empty state when no bookings exist. */
function EmptyState() {
  return (
    <div className="flex flex-col items-center py-16 text-center" role="status">
      <Luggage className="mb-4 h-16 w-16 text-muted-foreground" aria-hidden="true" />
      <h2 className="mb-2 text-xl font-semibold">No trips yet</h2>
      <p className="mb-6 max-w-md text-muted-foreground">
        You haven&apos;t booked any trips. Search for a trip to get started!
      </p>
      <Button variant="outline" asChild>
        <a href="/search">Search trips</a>
      </Button>
    </div>
  );
}

/** Props for the {@link ErrorState} component. */
interface ErrorStateProps {
  /** Callback invoked when the user clicks retry. */
  onRetry: () => void;
}

/** Error state shown when fetching bookings fails. */
function ErrorState({ onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center py-16 text-center" role="alert">
      <AlertCircle className="mb-4 h-16 w-16 text-destructive" aria-hidden="true" />
      <h2 className="mb-2 text-xl font-semibold">Something went wrong</h2>
      <p className="mb-6 max-w-md text-muted-foreground">
        We couldn&apos;t load your bookings. Please try again.
      </p>
      <Button onClick={onRetry} variant="outline">
        Try again
      </Button>
    </div>
  );
}

/** Props for the tab button. */
interface TabButtonProps {
  /** Whether this tab is currently active. */
  active: boolean;
  /** Callback when tab is clicked. */
  onClick: () => void;
  /** Label text. */
  label: string;
  /** Count badge number. */
  count: number;
}

/** Single tab button for the upcoming/past toggle. */
function TabButton({ active, onClick, label, count }: TabButtonProps) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground'
      }`}
    >
      {label}
      <span
        className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-medium ${
          active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
        }`}
      >
        {count}
      </span>
    </button>
  );
}

/** Props for the {@link BookingList} component. */
interface BookingListProps {
  /** Bookings to render. */
  bookings: Booking[];
  /** Whether these are upcoming or past bookings. */
  variant: Tab;
}

/** Renders a list of booking cards. */
function BookingList({ bookings, variant }: BookingListProps) {
  return (
    <ol className="space-y-4" aria-label={`${variant === 'upcoming' ? 'Upcoming' : 'Past'} bookings`}>
      {bookings.map((booking) => (
        <li key={booking.id}>
          <BookingCard booking={booking} variant={variant} />
        </li>
      ))}
    </ol>
  );
}

/** Props for the {@link MyTripsContent} component. */
interface MyTripsContentProps {
  /** Whether the query is loading. */
  isLoading: boolean;
  /** Whether the query errored. */
  isError: boolean;
  /** Retry callback. */
  onRetry: () => void;
  /** Upcoming bookings to display. */
  upcoming: Booking[];
  /** Past bookings to display. */
  past: Booking[];
  /** Current active tab. */
  activeTab: Tab;
  /** Whether more pages are available. */
  hasMore: boolean;
  /** Load more callback. */
  onLoadMore: () => void;
}

/** Renders the correct content based on the current state. */
function MyTripsContent({
  isLoading,
  isError,
  onRetry,
  upcoming,
  past,
  activeTab,
  hasMore,
  onLoadMore,
}: MyTripsContentProps) {
  if (isLoading && upcoming.length === 0 && past.length === 0) {
    return <LoadingSkeleton />;
  }

  if (isError && upcoming.length === 0 && past.length === 0) {
    return <ErrorState onRetry={onRetry} />;
  }

  if (upcoming.length === 0 && past.length === 0) {
    return <EmptyState />;
  }

  const bookings = activeTab === 'upcoming' ? upcoming : past;

  if (bookings.length === 0) {
    return (
      <div className="flex flex-col items-center py-12 text-center" role="status">
        <p className="text-muted-foreground">
          {activeTab === 'upcoming' ? 'No upcoming trips' : 'No past trips'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <BookingList bookings={bookings} variant={activeTab} />
      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={onLoadMore} disabled={isLoading}>
            {isLoading ? 'Loading...' : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * My trips page that displays the authenticated user's bookings in two tabs:
 * Upcoming (CONFIRMED + future/today date) and Past (COMPLETED/CANCELLED/past).
 *
 * Features:
 * - Tab-based split of upcoming and past bookings
 * - Expandable booking cards with schedule details and live tracking map
 * - Cancel button with confirmation dialog for upcoming bookings
 * - Load more pagination
 * - Skeleton loading, empty state, and error state with retry
 *
 * @example
 * ```
 * // Route: /my-trips (requires authentication via AuthGuard)
 * <MyTripsPage />
 * ```
 */
export default function MyTripsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('upcoming');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useBookings({
    page: 1,
    pageSize: page * PAGE_SIZE,
  });

  const meta = data?.meta;
  const hasMore = meta ? meta.page * meta.pageSize < meta.total : false;

  const { upcoming, past } = useMemo(() => splitBookings(data?.data ?? []), [data?.data]);

  const handleLoadMore = () => {
    setPage((p) => p + 1);
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">My trips</h1>

      <div role="tablist" aria-label="Trip categories" className="mb-6 flex border-b">
        <TabButton
          active={activeTab === 'upcoming'}
          onClick={() => setActiveTab('upcoming')}
          label="Upcoming"
          count={upcoming.length}
        />
        <TabButton
          active={activeTab === 'past'}
          onClick={() => setActiveTab('past')}
          label="Past"
          count={past.length}
        />
      </div>

      <MyTripsContent
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        upcoming={upcoming}
        past={past}
        activeTab={activeTab}
        hasMore={hasMore}
        onLoadMore={handleLoadMore}
      />
    </div>
  );
}
