import { useState } from 'react';
import { z } from 'zod';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
import { useCreateDelay } from '@/hooks/use-delays';

const DELAY_REASONS = ['TRAFFIC', 'MECHANICAL', 'WEATHER', 'OTHER'] as const;

const delaySchema = z.object({
  scheduleId: z.string().min(1, 'Schedule is required'),
  offsetMinutes: z.number().int().min(1, 'Must be at least 1 minute').max(1440, 'Max 1440 minutes'),
  reason: z.enum(DELAY_REASONS, { required_error: 'Reason is required' }),
  note: z.string().max(500, 'Max 500 characters').optional(),
  tripDate: z.string().min(1, 'Trip date is required'),
});

/** Available schedule option for the delay report form. */
export interface ScheduleOption {
  /** Schedule identifier. */
  id: string;
  /** Display label (e.g., route name + departure time). */
  label: string;
}

/** Props for {@link ReportDelayDialog}. */
export interface ReportDelayDialogProps {
  /** Available schedules to report a delay for. */
  schedules: ScheduleOption[];
  /** Trigger element (button) to open the dialog. */
  children: React.ReactNode;
}

/** Shared CSS class for select elements in the delay form. */
const SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/**
 * Dialog for reporting a schedule delay with reason, offset minutes, and optional note.
 *
 * Validates input against the OpenAPI spec constraints (offsetMinutes 1-1440, note max 500 chars).
 * Uses the today's date as the default trip date.
 *
 * @example
 * ```tsx
 * <ReportDelayDialog schedules={[{ id: 'sched_1', label: 'Vienna → Budapest 08:00' }]}>
 *   <Button>Report delay</Button>
 * </ReportDelayDialog>
 * ```
 */
export function ReportDelayDialog({ schedules, children }: ReportDelayDialogProps) {
  const { t } = useTranslation('tracking');
  const [open, setOpen] = useState(false);
  const createDelay = useCreateDelay();

  const [scheduleId, setScheduleId] = useState('');
  const [offsetMinutes, setOffsetMinutes] = useState('');
  const [reason, setReason] = useState<string>('');
  const [note, setNote] = useState('');
  const [tripDate, setTripDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function resetForm() {
    setScheduleId('');
    setOffsetMinutes('');
    setReason('');
    setNote('');
    setTripDate(new Date().toISOString().split('T')[0]);
    setErrors({});
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) resetForm();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const parsed = delaySchema.safeParse({
      scheduleId,
      offsetMinutes: offsetMinutes ? Number(offsetMinutes) : undefined,
      reason: reason || undefined,
      note: note || undefined,
      tripDate,
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field && !fieldErrors[String(field)]) {
          fieldErrors[String(field)] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    createDelay.mutate(parsed.data, {
      onSuccess: () => {
        setOpen(false);
        resetForm();
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('reportDialog.title')}</DialogTitle>
          <DialogDescription>{t('reportDialog.description')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <Label htmlFor="delay-schedule">{t('reportDialog.scheduleLabel')}</Label>
            <select
              id="delay-schedule"
              className={SELECT_CLASS}
              value={scheduleId}
              onChange={(e) => setScheduleId(e.target.value)}
              aria-describedby={errors.scheduleId ? 'delay-schedule-error' : undefined}
            >
              <option value="">{t('reportDialog.schedulePlaceholder')}</option>
              {schedules.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            {errors.scheduleId && (
              <p id="delay-schedule-error" className="mt-1 text-sm text-destructive">
                {errors.scheduleId}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="delay-minutes">{t('reportDialog.minutesLabel')}</Label>
            <Input
              id="delay-minutes"
              type="number"
              min={1}
              max={1440}
              value={offsetMinutes}
              onChange={(e) => setOffsetMinutes(e.target.value)}
              placeholder={t('reportDialog.minutesPlaceholder')}
              aria-describedby={errors.offsetMinutes ? 'delay-minutes-error' : undefined}
            />
            {errors.offsetMinutes && (
              <p id="delay-minutes-error" className="mt-1 text-sm text-destructive">
                {errors.offsetMinutes}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="delay-reason">{t('reportDialog.reasonLabel')}</Label>
            <select
              id="delay-reason"
              className={SELECT_CLASS}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              aria-describedby={errors.reason ? 'delay-reason-error' : undefined}
            >
              <option value="">{t('reportDialog.reasonPlaceholder')}</option>
              {DELAY_REASONS.map((r) => (
                <option key={r} value={r}>
                  {t(`reportDialog.reasons.${r}`)}
                </option>
              ))}
            </select>
            {errors.reason && (
              <p id="delay-reason-error" className="mt-1 text-sm text-destructive">
                {errors.reason}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="delay-trip-date">{t('reportDialog.tripDateLabel')}</Label>
            <Input
              id="delay-trip-date"
              type="date"
              value={tripDate}
              onChange={(e) => setTripDate(e.target.value)}
              aria-describedby={errors.tripDate ? 'delay-trip-date-error' : undefined}
            />
            {errors.tripDate && (
              <p id="delay-trip-date-error" className="mt-1 text-sm text-destructive">
                {errors.tripDate}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="delay-note">{t('reportDialog.noteLabel')}</Label>
            <Input
              id="delay-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('reportDialog.notePlaceholder')}
              maxLength={500}
              aria-describedby={errors.note ? 'delay-note-error' : undefined}
            />
            {errors.note && (
              <p id="delay-note-error" className="mt-1 text-sm text-destructive">
                {errors.note}
              </p>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                {t('reportDialog.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={createDelay.isPending}>
              <AlertTriangle className="mr-2 h-4 w-4" aria-hidden="true" />
              {createDelay.isPending ? t('reportDialog.reporting') : t('reportDialog.report')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
