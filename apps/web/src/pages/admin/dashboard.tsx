import { Link } from 'react-router-dom';
import { Users, Bus, Shield, FileText, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { PageError } from '@/components/shared/error-state';
import { useAdminUsers, useAdminBuses, useAuditLogs } from '@/hooks/use-admin';
import { useAuth } from '@/hooks/useAuth';
import { usePageTitle } from '@/hooks/use-page-title';

/** Number of recent audit log entries to show on the dashboard. */
const RECENT_AUDIT_COUNT = 5;

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
 * Links to the relevant admin management page.
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

/** Renders skeleton placeholders for the stats grid. */
function StatsSkeleton() {
  const { t } = useTranslation('admin');
  return (
    <div
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      aria-busy="true"
      aria-label={t('dashboard.loadingStats')}
    >
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

/** Stat card configuration. */
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
}

/** Renders the stats grid or loading skeleton. */
function StatsSection({ showSkeleton, stats }: StatsSectionProps) {
  const { t } = useTranslation('admin');
  return (
    <section aria-labelledby="stats-heading" className="mb-8">
      <h2 id="stats-heading" className="sr-only">
        {t('dashboard.statsHeading')}
      </h2>
      {showSkeleton ? (
        <StatsSkeleton />
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

/** Renders skeleton placeholders for the recent activity list. */
function ActivitySkeleton() {
  const { t } = useTranslation('admin');
  return (
    <div aria-busy="true" aria-label={t('dashboard.loadingActivity')}>
      <ul className="space-y-3">
        {Array.from({ length: 3 }, (_, i) => (
          <li key={i} className="flex items-center gap-4 rounded-lg border border-border/50 p-4">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-24" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Renders the quick actions card. */
function QuickActionsSection() {
  const { t } = useTranslation('admin');
  const quickActions = [
    { href: '/admin/users', label: t('dashboard.quickActions.manageUsers'), icon: Users },
    { href: '/admin/fleet', label: t('dashboard.quickActions.manageFleet'), icon: Bus },
    { href: '/admin/audit-logs', label: t('dashboard.quickActions.viewAuditLogs'), icon: FileText },
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
                  <action.icon className="mr-2 h-4 w-4" aria-hidden="true" />
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

/** Props for an individual audit log entry row. */
interface AuditEntryProps {
  /** Action performed. */
  action: string;
  /** User email or ID who performed the action. */
  userEmail: string | undefined;
  /** Timestamp of the action. */
  timestamp: string;
}

/** Renders a single recent audit log entry. */
function AuditEntry({ action, userEmail, timestamp }: AuditEntryProps) {
  const { t } = useTranslation('admin');
  const date = new Date(timestamp);
  const formatted = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <li className="flex items-center gap-4 rounded-lg border border-border/50 p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Shield className="h-5 w-5 text-primary" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{action}</p>
        <p className="text-sm text-muted-foreground">
          {userEmail ?? t('dashboard.recentActivity.unknownUser')}
        </p>
      </div>
      <p className="shrink-0 text-sm text-muted-foreground">{formatted}</p>
    </li>
  );
}

/** Props for the {@link RecentActivitySection} component. */
interface RecentActivitySectionProps {
  /** Whether audit log data is loading. */
  isLoading: boolean;
  /** List of recent audit log entries. */
  entries: Array<{ action: string; userId?: string; createdAt: string }>;
}

/** Renders the recent activity card with audit log entries. */
function RecentActivitySection({ isLoading, entries }: RecentActivitySectionProps) {
  const { t } = useTranslation('admin');
  return (
    <section aria-labelledby="activity-heading" className="lg:col-span-2">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t('dashboard.recentActivity.title')}</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/audit-logs">
              {t('dashboard.recentActivity.viewAll')}{' '}
              <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <h2 id="activity-heading" className="sr-only">
            {t('dashboard.recentActivity.title')}
          </h2>
          {isLoading ? (
            <ActivitySkeleton />
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center" role="status">
              <FileText className="mb-3 h-10 w-10 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">{t('dashboard.recentActivity.empty')}</p>
            </div>
          ) : (
            <ul className="space-y-3" aria-label={t('dashboard.recentActivity.listLabel')}>
              {entries.map((entry, index) => (
                <AuditEntry
                  key={`${entry.createdAt}-${index}`}
                  action={entry.action}
                  userEmail={entry.userId}
                  timestamp={entry.createdAt}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

/** Return type for {@link useAdminDashboardData}. */
interface AdminDashboardData {
  /** Stat card configurations. */
  stats: StatConfig[];
  /** Recent audit log entries. */
  recentActivity: Array<{ action: string; userId?: string; createdAt: string }>;
  /** Whether the initial load is in progress. */
  showStatsSkeleton: boolean;
  /** Whether audit logs are loading. */
  activityLoading: boolean;
  /** Whether all queries errored with no data. */
  isFullError: boolean;
  /** Retry callback for failed queries. */
  retry: () => void;
}

/** Fetches all admin dashboard data and builds stat card configs. */
function useAdminDashboardData(): AdminDashboardData {
  const { t } = useTranslation('admin');
  const usersQuery = useAdminUsers({ page: 1, pageSize: 1 });
  const providersQuery = useAdminUsers({ page: 1, pageSize: 1, role: 'PROVIDER' });
  const busesQuery = useAdminBuses({ page: 1, pageSize: 1 });
  const auditQuery = useAuditLogs({ page: 1, pageSize: RECENT_AUDIT_COUNT });

  const queries = [usersQuery, providersQuery, busesQuery, auditQuery];

  const stats: StatConfig[] = [
    {
      icon: <Users className="h-6 w-6 text-primary" aria-hidden="true" />,
      label: t('dashboard.stats.totalUsers'),
      value: usersQuery.data?.meta?.total,
      isLoading: usersQuery.isLoading,
      href: '/admin/users',
    },
    {
      icon: <Shield className="h-6 w-6 text-primary" aria-hidden="true" />,
      label: t('dashboard.stats.providers'),
      value: providersQuery.data?.meta?.total,
      isLoading: providersQuery.isLoading,
      href: '/admin/users',
    },
    {
      icon: <Bus className="h-6 w-6 text-primary" aria-hidden="true" />,
      label: t('dashboard.stats.totalBuses'),
      value: busesQuery.data?.meta?.total,
      isLoading: busesQuery.isLoading,
      href: '/admin/fleet',
    },
    {
      icon: <FileText className="h-6 w-6 text-primary" aria-hidden="true" />,
      label: t('dashboard.stats.auditEvents'),
      value: auditQuery.data?.meta?.total,
      isLoading: auditQuery.isLoading,
      href: '/admin/audit-logs',
    },
  ];

  return {
    stats,
    recentActivity: (auditQuery.data?.data as AdminDashboardData['recentActivity']) ?? [],
    showStatsSkeleton: usersQuery.isLoading && !usersQuery.data,
    activityLoading: auditQuery.isLoading,
    isFullError:
      queries.some((q) => q.isError) && !usersQuery.data && !busesQuery.data && !auditQuery.data,
    retry: () => {
      for (const q of queries) {
        if (q.isError) q.refetch();
      }
    },
  };
}

/**
 * Admin dashboard page showing platform-wide summary statistics,
 * recent audit activity, and quick action links.
 *
 * Displays:
 * - Stat cards for total users, providers, buses, and audit events
 * - Recent audit log entries
 * - Quick action buttons to manage users, fleet, and view logs
 *
 * @example
 * ```tsx
 * // Route: /admin (index, requires ADMIN role)
 * <AdminDashboardPage />
 * ```
 */
export default function AdminDashboardPage() {
  const { t } = useTranslation('admin');
  usePageTitle(t('dashboard.title'));
  const { user } = useAuth();
  const dashboard = useAdminDashboardData();

  if (dashboard.isFullError) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold">{t('dashboard.title')}</h1>
        <PageError
          title={t('dashboard.error.title')}
          message={t('dashboard.error.message')}
          onRetry={dashboard.retry}
        />
      </div>
    );
  }

  const heading = user?.name ? t('dashboard.welcome', { name: user.name }) : t('dashboard.title');

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">{heading}</h1>
        <p className="mt-1 text-muted-foreground">{t('dashboard.subtitle')}</p>
      </div>

      <StatsSection showSkeleton={dashboard.showStatsSkeleton} stats={dashboard.stats} />

      <div className="grid gap-8 lg:grid-cols-3">
        <RecentActivitySection
          isLoading={dashboard.activityLoading}
          entries={dashboard.recentActivity}
        />
        <QuickActionsSection />
      </div>
    </div>
  );
}
