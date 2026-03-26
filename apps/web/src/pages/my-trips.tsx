import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Luggage } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { CardListSkeleton } from '@/components/shared/loading-skeleton';
import { PageError } from '@/components/shared/error-state';
import { EmptyState } from '@/components/shared/empty-state';
import { BookingCard } from '@/components/booking/booking-card';
import { useBookings } from '@/hooks/use-bookings';
import { usePageTitle } from '@/hooks/use-page-title';
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
  const { t } = useTranslation('booking');
  return (
    <ol
      className="space-y-4"
      aria-label={variant === 'upcoming' ? t('myTrips.upcomingAriaLabel') : t('myTrips.pastAriaLabel')}
    >
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
  const { t } = useTranslation('booking');

  if (isLoading && upcoming.length === 0 && past.length === 0) {
    return <CardListSkeleton label={t('loading')} />;
  }

  if (isError && upcoming.length === 0 && past.length === 0) {
    return (
      <PageError
        title={t('error.title')}
        message={t('error.message')}
        onRetry={onRetry}
      />
    );
  }

  if (upcoming.length === 0 && past.length === 0) {
    return (
      <EmptyState
        icon={Luggage}
        title={t('myTrips.noTrips')}
        message={t('myTrips.noTripsMessage')}
        action={{ label: t('myTrips.searchTrips'), href: '/search' }}
      />
    );
  }

  const bookings = activeTab === 'upcoming' ? upcoming : past;

  if (bookings.length === 0) {
    return (
      <div className="flex flex-col items-center py-12 text-center" role="status">
        <p className="text-muted-foreground">
          {activeTab === 'upcoming' ? t('myTrips.noUpcoming') : t('myTrips.noPast')}
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
            {isLoading ? t('myTrips.loadingMore') : t('myTrips.loadMore')}
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
  const { t } = useTranslation('booking');
  usePageTitle(t('myTrips.pageTitle'));
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
      <h1 className="mb-6 text-2xl font-bold">{t('myTrips.heading')}</h1>

      <div role="tablist" aria-label={t('myTrips.tabsAriaLabel')} className="mb-6 flex border-b">
        <TabButton
          active={activeTab === 'upcoming'}
          onClick={() => setActiveTab('upcoming')}
          label={t('myTrips.upcoming')}
          count={upcoming.length}
        />
        <TabButton
          active={activeTab === 'past'}
          onClick={() => setActiveTab('past')}
          label={t('myTrips.past')}
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
