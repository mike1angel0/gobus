import { useState } from 'react';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { useRoutes, useRouteDetail } from '@/hooks/use-routes';
import { useBuses } from '@/hooks/use-buses';
import { useDrivers } from '@/hooks/use-drivers';
import { useCreateSchedule } from '@/hooks/use-schedules';
import { isApiError } from '@/api/errors';
import type { components } from '@/api/generated/types';

type Stop = components['schemas']['Stop'];

/** Maximum base price per OpenAPI spec. */
const MAX_BASE_PRICE = 100000;

/** Known form error field names. */
const KNOWN_FIELDS = ['routeId', 'busId', 'departureTime', 'arrivalTime', 'basePrice', 'tripDate'];

/** Validation errors for the create schedule form. */
interface FormErrors {
  routeId?: string;
  busId?: string;
  departureTime?: string;
  arrivalTime?: string;
  basePrice?: string;
  tripDate?: string;
  stopTimes?: string;
  general?: string;
}

/** Form state for create schedule. */
interface FormState {
  routeId: string;
  busId: string;
  driverId: string;
  departureTime: string;
  arrivalTime: string;
  basePrice: string;
  tripDate: string;
  daysOfWeek: number[];
}

/** Initial/empty form state. */
const INITIAL_FORM: FormState = {
  routeId: '',
  busId: '',
  driverId: '',
  departureTime: '',
  arrivalTime: '',
  basePrice: '',
  tripDate: '',
  daysOfWeek: [],
};

/** Shared CSS class for select elements styled to match Input. */
const SELECT_CLASS =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/* ---------- Validation ---------- */

/** Validates the create schedule form. Returns errors object (empty = valid). */
function validateForm(form: FormState, stopCount: number, t: TFunction): FormErrors {
  const errs: FormErrors = {};

  if (!form.routeId) errs.routeId = t('schedules.validation.routeRequired');
  if (!form.busId) errs.busId = t('schedules.validation.busRequired');
  if (!form.departureTime) errs.departureTime = t('schedules.validation.departureRequired');
  if (!form.arrivalTime) errs.arrivalTime = t('schedules.validation.arrivalRequired');

  if (form.departureTime && form.arrivalTime) {
    if (new Date(form.arrivalTime) <= new Date(form.departureTime)) {
      errs.arrivalTime = t('schedules.validation.arrivalAfterDeparture');
    }
  }

  const price = parseFloat(form.basePrice);
  if (!form.basePrice || isNaN(price)) {
    errs.basePrice = t('schedules.validation.basePriceRequired');
  } else if (price < 0 || price > MAX_BASE_PRICE) {
    errs.basePrice = t('schedules.validation.basePriceRange', { max: MAX_BASE_PRICE });
  }

  if (!form.tripDate) errs.tripDate = t('schedules.validation.tripDateRequired');
  if (form.routeId && stopCount < 2) {
    errs.stopTimes = t('schedules.validation.minStops');
  }

  return errs;
}

/** Builds stop times array from route stops, departure/arrival, and price. */
function buildStopTimes(stops: Stop[], depDate: Date, arrDate: Date, price: number) {
  const totalMs = arrDate.getTime() - depDate.getTime();

  return stops.map((stop, index) => {
    const fraction = stops.length > 1 ? index / (stops.length - 1) : 0;
    const isoTime = new Date(depDate.getTime() + fraction * totalMs).toISOString();

    return {
      stopName: stop.name,
      arrivalTime: isoTime,
      departureTime: isoTime,
      orderIndex: index,
      priceFromStart: Math.round(fraction * price * 100) / 100,
    };
  });
}

/** Handles mutation error by mapping API errors to form fields. */
function handleMutationError(
  error: unknown,
  setErrors: React.Dispatch<React.SetStateAction<FormErrors>>,
  t: TFunction,
) {
  if (!isApiError(error)) return;
  if (error.status === 404) {
    setErrors((prev) => ({ ...prev, general: t('schedules.validation.notFound') }));
    return;
  }
  for (const fe of error.fieldErrors) {
    if (fe.field && KNOWN_FIELDS.includes(fe.field)) {
      setErrors((prev) => ({ ...prev, [fe.field!]: fe.message }));
    }
  }
}

/** Builds the mutation request body from form state and route stops. */
function buildRequestBody(form: FormState, routeStops: Stop[]) {
  const depDate = new Date(form.departureTime);
  const arrDate = new Date(form.arrivalTime);
  const price = parseFloat(form.basePrice);

  return {
    routeId: form.routeId,
    busId: form.busId,
    driverId: form.driverId || undefined,
    departureTime: depDate.toISOString(),
    arrivalTime: arrDate.toISOString(),
    basePrice: price,
    tripDate: new Date(form.tripDate).toISOString(),
    daysOfWeek: form.daysOfWeek.length > 0 ? form.daysOfWeek : undefined,
    stopTimes: buildStopTimes(routeStops, depDate, arrDate, price),
  };
}

/* ---------- Sub-components ---------- */

/** Props for {@link SelectField}. */
interface SelectFieldProps {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  errorId: string;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
}

/** Reusable select field with label and error display. */
function SelectField({
  label,
  id,
  value,
  onChange,
  error,
  errorId,
  options,
  placeholder,
}: SelectFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        className={SELECT_CLASS}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** Props for {@link DaysOfWeekSelector}. */
interface DaysOfWeekSelectorProps {
  selected: number[];
  onToggle: (day: number) => void;
}

/** Multi-toggle day of week selector. */
function DaysOfWeekSelector({ selected, onToggle }: DaysOfWeekSelectorProps) {
  const { t } = useTranslation('provider');

  const dayLabels = [
    t('schedules.days.sun'),
    t('schedules.days.mon'),
    t('schedules.days.tue'),
    t('schedules.days.wed'),
    t('schedules.days.thu'),
    t('schedules.days.fri'),
    t('schedules.days.sat'),
  ];

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">
        {t('schedules.createDialog.daysOfWeekLegend')}
      </legend>
      <div
        className="flex flex-wrap gap-1"
        role="group"
        aria-label={t('schedules.createDialog.daysOfWeekLabel')}
      >
        {dayLabels.map((label, index) => (
          <Button
            key={index}
            type="button"
            variant={selected.includes(index) ? 'default' : 'outline'}
            size="sm"
            className="w-12"
            onClick={() => onToggle(index)}
            aria-pressed={selected.includes(index)}
          >
            {label}
          </Button>
        ))}
      </div>
    </fieldset>
  );
}

/** Props for {@link StopTimesPreview}. */
interface StopTimesPreviewProps {
  stops: Stop[];
  error?: string;
}

/** Shows a preview of stop times that will be auto-calculated. */
function StopTimesPreview({ stops, error }: StopTimesPreviewProps) {
  const { t } = useTranslation('provider');

  return (
    <>
      {stops.length > 0 && (
        <div className="rounded-md border border-border/50 p-3">
          <p className="mb-1 text-sm font-medium">
            {t('schedules.createDialog.stopTimesLabel', { count: stops.length })}
          </p>
          <p className="text-xs text-muted-foreground">
            {t('schedules.createDialog.stopTimesDescription')}
          </p>
          <ul
            className="mt-2 space-y-1"
            aria-label={t('schedules.createDialog.stopTimesListLabel')}
          >
            {stops.map((stop, i) => (
              <li key={stop.id ?? i} className="text-xs text-muted-foreground">
                {i + 1}. {stop.name}
              </li>
            ))}
          </ul>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </>
  );
}

/** Props for {@link InputField}. */
interface InputFieldProps {
  label: string;
  id: string;
  error?: string;
  errorId: string;
  children: React.ReactNode;
}

/** Wraps an input with label and error display. */
function InputField({ label, id, error, errorId, children }: InputFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/* ---------- Main Dialog ---------- */

/** Props for {@link CreateScheduleDialog}. */
interface CreateScheduleDialogProps {
  /** Children used as the trigger element. */
  children: React.ReactNode;
}

/** Fetches dropdown data for the create schedule form. */
function useCreateScheduleData(routeId: string) {
  const routesQuery = useRoutes({ page: 1, pageSize: 100 });
  const busesQuery = useBuses({ page: 1, pageSize: 100 });
  const driversQuery = useDrivers({ page: 1, pageSize: 100 });
  const routeDetailQuery = useRouteDetail(routeId);

  return {
    routes: routesQuery.data?.data ?? [],
    buses: busesQuery.data?.data ?? [],
    drivers: driversQuery.data?.data ?? [],
    routeStops: routeDetailQuery.data?.data?.stops ?? [],
  };
}

/**
 * Dialog form for creating a new schedule with route, bus, driver,
 * departure/arrival times, days of week, base price, trip date,
 * and stop times auto-populated from the selected route.
 */
export function CreateScheduleDialog({ children }: CreateScheduleDialogProps) {
  const { t } = useTranslation('provider');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const createSchedule = useCreateSchedule();
  const { routes, buses, drivers, routeStops } = useCreateScheduleData(form.routeId);

  function updateField(field: keyof FormState, value: string | number[]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function resetForm() {
    setForm(INITIAL_FORM);
    setErrors({});
  }

  function toggleDay(day: number) {
    setForm((prev) => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter((d) => d !== day)
        : [...prev.daysOfWeek, day],
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const formErrors = validateForm(form, routeStops.length, t);
    setErrors(formErrors);
    if (Object.keys(formErrors).length > 0) return;

    createSchedule.mutate(buildRequestBody(form, routeStops), {
      onSuccess: () => {
        resetForm();
        setOpen(false);
      },
      onError: (error: unknown) => handleMutationError(error, setErrors, t),
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) resetForm();
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('schedules.createDialog.title')}</DialogTitle>
          <DialogDescription>{t('schedules.createDialog.description')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {errors.general && (
            <p role="alert" className="text-sm text-destructive">
              {errors.general}
            </p>
          )}

          <SelectField
            label={t('schedules.createDialog.routeLabel')}
            id="schedule-route"
            value={form.routeId}
            onChange={(v) => updateField('routeId', v)}
            error={errors.routeId}
            errorId="route-error"
            placeholder={t('schedules.createDialog.routePlaceholder')}
            options={routes.map((r) => ({ value: r.id, label: r.name }))}
          />
          <SelectField
            label={t('schedules.createDialog.busLabel')}
            id="schedule-bus"
            value={form.busId}
            onChange={(v) => updateField('busId', v)}
            error={errors.busId}
            errorId="bus-error"
            placeholder={t('schedules.createDialog.busPlaceholder')}
            options={buses.map((b) => ({
              value: b.id,
              label: t('schedules.createDialog.busOption', {
                plate: b.licensePlate,
                model: b.model,
                capacity: b.capacity,
              }),
            }))}
          />
          <SelectField
            label={t('schedules.createDialog.driverLabel')}
            id="schedule-driver"
            value={form.driverId}
            onChange={(v) => updateField('driverId', v)}
            errorId="driver-error"
            placeholder={t('schedules.createDialog.driverPlaceholder')}
            options={drivers.map((d) => ({ value: d.id, label: d.name }))}
          />

          <InputField
            label={t('schedules.createDialog.tripDateLabel')}
            id="schedule-trip-date"
            error={errors.tripDate}
            errorId="trip-date-error"
          >
            <Input
              id="schedule-trip-date"
              type="date"
              value={form.tripDate}
              onChange={(e) => updateField('tripDate', e.target.value)}
              min={format(new Date(), 'yyyy-MM-dd')}
              aria-invalid={!!errors.tripDate}
              aria-describedby={errors.tripDate ? 'trip-date-error' : undefined}
            />
          </InputField>

          <div className="grid grid-cols-2 gap-4">
            <InputField
              label={t('schedules.createDialog.departureLabel')}
              id="schedule-departure"
              error={errors.departureTime}
              errorId="departure-error"
            >
              <Input
                id="schedule-departure"
                type="datetime-local"
                value={form.departureTime}
                onChange={(e) => updateField('departureTime', e.target.value)}
                aria-invalid={!!errors.departureTime}
                aria-describedby={errors.departureTime ? 'departure-error' : undefined}
              />
            </InputField>
            <InputField
              label={t('schedules.createDialog.arrivalLabel')}
              id="schedule-arrival"
              error={errors.arrivalTime}
              errorId="arrival-error"
            >
              <Input
                id="schedule-arrival"
                type="datetime-local"
                value={form.arrivalTime}
                onChange={(e) => updateField('arrivalTime', e.target.value)}
                aria-invalid={!!errors.arrivalTime}
                aria-describedby={errors.arrivalTime ? 'arrival-error' : undefined}
              />
            </InputField>
          </div>

          <InputField
            label={t('schedules.createDialog.basePriceLabel')}
            id="schedule-price"
            error={errors.basePrice}
            errorId="price-error"
          >
            <Input
              id="schedule-price"
              type="number"
              step="0.01"
              min={0}
              max={MAX_BASE_PRICE}
              placeholder={t('schedules.createDialog.basePricePlaceholder')}
              value={form.basePrice}
              onChange={(e) => updateField('basePrice', e.target.value)}
              aria-invalid={!!errors.basePrice}
              aria-describedby={errors.basePrice ? 'price-error' : undefined}
            />
          </InputField>

          <DaysOfWeekSelector selected={form.daysOfWeek} onToggle={toggleDay} />

          {form.routeId && <StopTimesPreview stops={routeStops} error={errors.stopTimes} />}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={createSchedule.isPending}>
              {createSchedule.isPending
                ? t('schedules.createDialog.creating')
                : t('schedules.createDialog.createButton')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
