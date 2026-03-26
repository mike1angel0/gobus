import { useSearchParams } from 'react-router-dom';
import { AlertCircle, SearchX } from 'lucide-react';
import { SearchForm } from '@/components/search/search-form';
import { TripCard } from '@/components/search/trip-card';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSearchTrips } from '@/hooks/use-search';
import type { components } from '@/api/generated/types';

type SearchResult = components['schemas']['SearchResult'];

/**
 * Renders a single skeleton card mimicking the TripCard layout during loading.
 */
function TripCardSkeleton() {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-6 w-20" />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="space-y-1 text-center">
          <Skeleton className="h-6 w-14" />
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="flex flex-1 flex-col items-center gap-1">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-px w-full" />
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="space-y-1 text-center">
          <Skeleton className="h-6 w-14" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <div className="mt-3">
        <Skeleton className="h-4 w-28" />
      </div>
    </Card>
  );
}

/**
 * Skeleton list shown while search results are loading.
 */
function ResultsSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading search results">
      {Array.from({ length: 3 }, (_, i) => (
        <TripCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Empty state shown when search returns no results.
 */
function EmptyState() {
  return (
    <div className="flex flex-col items-center py-16 text-center" role="status">
      <SearchX className="mb-4 h-16 w-16 text-muted-foreground" aria-hidden="true" />
      <h2 className="mb-2 text-xl font-semibold">No trips found</h2>
      <p className="mb-6 max-w-md text-muted-foreground">
        We couldn&apos;t find any trips matching your search. Try different cities or another date.
      </p>
    </div>
  );
}

/** Props for the {@link ErrorState} component. */
interface ErrorStateProps {
  /** Callback invoked when the user clicks the retry button. */
  onRetry: () => void;
}

/**
 * Error state shown when the search request fails.
 */
function ErrorState({ onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center py-16 text-center" role="alert">
      <AlertCircle className="mb-4 h-16 w-16 text-destructive" aria-hidden="true" />
      <h2 className="mb-2 text-xl font-semibold">Something went wrong</h2>
      <p className="mb-6 max-w-md text-muted-foreground">
        We couldn&apos;t load search results. Please try again.
      </p>
      <Button onClick={onRetry} variant="outline">
        Try again
      </Button>
    </div>
  );
}

/**
 * Prompt shown when no search params are provided.
 */
function NoParamsState() {
  return (
    <div className="flex flex-col items-center py-16 text-center" role="status">
      <SearchX className="mb-4 h-16 w-16 text-muted-foreground" aria-hidden="true" />
      <h2 className="mb-2 text-xl font-semibold">Search for trips</h2>
      <p className="max-w-md text-muted-foreground">
        Enter your origin, destination, and travel date above to find available trips.
      </p>
    </div>
  );
}

/** Props for the {@link ResultsList} component. */
interface ResultsListProps {
  /** Array of trip search results to display. */
  results: SearchResult[];
}

/**
 * Renders the list of trip search results with a count header.
 */
function ResultsList({ results }: ResultsListProps) {
  return (
    <div className="space-y-4" aria-label="Search results">
      <p className="text-sm text-muted-foreground">
        {results.length} {results.length === 1 ? 'trip' : 'trips'} found
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
  if (!hasParams) {
    return <NoParamsState />;
  }

  if (isLoading) {
    return <ResultsSkeleton />;
  }

  if (isError) {
    return <ErrorState onRetry={onRetry} />;
  }

  if (results.length === 0) {
    return <EmptyState />;
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
      <h1 className="mb-6 text-2xl font-bold">Search trips</h1>

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
