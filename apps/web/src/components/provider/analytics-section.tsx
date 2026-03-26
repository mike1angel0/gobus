import { BarChart3, DollarSign, TrendingUp, Users } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageError } from '@/components/shared/error-state';
import type { components } from '@/api/generated/types';

type ProviderAnalytics = components['schemas']['ProviderAnalytics'];
type RevenueByRoute = components['schemas']['RevenueByRoute'];

/** Props for the {@link AnalyticsSection} component. */
interface AnalyticsSectionProps {
  /** Analytics data, undefined while loading. */
  data: ProviderAnalytics | undefined;
  /** Whether data is currently loading. */
  isLoading: boolean;
  /** Whether the query errored. */
  isError: boolean;
  /** Retry callback for failed queries. */
  onRetry: () => void;
}

/** Formats a number as USD currency string. */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Formats occupancy ratio (0-1) as a percentage string. */
function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/** Skeleton loader for the analytics stat cards. */
function AnalyticsStatsSkeleton() {
  return (
    <div
      className="grid gap-4 sm:grid-cols-3"
      aria-busy="true"
      aria-label="Loading analytics"
    >
      {Array.from({ length: 3 }, (_, i) => (
        <Card key={i}>
          <CardContent className="flex items-center gap-4 p-6">
            <Skeleton className="h-12 w-12 rounded-lg" />
            <div>
              <Skeleton className="mb-1 h-8 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Skeleton loader for the revenue-by-route table. */
function RevenueTableSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading revenue by route">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="flex items-center justify-between border-b border-border/50 py-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

/** Props for the {@link RevenueBar} component. */
interface RevenueBarProps {
  /** Route revenue entry. */
  route: RevenueByRoute;
  /** Maximum revenue across all routes (for bar width scaling). */
  maxRevenue: number;
}

/** A single row in the revenue-by-route breakdown with a proportional bar. */
function RevenueBar({ route, maxRevenue }: RevenueBarProps) {
  const widthPercent = maxRevenue > 0 ? (route.revenue / maxRevenue) * 100 : 0;

  return (
    <div className="py-2">
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="truncate font-medium" title={route.routeName}>
          {route.routeName}
        </span>
        <span className="ml-4 shrink-0 text-muted-foreground">
          {formatCurrency(route.revenue)}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted">
        <div
          className="h-2 rounded-full bg-primary"
          style={{ width: `${widthPercent}%` }}
          role="meter"
          aria-label={`${route.routeName} revenue`}
          aria-valuenow={route.revenue}
          aria-valuemin={0}
          aria-valuemax={maxRevenue}
        />
      </div>
    </div>
  );
}

/**
 * Analytics section for the provider dashboard.
 *
 * Shows three stat cards (total bookings, total revenue, average occupancy)
 * and a revenue-by-route breakdown with horizontal bars.
 * Handles loading, error, and empty states.
 */
export function AnalyticsSection({ data, isLoading, isError, onRetry }: AnalyticsSectionProps) {
  if (isError) {
    return (
      <section aria-labelledby="analytics-heading" className="mb-8">
        <h2 id="analytics-heading" className="mb-4 text-lg font-semibold">
          Analytics
        </h2>
        <PageError
          title="Analytics unavailable"
          message="We couldn't load your analytics data. Please try again."
          onRetry={onRetry}
        />
      </section>
    );
  }

  return (
    <section aria-labelledby="analytics-heading" className="mb-8">
      <h2 id="analytics-heading" className="mb-4 text-lg font-semibold">
        Analytics
      </h2>

      {isLoading ? (
        <AnalyticsStatsSkeleton />
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                <TrendingUp className="h-6 w-6 text-blue-500" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-3xl font-bold">{data?.totalBookings ?? 0}</p>
                <p className="text-sm text-muted-foreground">Total bookings</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-green-500/10">
                <DollarSign className="h-6 w-6 text-green-500" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-3xl font-bold">{formatCurrency(data?.totalRevenue ?? 0)}</p>
                <p className="text-sm text-muted-foreground">Total revenue</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-purple-500/10">
                <Users className="h-6 w-6 text-purple-500" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-3xl font-bold">{formatPercent(data?.averageOccupancy ?? 0)}</p>
                <p className="text-sm text-muted-foreground">Avg. occupancy</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" aria-hidden="true" />
            Revenue by route
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <RevenueTableSkeleton />
          ) : !data?.revenueByRoute || data.revenueByRoute.length === 0 ? (
            <div className="flex flex-col items-center py-6 text-center" role="status">
              <BarChart3
                className="mb-2 h-8 w-8 text-muted-foreground"
                aria-hidden="true"
              />
              <p className="text-sm text-muted-foreground">No revenue data yet</p>
            </div>
          ) : (
            <div aria-label="Revenue by route breakdown">
              {(() => {
                const maxRevenue = Math.max(...data.revenueByRoute.map((r) => r.revenue));
                return data.revenueByRoute.map((route) => (
                  <RevenueBar key={route.routeId} route={route} maxRevenue={maxRevenue} />
                ));
              })()}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
