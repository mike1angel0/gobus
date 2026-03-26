import { useState, useCallback, useMemo } from 'react';
import { FileText, ChevronDown, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageError } from '@/components/shared/error-state';
import { EmptyState } from '@/components/shared/empty-state';
import { useAuditLogs } from '@/hooks/use-admin';
import { usePageTitle } from '@/hooks/use-page-title';
import type { components } from '@/api/generated/types';

type AuditLog = components['schemas']['AdminAuditLog'];

const PAGE_SIZE = 20;

const ACTION_OPTIONS = [
  'LOGIN',
  'LOGOUT',
  'REGISTER',
  'PASSWORD_CHANGE',
  'PASSWORD_RESET',
  'PROFILE_UPDATE',
  'USER_SUSPEND',
  'USER_UNSUSPEND',
  'USER_UNLOCK',
  'FORCE_LOGOUT',
  'PROVIDER_CREATE',
  'PROVIDER_APPROVE',
  'PROVIDER_REJECT',
  'BUS_CREATE',
  'BUS_UPDATE',
  'BUS_DELETE',
  'ROUTE_CREATE',
  'ROUTE_UPDATE',
  'ROUTE_DELETE',
  'SCHEDULE_CREATE',
  'SCHEDULE_UPDATE',
  'SCHEDULE_DELETE',
  'BOOKING_CREATE',
  'BOOKING_CANCEL',
] as const;

/* ---------- Filter Bar ---------- */

/** Props for {@link AuditLogFilterBar}. */
interface AuditLogFilterBarProps {
  /** Current user ID filter value. */
  userId: string;
  /** Current action filter value. */
  action: string;
  /** Current dateFrom filter value. */
  dateFrom: string;
  /** Current dateTo filter value. */
  dateTo: string;
  /** Callback when userId filter changes. */
  onUserIdChange: (value: string) => void;
  /** Callback when action filter changes. */
  onActionChange: (value: string) => void;
  /** Callback when dateFrom filter changes. */
  onDateFromChange: (value: string) => void;
  /** Callback when dateTo filter changes. */
  onDateToChange: (value: string) => void;
}

/**
 * Filter bar with userId, action, dateFrom, and dateTo controls for the audit log list.
 */
function AuditLogFilterBar({
  userId,
  action,
  dateFrom,
  dateTo,
  onUserIdChange,
  onActionChange,
  onDateFromChange,
  onDateToChange,
}: AuditLogFilterBarProps) {
  const { t } = useTranslation('admin');
  return (
    <div
      className="mb-6 flex flex-wrap gap-4"
      role="group"
      aria-label={t('auditLogs.filtersLabel')}
    >
      <div className="flex items-center gap-2">
        <label htmlFor="userId-filter" className="text-sm font-medium">
          {t('auditLogs.userIdLabel')}
        </label>
        <input
          id="userId-filter"
          type="text"
          className="rounded-md border bg-background px-3 py-1.5 text-sm"
          placeholder={t('auditLogs.userIdPlaceholder')}
          value={userId}
          onChange={(e) => onUserIdChange(e.target.value)}
          maxLength={30}
        />
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="action-filter" className="text-sm font-medium">
          {t('auditLogs.actionLabel')}
        </label>
        <select
          id="action-filter"
          className="rounded-md border bg-background px-3 py-1.5 text-sm"
          value={action}
          onChange={(e) => onActionChange(e.target.value)}
        >
          <option value="">{t('auditLogs.allActions')}</option>
          {ACTION_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="dateFrom-filter" className="text-sm font-medium">
          {t('auditLogs.fromLabel')}
        </label>
        <input
          id="dateFrom-filter"
          type="date"
          className="rounded-md border bg-background px-3 py-1.5 text-sm"
          value={dateFrom}
          onChange={(e) => onDateFromChange(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="dateTo-filter" className="text-sm font-medium">
          {t('auditLogs.toLabel')}
        </label>
        <input
          id="dateTo-filter"
          type="date"
          className="rounded-md border bg-background px-3 py-1.5 text-sm"
          value={dateTo}
          onChange={(e) => onDateToChange(e.target.value)}
        />
      </div>
    </div>
  );
}

/* ---------- Loading Skeleton ---------- */

/** Skeleton placeholder for the audit log list while loading. */
function AuditLogSkeleton() {
  const { t } = useTranslation('admin');
  return (
    <div className="space-y-4" aria-busy="true" aria-label={t('auditLogs.loadingLabel')}>
      {Array.from({ length: 5 }, (_, i) => (
        <Card key={i}>
          <CardContent className="flex items-center gap-4 p-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="ml-auto h-4 w-28" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ---------- Audit Log Row ---------- */

/** Props for {@link AuditLogRow}. */
interface AuditLogRowProps {
  /** Audit log entry to display. */
  log: AuditLog;
  /** Whether this row's detail is expanded. */
  isExpanded: boolean;
  /** Callback to toggle expansion. */
  onToggle: () => void;
}

/** Formats a date-time string for display. */
function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Single audit log row with expandable detail section.
 *
 * Shows timestamp, action, resource, resourceId, and IP address.
 * When expanded, shows metadata JSON and userAgent.
 */
function AuditLogRow({ log, isExpanded, onToggle }: AuditLogRowProps) {
  const { t } = useTranslation('admin');
  const hasDetail = log.metadata || log.userAgent;
  const ExpandIcon = isExpanded ? ChevronDown : ChevronRight;

  return (
    <Card>
      <CardContent className="p-0">
        <button
          type="button"
          className="flex w-full flex-wrap items-center gap-3 p-4 text-left hover:bg-muted/50"
          onClick={onToggle}
          aria-expanded={isExpanded}
          aria-label={`${log.action} on ${log.resource}${log.resourceId ? ` ${log.resourceId}` : ''}`}
          disabled={!hasDetail}
        >
          {hasDetail ? (
            <ExpandIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          ) : (
            <span className="h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <time className="shrink-0 text-sm text-muted-foreground" dateTime={log.createdAt}>
            {formatTimestamp(log.createdAt)}
          </time>
          <Badge variant="outline">{log.action}</Badge>
          <span className="min-w-0 flex-1 truncate text-sm">
            {log.resource}
            {log.resourceId && (
              <span className="ml-1 text-muted-foreground">({log.resourceId})</span>
            )}
          </span>
          {log.userId && (
            <span className="hidden text-xs text-muted-foreground sm:block">
              {t('auditLogs.userPrefix', { id: log.userId })}
            </span>
          )}
          {log.ipAddress && (
            <span className="hidden text-xs text-muted-foreground md:block">
              {t('auditLogs.ipPrefix', { ip: log.ipAddress })}
            </span>
          )}
        </button>
        {isExpanded && hasDetail && (
          <div className="border-t bg-muted/30 px-4 py-3" data-testid="audit-log-detail">
            {log.userAgent && (
              <p className="mb-2 text-sm">
                <span className="font-medium">{t('auditLogs.userAgentLabel')}</span>{' '}
                <span className="text-muted-foreground">{log.userAgent}</span>
              </p>
            )}
            {log.metadata && Object.keys(log.metadata).length > 0 && (
              <div>
                <p className="mb-1 text-sm font-medium">{t('auditLogs.metadataLabel')}</p>
                <pre className="overflow-x-auto rounded bg-muted p-2 text-xs">
                  {JSON.stringify(log.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------- Pagination ---------- */

/** Props for {@link AuditLogPagination}. */
interface AuditLogPaginationProps {
  /** Current page number. */
  page: number;
  /** Total number of pages. */
  totalPages: number;
  /** Callback to change page. */
  onPageChange: (page: number) => void;
}

/** Pagination controls for the audit log list. */
function AuditLogPagination({ page, totalPages, onPageChange }: AuditLogPaginationProps) {
  const { t } = useTranslation('admin');
  return (
    <nav className="mt-8 flex items-center justify-center gap-4" aria-label="Audit log pagination">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        {t('pagination.previous')}
      </Button>
      <span className="text-sm text-muted-foreground">
        {t('pagination.pageOf', { page, totalPages })}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        {t('pagination.next')}
      </Button>
    </nav>
  );
}

/* ---------- List Content ---------- */

/** Props for {@link AuditLogListContent}. */
interface AuditLogListContentProps {
  /** Whether data is loading. */
  isLoading: boolean;
  /** Whether there was a fetch error. */
  isError: boolean;
  /** The list of audit logs. */
  logs: AuditLog[];
  /** Set of expanded log IDs. */
  expandedIds: Set<string>;
  /** Retry callback for error state. */
  onRetry: () => void;
  /** Callback to toggle a log's expanded state. */
  onToggle: (id: string) => void;
}

/** Renders the appropriate audit log list content based on query state. */
function AuditLogListContent({
  isLoading,
  isError,
  logs,
  expandedIds,
  onRetry,
  onToggle,
}: AuditLogListContentProps) {
  const { t } = useTranslation('admin');
  if (isLoading) return <AuditLogSkeleton />;
  if (isError) {
    return (
      <PageError
        title={t('auditLogs.error.title')}
        message={t('auditLogs.error.message')}
        onRetry={onRetry}
      />
    );
  }
  if (logs.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title={t('auditLogs.empty.title')}
        message={t('auditLogs.empty.message')}
      />
    );
  }
  return (
    <div className="space-y-3">
      {logs.map((log) => (
        <AuditLogRow
          key={log.id}
          log={log}
          isExpanded={expandedIds.has(log.id)}
          onToggle={() => onToggle(log.id)}
        />
      ))}
    </div>
  );
}

/* ---------- Page ---------- */

/**
 * Admin audit log page.
 *
 * Displays a paginated, filterable list of system audit events. Supports filtering
 * by user ID, action type, and date range. Each row can be expanded to view metadata
 * JSON and user agent details.
 *
 * @example
 * ```
 * // Route: /admin/audit-logs (requires ADMIN role)
 * <AdminAuditLogsPage />
 * ```
 */
export default function AdminAuditLogsPage() {
  const { t } = useTranslation('admin');
  usePageTitle(t('auditLogs.title'));
  const [page, setPage] = useState(1);
  const [userIdFilter, setUserIdFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const auditLogsQuery = useAuditLogs({
    page,
    pageSize: PAGE_SIZE,
    userId: userIdFilter || undefined,
    action: actionFilter || undefined,
    dateFrom: dateFrom ? new Date(dateFrom).toISOString() : undefined,
    dateTo: dateTo ? new Date(`${dateTo}T23:59:59`).toISOString() : undefined,
  });

  const logs = useMemo(() => auditLogsQuery.data?.data ?? [], [auditLogsQuery.data]);
  const totalPages = auditLogsQuery.data?.meta?.totalPages ?? 1;

  const handleUserIdChange = useCallback((value: string) => {
    setUserIdFilter(value);
    setPage(1);
  }, []);

  const handleActionChange = useCallback((value: string) => {
    setActionFilter(value);
    setPage(1);
  }, []);

  const handleDateFromChange = useCallback((value: string) => {
    setDateFrom(value);
    setPage(1);
  }, []);

  const handleDateToChange = useCallback((value: string) => {
    setDateTo(value);
    setPage(1);
  }, []);

  const handleToggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">{t('auditLogs.title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('auditLogs.subtitle')}</p>
      </div>

      <AuditLogFilterBar
        userId={userIdFilter}
        action={actionFilter}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onUserIdChange={handleUserIdChange}
        onActionChange={handleActionChange}
        onDateFromChange={handleDateFromChange}
        onDateToChange={handleDateToChange}
      />

      <section aria-labelledby="audit-logs-heading">
        <h2 id="audit-logs-heading" className="sr-only">
          {t('auditLogs.heading')}
        </h2>
        <AuditLogListContent
          isLoading={auditLogsQuery.isLoading}
          isError={auditLogsQuery.isError && !auditLogsQuery.data}
          logs={logs}
          expandedIds={expandedIds}
          onRetry={() => auditLogsQuery.refetch()}
          onToggle={handleToggle}
        />
      </section>

      {totalPages > 1 && (
        <AuditLogPagination page={page} totalPages={totalPages} onPageChange={setPage} />
      )}
    </div>
  );
}
