import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SearchX } from 'lucide-react';
import { SearchForm } from '@/components/search/search-form';
import { TripCard } from '@/components/search/trip-card';
import { CardListSkeleton } from '@/components/shared/loading-skeleton';
import { PageError } from '@/components/shared/error-state';
import { EmptyState } from '@/components/shared/empty-state';
import { useSearchTrips } from '@/hooks/use-search';
import { usePageTitle } from '@/hooks/use-page-title';
import type { components } from '@/api/generated/types';

type SearchResult = components['schemas']['SearchResult'];

/** Props for the {@link ResultsList} component. */
interface ResultsListProps {
  /** Array of trip search results to display. */
  results: SearchResult[];
}

/**
 * Renders the list of trip search results with a count header.
 */
function ResultsList({ results }: ResultsListProps) {
  const { t } = useTranslation('search');
  return (
    <div className="space-y-4" aria-label={t('results.ariaLabel')}>
      <p className="text-sm text-muted-foreground">
        {t('results.tripsFound', { count: results.length })}
      </p>
      {results.map((trip) => (
        <TripCard key={`${trip.scheduleId}-${trip.tripDate}`} trip={trip} />
      ))}
    </div>
  );
}

/** Props for the {@link SearchContent} component. */
interface SearchContentProps {
  /** Whether the query has the minimum required params to search. */
  hasParams: boolean;
  /** Whether the search is currently loading. */
  isLoading: boolean;
  /** Whether the search resulted in an error. */
  isError: boolean;
  /** The search results (empty array if none). */
  results: SearchResult[];
  /** Callback to retry the search on error. */
  onRetry: () => void;
}

/**
 * Renders the appropriate content section based on the current search state.
 */
function SearchContent({ hasParams, isLoading, isError, results, onRetry }: SearchContentProps) {
  const { t } = useTranslation('search');

  if (!hasParams) {
    return (
      <EmptyState
        icon={SearchX}
        title={t('empty.title')}
        message={t('empty.message')}
      />
    );
  }

  if (isLoading) {
    return <CardListSkeleton label={t('loading')} />;
  }

  if (isError) {
    return (
      <PageError
        title={t('error.title')}
        message={t('error.message')}
        onRetry={onRetry}
      />
    );
  }

  if (results.length === 0) {
    return (
      <EmptyState
        icon={SearchX}
        title={t('results.noTrips')}
        message={t('results.noTripsMessage')}
      />
    );
  }

  return <ResultsList results={results} />;
}

/**
 * Search results page that reads query params, fetches matching trips, and
 * displays them as a list of {@link TripCard} components.
 *
 * Features:
 * - Reads `origin`, `destination`, and `date` from URL search params
 * - Displays a pre-filled {@link SearchForm} to modify the search
 * - Shows skeleton cards during loading (not a spinner)
 * - Empty state with illustration when no results are found
 * - Error state with retry button on fetch failure
 * - Auto-refetches when query params change (new React Query key)
 *
 * @example
 * ```
 * // URL: /search?origin=Berlin&destination=Prague&date=2026-04-01
 * <SearchPage />
 * ```
 */
export default function SearchPage() {
  const { t } = useTranslation('search');
  usePageTitle(t('pageTitle'));
  const [searchParams] = useSearchParams();

  const origin = searchParams.get('origin') ?? '';
  const destination = searchParams.get('destination') ?? '';
  const date = searchParams.get('date') ?? '';

  const { data, isLoading, isError, refetch } = useSearchTrips({
    origin,
    destination,
    date,
  });

  const results = data?.data ?? [];
  const hasParams = origin.length >= 2 && destination.length >= 2 && date.length > 0;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">{t('heading')}</h1>

      <SearchForm mode="full" className="mb-8" />

      <SearchContent
        hasParams={hasParams}
        isLoading={isLoading}
        isError={isError}
        results={results}
        onRetry={() => refetch()}
      />
    </div>
  );
}
