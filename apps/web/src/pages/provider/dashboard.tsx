import { Link } from 'react-router-dom';
import { Route, Bus, Users, Calendar, Plus, Clock, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { PageError } from '@/components/shared/error-state';
import { AnalyticsSection } from '@/components/provider/analytics-section';
import { useRoutes } from '@/hooks/use-routes';
import { useBuses } from '@/hooks/use-buses';
import { useDrivers } from '@/hooks/use-drivers';
import { useSchedules } from '@/hooks/use-schedules';
import { useProviderAnalytics } from '@/hooks/use-provider-analytics';
import { formatPrice } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { usePageTitle } from '@/hooks/use-page-title';
import type { components } from '@/api/generated/types';

type Schedule = components['schemas']['Schedule'];

/** Number of upcoming schedules to display on the dashboard. */
const UPCOMING_COUNT = 5;

/** Props for the {@link StatCard} component. */
interface StatCardProps {
  /** Icon element displayed in the card. */
  icon: React.ReactNode;
  /** Label describing the stat. */
  label: string;
  /** Numeric value to display. */
  value: number | undefined;
  /** Whether the data is loading. */
  isLoading: boolean;
  /** Link target when the card is clicked. */
  href: string;
}

/**
 * Dashboard summary card showing a single metric with icon, label, and value.
 * Links to the relevant management page.
 */
function StatCard({ icon, label, value, isLoading, href }: StatCardProps) {
  return (
    <Link to={href} className="group">
      <Card className="transition-colors group-hover:border-primary/50">
        <CardContent className="flex items-center gap-4 p-6">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            {icon}
          </div>
          <div className="min-w-0">
            {isLoading ? (
              <Skeleton className="mb-1 h-8 w-16" />
            ) : (
              <p className="text-3xl font-bold">{value ?? 0}</p>
            )}
            <p className="text-sm text-muted-foreground">{label}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

/** Props for the {@link ScheduleItem} component. */
interface ScheduleItemProps {
  /** Schedule data to display. */
  schedule: Schedule;
  /** Label for recurring schedules without a specific trip date. */
  recurringLabel: string;
}

/**
 * A single upcoming schedule row showing departure time, route info, and price.
 */
function ScheduleItem({ schedule, recurringLabel }: ScheduleItemProps) {
  const departure = new Date(schedule.departureTime);
  const arrival = new Date(schedule.arrivalTime);

  return (
    <li className="flex items-center gap-4 rounded-lg border border-border/50 p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Clock className="h-5 w-5 text-primary" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{format(departure, 'MMM d, yyyy')}</p>
        <p className="text-sm text-muted-foreground">
          {format(departure, 'HH:mm')} &mdash; {format(arrival, 'HH:mm')}
        </p>
      </div>
      <div className="text-right">
        <p className="font-semibold">{formatPrice(schedule.basePrice)}</p>
        <p className="text-xs text-muted-foreground">
          {schedule.tripDate ? format(new Date(schedule.tripDate), 'MMM d') : recurringLabel}
        </p>
      </div>
    </li>
  );
}

/** Renders skeleton placeholders for the stats grid. */
function StatsSkeleton({ label }: { label: string }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true" aria-label={label}>
      {Array.from({ length: 4 }, (_, i) => (
        <Card key={i}>
          <CardContent className="flex items-center gap-4 p-6">
            <Skeleton className="h-12 w-12 rounded-lg" />
            <div>
              <Skeleton className="mb-1 h-8 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Renders skeleton placeholders for the upcoming schedules list. */
function SchedulesSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true" aria-label={label}>
      <ul className="space-y-3">
        {Array.from({ length: 3 }, (_, i) => (
          <li key={i} className="flex items-center gap-4 rounded-lg border border-border/50 p-4">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-3 w-12" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Stat card configuration for the stats grid. */
interface StatConfig {
  /** Icon element. */
  icon: React.ReactNode;
  /** Stat label. */
  label: string;
  /** Stat value. */
  value: number | undefined;
  /** Whether loading. */
  isLoading: boolean;
  /** Link target. */
  href: string;
}

/** Props for the {@link StatsSection} component. */
interface StatsSectionProps {
  /** Whether all queries are still loading. */
  showSkeleton: boolean;
  /** Stat card configurations. */
  stats: StatConfig[];
  /** Screen-reader heading text. */
  srHeading: string;
  /** Loading aria-label. */
  loadingLabel: string;
}

/** Renders the stats grid or loading skeleton. */
function StatsSection({ showSkeleton, stats, srHeading, loadingLabel }: StatsSectionProps) {
  return (
    <section aria-labelledby="stats-heading" className="mb-8">
      <h2 id="stats-heading" className="sr-only">
        {srHeading}
      </h2>
      {showSkeleton ? (
        <StatsSkeleton label={loadingLabel} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <StatCard key={stat.label} {...stat} />
          ))}
        </div>
      )}
    </section>
  );
}

/** Props for the {@link UpcomingSchedulesSection} component. */
interface UpcomingSchedulesSectionProps {
  /** Whether schedule data is loading. */
  isLoading: boolean;
  /** List of upcoming schedules. */
  schedules: Schedule[];
}

/** Renders the upcoming schedules card with list, empty, or loading state. */
function UpcomingSchedulesSection({ isLoading, schedules }: UpcomingSchedulesSectionProps) {
  const { t } = useTranslation('provider');

  return (
    <section aria-labelledby="upcoming-heading" className="lg:col-span-2">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t('dashboard.upcoming.title')}</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/provider/schedules">
              {t('dashboard.upcoming.viewAll')}{' '}
              <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <h2 id="upcoming-heading" className="sr-only">
            {t('dashboard.upcoming.title')}
          </h2>
          {isLoading ? (
            <SchedulesSkeleton label={t('dashboard.stats.loadingSchedules')} />
          ) : schedules.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center" role="status">
              <Calendar className="mb-3 h-10 w-10 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">{t('dashboard.upcoming.empty')}</p>
              <Button variant="outline" size="sm" className="mt-4" asChild>
                <Link to="/provider/schedules">{t('dashboard.upcoming.createSchedule')}</Link>
              </Button>
            </div>
          ) : (
            <ul className="space-y-3" aria-label={t('dashboard.upcoming.title')}>
              {schedules.map((schedule) => (
                <ScheduleItem
                  key={schedule.id}
                  schedule={schedule}
                  recurringLabel={t('dashboard.upcoming.recurring')}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

/** Renders the quick actions sidebar card. */
function QuickActionsSection() {
  const { t } = useTranslation('provider');

  const quickActions = [
    { href: '/provider/routes', label: t('dashboard.quickActions.createRoute') },
    { href: '/provider/schedules', label: t('dashboard.quickActions.createSchedule') },
    { href: '/provider/fleet', label: t('dashboard.quickActions.addBus') },
    { href: '/provider/drivers', label: t('dashboard.quickActions.addDriver') },
  ];

  return (
    <section aria-labelledby="actions-heading">
      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.quickActions.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <h2 id="actions-heading" className="sr-only">
            {t('dashboard.quickActions.title')}
          </h2>
          <div className="space-y-3">
            {quickActions.map((action) => (
              <Button key={action.href} className="w-full justify-start" variant="outline" asChild>
                <Link to={action.href}>
                  <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                  {action.label}
                </Link>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

/** Retries all failed queries. */
function retryFailed(queries: { isError: boolean; refetch: () => void }[]) {
  for (const q of queries) {
    if (q.isError) q.refetch();
  }
}

/** Return type for {@link useDashboardData}. */
interface DashboardData {
  /** Stat card configurations. */
  stats: StatConfig[];
  /** Upcoming schedule list. */
  upcomingSchedules: Schedule[];
  /** Whether the initial load is in progress (no data yet). */
  showStatsSkeleton: boolean;
  /** Whether schedules are loading. */
  schedulesLoading: boolean;
  /** Whether all queries errored with no data. */
  isFullError: boolean;
  /** Retry callback for failed queries. */
  retry: () => void;
  /** Analytics query result from useProviderAnalytics. */
  analytics: ReturnType<typeof useProviderAnalytics>;
}

/** Fetches all dashboard data and builds stat card configs. */
function useDashboardData(t: (key: string) => string): DashboardData {
  const routesQuery = useRoutes({ page: 1, pageSize: 1 });
  const busesQuery = useBuses({ page: 1, pageSize: 1 });
  const driversQuery = useDrivers({ page: 1, pageSize: 1 });
  const schedulesQuery = useSchedules({
    status: 'ACTIVE',
    page: 1,
    pageSize: UPCOMING_COUNT,
  });
  const analyticsQuery = useProviderAnalytics();

  const queries = [routesQuery, busesQuery, driversQuery, schedulesQuery];

  const stats: StatConfig[] = [
    {
      icon: <Route className="h-6 w-6 text-primary" aria-hidden="true" />,
      label: t('dashboard.stats.routes'),
      value: routesQuery.data?.meta?.total,
      isLoading: routesQuery.isLoading,
      href: '/provider/routes',
    },
    {
      icon: <Bus className="h-6 w-6 text-primary" aria-hidden="true" />,
      label: t('dashboard.stats.buses'),
      value: busesQuery.data?.meta?.total,
      isLoading: busesQuery.isLoading,
      href: '/provider/fleet',
    },
    {
      icon: <Users className="h-6 w-6 text-primary" aria-hidden="true" />,
      label: t('dashboard.stats.drivers'),
      value: driversQuery.data?.meta?.total,
      isLoading: driversQuery.isLoading,
      href: '/provider/drivers',
    },
    {
      icon: <Calendar className="h-6 w-6 text-primary" aria-hidden="true" />,
      label: t('dashboard.stats.activeSchedules'),
      value: schedulesQuery.data?.meta?.total,
      isLoading: schedulesQuery.isLoading,
      href: '/provider/schedules',
    },
  ];

  return {
    stats,
    upcomingSchedules: schedulesQuery.data?.data ?? [],
    showStatsSkeleton: routesQuery.isLoading && !routesQuery.data,
    schedulesLoading: schedulesQuery.isLoading,
    isFullError:
      queries.some((q) => q.isError) && !routesQuery.data && !busesQuery.data && !driversQuery.data,
    retry: () => retryFailed(queries),
    analytics: analyticsQuery,
  };
}

/**
 * Provider dashboard page showing summary statistics, upcoming schedules,
 * and quick action buttons.
 *
 * Displays:
 * - Stat cards for total routes, buses, drivers, and active schedules
 * - Analytics section with bookings, revenue, occupancy, and revenue-by-route
 * - List of next 5 upcoming active schedules
 * - Quick action buttons to create routes and schedules
 *
 * @example
 * ```
 * // Route: /provider (index, requires PROVIDER role)
 * <ProviderDashboardPage />
 * ```
 */
export default function ProviderDashboardPage() {
  const { t } = useTranslation('provider');
  usePageTitle(t('dashboard.title'));
  const { user } = useAuth();
  const dashboard = useDashboardData(t);

  if (dashboard.isFullError) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold">{t('dashboard.heading')}</h1>
        <PageError
          title={t('dashboard.error.title')}
          message={t('dashboard.error.message')}
          onRetry={dashboard.retry}
        />
      </div>
    );
  }

  const heading = user?.name
    ? t('dashboard.welcomeBack', { name: user.name })
    : t('dashboard.heading');

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">{heading}</h1>
        <p className="mt-1 text-muted-foreground">{t('dashboard.subtitle')}</p>
      </div>

      <StatsSection
        showSkeleton={dashboard.showStatsSkeleton}
        stats={dashboard.stats}
        srHeading={t('dashboard.stats.srHeading')}
        loadingLabel={t('dashboard.stats.loadingStats')}
      />

      <AnalyticsSection
        data={dashboard.analytics.data?.data}
        isLoading={dashboard.analytics.isLoading}
        isError={dashboard.analytics.isError}
        onRetry={() => dashboard.analytics.refetch()}
      />

      <div className="grid gap-8 lg:grid-cols-3">
        <UpcomingSchedulesSection
          isLoading={dashboard.schedulesLoading}
          schedules={dashboard.upcomingSchedules}
        />
        <QuickActionsSection />
      </div>
    </div>
  );
}
