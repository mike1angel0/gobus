import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { Calendar, Plus, UserPlus, UserMinus, XCircle } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { CardGridSkeleton } from '@/components/shared/loading-skeleton';
import { PageError } from '@/components/shared/error-state';
import { EmptyState } from '@/components/shared/empty-state';
import { usePageTitle } from '@/hooks/use-page-title';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { useSchedules, useCancelSchedule, useUpdateSchedule } from '@/hooks/use-schedules';
import { useRoutes } from '@/hooks/use-routes';
import { useBuses } from '@/hooks/use-buses';
import { useDrivers } from '@/hooks/use-drivers';
import { CreateScheduleDialog } from '@/components/schedules/create-schedule-dialog';
import { ScheduleFilterBar } from '@/components/schedules/schedule-filter-bar';
import type { components } from '@/api/generated/types';

type Schedule = components['schemas']['Schedule'];
type ScheduleStatus = components['schemas']['ScheduleStatus'];

/** Shared CSS class for select elements styled to match Input. */
const SELECT_CLASS =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/* ---------- Schedule Card ---------- */

/** Props for {@link ScheduleCard}. */
interface ScheduleCardProps {
  /** Schedule data to display. */
  schedule: Schedule;
  /** Route name lookup. */
  routeName: string;
  /** Bus plate lookup. */
  busPlate: string;
  /** Callback to assign/unassign driver. */
  onDriverAction: (scheduleId: string) => void;
  /** Callback when cancel is requested. */
  onCancel: (id: string) => void;
  /** Whether a cancel operation is in progress. */
  isCancelling: boolean;
}

/** Displays a single schedule card with route, bus, times, and actions. */
function ScheduleCard({
  schedule,
  routeName,
  busPlate,
  onDriverAction,
  onCancel,
  isCancelling,
}: ScheduleCardProps) {
  const { t } = useTranslation('provider');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const isCancelled = schedule.status === 'CANCELLED';
  const depTime = format(new Date(schedule.departureTime), 'HH:mm');
  const arrTime = format(new Date(schedule.arrivalTime), 'HH:mm');
  const tripDateStr = format(new Date(schedule.tripDate), 'MMM d, yyyy');

  const dayShort = [
    t('schedules.days.sun'),
    t('schedules.days.mon'),
    t('schedules.days.tue'),
    t('schedules.days.wed'),
    t('schedules.days.thu'),
    t('schedules.days.fri'),
    t('schedules.days.sat'),
  ];

  const daysStr = schedule.daysOfWeek?.length
    ? schedule.daysOfWeek.map((d) => dayShort[d]).join(', ')
    : null;

  return (
    <Card className={isCancelled ? 'opacity-60' : undefined}>
      <CardContent className="p-6">
        <div className="mb-3 flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <h3 className="truncate font-semibold">{routeName || schedule.routeId}</h3>
            </div>
            <span
              className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                isCancelled ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
              }`}
            >
              {schedule.status}
            </span>
          </div>
        </div>

        <dl className="space-y-1 text-sm text-muted-foreground">
          <div className="flex justify-between">
            <dt>{t('schedules.card.bus')}</dt>
            <dd>{busPlate || schedule.busId}</dd>
          </div>
          <div className="flex justify-between">
            <dt>{t('schedules.card.times')}</dt>
            <dd>
              {depTime} → {arrTime}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt>{t('schedules.card.tripDate')}</dt>
            <dd>{tripDateStr}</dd>
          </div>
          <div className="flex justify-between">
            <dt>{t('schedules.card.price')}</dt>
            <dd>${schedule.basePrice.toFixed(2)}</dd>
          </div>
          {daysStr && (
            <div className="flex justify-between">
              <dt>{t('schedules.card.days')}</dt>
              <dd>{daysStr}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt>{t('schedules.card.driver')}</dt>
            <dd>
              {schedule.driverId ? t('schedules.card.assigned') : t('schedules.card.unassigned')}
            </dd>
          </div>
        </dl>

        {!isCancelled && (
          <ScheduleCardActions
            schedule={schedule}
            routeName={routeName}
            tripDateStr={tripDateStr}
            confirmOpen={confirmOpen}
            setConfirmOpen={setConfirmOpen}
            onDriverAction={onDriverAction}
            onCancel={onCancel}
            isCancelling={isCancelling}
          />
        )}
      </CardContent>
    </Card>
  );
}

/* ---------- Schedule Card Actions ---------- */

/** Props for {@link ScheduleCardActions}. */
interface ScheduleCardActionsProps {
  schedule: Schedule;
  routeName: string;
  tripDateStr: string;
  confirmOpen: boolean;
  setConfirmOpen: (open: boolean) => void;
  onDriverAction: (id: string) => void;
  onCancel: (id: string) => void;
  isCancelling: boolean;
}

/** Action buttons for a schedule card (driver assign + cancel). */
function ScheduleCardActions({
  schedule,
  routeName,
  tripDateStr,
  confirmOpen,
  setConfirmOpen,
  onDriverAction,
  onCancel,
  isCancelling,
}: ScheduleCardActionsProps) {
  const { t } = useTranslation('provider');

  return (
    <div className="mt-4 flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onDriverAction(schedule.id)}
        aria-label={
          schedule.driverId
            ? t('schedules.card.unassignLabel', { route: routeName })
            : t('schedules.card.assignLabel', { route: routeName })
        }
      >
        {schedule.driverId ? (
          <>
            <UserMinus className="mr-1 h-3 w-3" aria-hidden="true" />
            {t('schedules.card.unassign')}
          </>
        ) : (
          <>
            <UserPlus className="mr-1 h-3 w-3" aria-hidden="true" />
            {t('schedules.card.assign')}
          </>
        )}
      </Button>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive"
          onClick={() => setConfirmOpen(true)}
          aria-label={t('schedules.card.cancelLabel', { route: routeName })}
        >
          <XCircle className="mr-1 h-3 w-3" aria-hidden="true" />
          {t('schedules.card.cancel')}
        </Button>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('schedules.cancelDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('schedules.cancelDialog.description', { route: routeName, date: tripDateStr })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{t('schedules.cancelDialog.keep')}</Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={isCancelling}
              onClick={() => {
                onCancel(schedule.id);
                setConfirmOpen(false);
              }}
            >
              {isCancelling
                ? t('schedules.cancelDialog.cancelling')
                : t('schedules.cancelDialog.cancelButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------- Driver Assignment Dialog ---------- */

/** Props for {@link DriverAssignDialog}. */
interface DriverAssignDialogProps {
  /** Schedule ID to assign/unassign driver. */
  scheduleId: string;
  /** Current driver ID (null if unassigned). */
  currentDriverId: string | null;
  /** Available drivers. */
  drivers: Array<{ id: string; name: string }>;
  /** Callback to close the dialog. */
  onClose: () => void;
}

/** Dialog to assign or unassign a driver to a schedule. */
function DriverAssignDialog({
  scheduleId,
  currentDriverId,
  drivers,
  onClose,
}: DriverAssignDialogProps) {
  const { t } = useTranslation('provider');
  const [selectedDriverId, setSelectedDriverId] = useState(currentDriverId ?? '');
  const updateSchedule = useUpdateSchedule();

  function handleSave() {
    updateSchedule.mutate(
      { id: scheduleId, body: { driverId: selectedDriverId || null } },
      { onSuccess: onClose },
    );
  }

  return (
    <Dialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {currentDriverId
              ? t('schedules.driverDialog.changeTitle')
              : t('schedules.driverDialog.assignTitle')}
          </DialogTitle>
          <DialogDescription>
            {currentDriverId
              ? t('schedules.driverDialog.changeDescription')
              : t('schedules.driverDialog.assignDescription')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="assign-driver">{t('schedules.driverDialog.driverLabel')}</Label>
          <select
            id="assign-driver"
            className={SELECT_CLASS}
            value={selectedDriverId}
            onChange={(e) => setSelectedDriverId(e.target.value)}
          >
            <option value="">{t('schedules.driverDialog.noDriver')}</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={updateSchedule.isPending}>
            {updateSchedule.isPending
              ? t('schedules.driverDialog.saving')
              : t('schedules.driverDialog.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Filter state ---------- */

/** Filter state for schedule list. */
interface FilterState {
  routeId: string;
  busId: string;
  status: string;
  fromDate: string;
  toDate: string;
}

/** Initial filter state. */
const INITIAL_FILTERS: FilterState = {
  routeId: '',
  busId: '',
  status: '',
  fromDate: '',
  toDate: '',
};

/* ---------- Schedule List Content ---------- */

/** Props for {@link ScheduleListContent}. */
interface ScheduleListContentProps {
  /** Whether data is loading. */
  isLoading: boolean;
  /** Whether there is an error. */
  isError: boolean;
  /** Schedule data. */
  schedules: Schedule[];
  /** Route name lookup map. */
  routeNames: Map<string, string>;
  /** Bus plate lookup map. */
  busPlates: Map<string, string>;
  /** Retry callback. */
  onRetry: () => void;
  /** Driver action callback. */
  onDriverAction: (id: string) => void;
  /** Cancel callback. */
  onCancel: (id: string) => void;
  /** Whether cancel is pending. */
  isCancelling: boolean;
}

/** Renders the appropriate content based on query state. */
function ScheduleListContent({
  isLoading,
  isError,
  schedules,
  routeNames,
  busPlates,
  onRetry,
  onDriverAction,
  onCancel,
  isCancelling,
}: ScheduleListContentProps) {
  const { t } = useTranslation('provider');

  if (isLoading) return <CardGridSkeleton label={t('schedules.loadingLabel')} />;
  if (isError) {
    return (
      <PageError
        title={t('schedules.error.title')}
        message={t('schedules.error.message')}
        onRetry={onRetry}
      />
    );
  }
  if (schedules.length === 0) {
    return (
      <EmptyState
        icon={Calendar}
        title={t('schedules.empty.title')}
        message={t('schedules.empty.message')}
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label={t('schedules.listLabel')}>
      {schedules.map((schedule) => (
        <ScheduleCard
          key={schedule.id}
          schedule={schedule}
          routeName={routeNames.get(schedule.routeId) ?? ''}
          busPlate={busPlates.get(schedule.busId) ?? ''}
          onDriverAction={onDriverAction}
          onCancel={onCancel}
          isCancelling={isCancelling}
        />
      ))}
    </div>
  );
}

/* ---------- Custom hook ---------- */

/** Aggregates all data and state for the schedules page. */
function useSchedulesPageData(filters: FilterState) {
  const schedulesQuery = useSchedules({
    routeId: filters.routeId || undefined,
    busId: filters.busId || undefined,
    status: (filters.status as ScheduleStatus) || undefined,
    fromDate: filters.fromDate || undefined,
    toDate: filters.toDate || undefined,
    page: 1,
    pageSize: 50,
  });

  const routesQuery = useRoutes({ page: 1, pageSize: 100 });
  const busesQuery = useBuses({ page: 1, pageSize: 100 });
  const driversQuery = useDrivers({ page: 1, pageSize: 100 });
  const cancelSchedule = useCancelSchedule();

  return {
    schedules: schedulesQuery.data?.data ?? [],
    routes: routesQuery.data?.data ?? [],
    buses: busesQuery.data?.data ?? [],
    drivers: driversQuery.data?.data ?? [],
    isLoading: schedulesQuery.isLoading,
    isError: schedulesQuery.isError && !schedulesQuery.data,
    refetch: schedulesQuery.refetch,
    cancelSchedule,
  };
}

/* ---------- Page ---------- */

/**
 * Provider schedule management page.
 *
 * Displays a filterable list of the provider's schedules with create,
 * driver assignment, and cancel functionality. Schedules are shown in a
 * responsive grid with filter bar for route, bus, status, and date range.
 *
 * @example
 * ```
 * // Route: /provider/schedules (requires PROVIDER role)
 * <ProviderSchedulesPage />
 * ```
 */
export default function ProviderSchedulesPage() {
  const { t } = useTranslation('provider');
  usePageTitle(t('schedules.title'));
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [driverDialogScheduleId, setDriverDialogScheduleId] = useState<string | null>(null);

  const { schedules, routes, buses, drivers, isLoading, isError, refetch, cancelSchedule } =
    useSchedulesPageData(filters);

  const routeNames = new Map(routes.map((r) => [r.id, r.name]));
  const busPlates = new Map(buses.map((b) => [b.id, b.licensePlate]));

  const driverDialogSchedule = driverDialogScheduleId
    ? schedules.find((s) => s.id === driverDialogScheduleId)
    : null;

  function updateFilter(field: keyof FilterState, value: string) {
    setFilters((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('schedules.title')}</h1>
          <p className="mt-1 text-muted-foreground">{t('schedules.subtitle')}</p>
        </div>
        <CreateScheduleDialog>
          <Button>
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            {t('schedules.create')}
          </Button>
        </CreateScheduleDialog>
      </div>

      <ScheduleFilterBar
        routeId={filters.routeId}
        busId={filters.busId}
        status={filters.status}
        fromDate={filters.fromDate}
        toDate={filters.toDate}
        routes={routes}
        buses={buses}
        onRouteChange={(v) => updateFilter('routeId', v)}
        onBusChange={(v) => updateFilter('busId', v)}
        onStatusChange={(v) => updateFilter('status', v)}
        onFromDateChange={(v) => updateFilter('fromDate', v)}
        onToDateChange={(v) => updateFilter('toDate', v)}
      />

      <section aria-labelledby="schedules-heading">
        <h2 id="schedules-heading" className="sr-only">
          {t('schedules.title')}
        </h2>
        <ScheduleListContent
          isLoading={isLoading}
          isError={isError}
          schedules={schedules}
          routeNames={routeNames}
          busPlates={busPlates}
          onRetry={refetch}
          onDriverAction={setDriverDialogScheduleId}
          onCancel={(id) => cancelSchedule.mutate(id)}
          isCancelling={cancelSchedule.isPending}
        />
      </section>

      {driverDialogSchedule && (
        <DriverAssignDialog
          scheduleId={driverDialogSchedule.id}
          currentDriverId={driverDialogSchedule.driverId ?? null}
          drivers={drivers}
          onClose={() => setDriverDialogScheduleId(null)}
        />
      )}
    </div>
  );
}
