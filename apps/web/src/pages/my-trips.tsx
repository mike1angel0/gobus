import { useState, useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Luggage } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { CardListSkeleton } from '@/components/shared/loading-skeleton';
import { PageError } from '@/components/shared/error-state';
import { EmptyState } from '@/components/shared/empty-state';
import { BookingCard } from '@/components/booking/booking-card';
import { useApiClient } from '@/api/hooks';
import { bookingKeys } from '@/api/keys';
import { useBookings } from '@/hooks/use-bookings';
import { usePageTitle } from '@/hooks/use-page-title';
import type { components } from '@/api/generated/types';

type Booking = components['schemas']['Booking'];
type BookingDetail = components['schemas']['BookingWithDetails'];

/** Number of bookings to fetch per page. */
const PAGE_SIZE = 10;

/** Active tab on the my-trips page. */
type Tab = 'active' | 'upcoming' | 'past';

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

/** Returns today's date in YYYY-MM-DD using local time. */
function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Derives the correct booking bucket from booking status and optional schedule timing.
 */
function deriveBookingBucket(
  booking: Booking,
  detail?: BookingDetail,
): 'active' | 'upcoming' | 'past' {
  if (booking.status === 'COMPLETED' || booking.status === 'CANCELLED') return 'past';

  if (detail) {
    const now = new Date();
    const departure = new Date(detail.schedule.departureTime);
    const arrival = new Date(detail.schedule.arrivalTime);

    if (now >= departure && now <= arrival) return 'active';
    if (now < departure) return 'upcoming';
    return 'past';
  }

  return isFutureOrToday(booking.tripDate) ? 'upcoming' : 'past';
}

/** Splits bookings into active, upcoming, and past categories. */
function splitBookings(
  bookings: Booking[],
  detailsById: Map<string, BookingDetail>,
): { active: Booking[]; upcoming: Booking[]; past: Booking[] } {
  const active: Booking[] = [];
  const upcoming: Booking[] = [];
  const past: Booking[] = [];

  for (const booking of bookings) {
    const bucket = deriveBookingBucket(booking, detailsById.get(booking.id));

    if (bucket === 'active') {
      active.push(booking);
    } else if (bucket === 'upcoming') {
      upcoming.push(booking);
    } else {
      past.push(booking);
    }
  }

  return { active, upcoming, past };
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
  /** Which booking bucket is being rendered. */
  variant: Tab;
}

/** Renders a list of booking cards. */
function BookingList({ bookings, variant }: BookingListProps) {
  const { t } = useTranslation('booking');
  return (
    <ol
      className="space-y-4"
      aria-label={t(`myTrips.${variant}AriaLabel`)}
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
  /** Active bookings to display. */
  active: Booking[];
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
  active,
  upcoming,
  past,
  activeTab,
  hasMore,
  onLoadMore,
}: MyTripsContentProps) {
  const { t } = useTranslation('booking');

  if (isLoading && active.length === 0 && upcoming.length === 0 && past.length === 0) {
    return <CardListSkeleton label={t('loading')} />;
  }

  if (isError && active.length === 0 && upcoming.length === 0 && past.length === 0) {
    return <PageError title={t('error.title')} message={t('error.message')} onRetry={onRetry} />;
  }

  if (active.length === 0 && upcoming.length === 0 && past.length === 0) {
    return (
      <EmptyState
        icon={Luggage}
        title={t('myTrips.noTrips')}
        message={t('myTrips.noTripsMessage')}
        action={{ label: t('myTrips.searchTrips'), href: '/search' }}
      />
    );
  }

  const bookings = activeTab === 'active' ? active : activeTab === 'upcoming' ? upcoming : past;

  if (bookings.length === 0) {
    const emptyKey =
      activeTab === 'active'
        ? 'myTrips.noActive'
        : activeTab === 'upcoming'
          ? 'myTrips.noUpcoming'
          : 'myTrips.noPast';
    return (
      <div className="flex flex-col items-center py-12 text-center" role="status">
        <p className="text-muted-foreground">{t(emptyKey)}</p>
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
  const client = useApiClient();
  usePageTitle(t('myTrips.pageTitle'));
  const [activeTab, setActiveTab] = useState<Tab>('active');
  const [hasManualTabSelection, setHasManualTabSelection] = useState(false);
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useBookings({
    page: 1,
    pageSize: page * PAGE_SIZE,
  });

  const meta = data?.meta;
  const hasMore = meta ? meta.page * meta.pageSize < meta.total : false;
  const bookings = data?.data ?? [];
  const today = getTodayDateString();

  const activeCandidateIds = useMemo(
    () =>
      bookings
        .filter((booking) => booking.status === 'CONFIRMED' && booking.tripDate === today)
        .map((booking) => booking.id),
    [bookings, today],
  );

  const detailQueries = useQueries({
    queries: activeCandidateIds.map((id) => ({
      queryKey: bookingKeys.detail(id),
      queryFn: async () => {
        const { data } = await client.GET('/api/v1/bookings/{id}', {
          params: { path: { id } },
        });
        return data;
      },
      staleTime: 30 * 1000,
    })),
  });

  const detailsById = useMemo(() => {
    const map = new Map<string, BookingDetail>();
    activeCandidateIds.forEach((id, index) => {
      const detail = detailQueries[index]?.data?.data;
      if (detail) map.set(id, detail);
    });
    return map;
  }, [activeCandidateIds, detailQueries]);

  const { active, upcoming, past } = useMemo(
    () => splitBookings(bookings, detailsById),
    [bookings, detailsById],
  );
  const effectiveTab: Tab =
    !hasManualTabSelection && activeTab === 'active' && active.length === 0
      ? upcoming.length > 0
        ? 'upcoming'
        : 'past'
      : activeTab;

  const handleLoadMore = () => {
    setPage((p) => p + 1);
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">{t('myTrips.heading')}</h1>

      <div role="tablist" aria-label={t('myTrips.tabsAriaLabel')} className="mb-6 flex border-b">
        <TabButton
          active={effectiveTab === 'active'}
          onClick={() => {
            setHasManualTabSelection(true);
            setActiveTab('active');
          }}
          label={t('myTrips.active')}
          count={active.length}
        />
        <TabButton
          active={effectiveTab === 'upcoming'}
          onClick={() => {
            setHasManualTabSelection(true);
            setActiveTab('upcoming');
          }}
          label={t('myTrips.upcoming')}
          count={upcoming.length}
        />
        <TabButton
          active={effectiveTab === 'past'}
          onClick={() => {
            setHasManualTabSelection(true);
            setActiveTab('past');
          }}
          label={t('myTrips.past')}
          count={past.length}
        />
      </div>

      <MyTripsContent
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        active={active}
        upcoming={upcoming}
        past={past}
        activeTab={effectiveTab}
        hasMore={hasMore}
        onLoadMore={handleLoadMore}
      />
    </div>
  );
}
