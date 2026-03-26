import { useCallback, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { ArrowLeft, AlertTriangle, Clock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCreateDelay } from '@/hooks/use-delays';
import { usePageTitle } from '@/hooks/use-page-title';

/** Preset delay options in minutes for quick selection. */
const PRESET_MINUTES = [5, 10, 15, 20, 30, 45, 60] as const;

/** All available delay reason values from the OpenAPI spec. */
const DELAY_REASONS = ['TRAFFIC', 'MECHANICAL', 'WEATHER', 'OTHER'] as const;

/** Shared CSS class for native select elements. */
const SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/**
 * Zod schema for the delay report form.
 * Constraints match the OpenAPI spec: offsetMinutes 1-1440, note max 500 chars,
 * scheduleId maxLength 30, tripDate maxLength 10.
 */
const delaySchema = z.object({
  scheduleId: z.string().min(1, 'Schedule is required').max(30),
  offsetMinutes: z.number().int().min(1, 'Must be at least 1 minute').max(1440, 'Max 1440 minutes'),
  reason: z.enum(DELAY_REASONS, { required_error: 'Reason is required' }),
  note: z.string().max(500, 'Max 500 characters').optional(),
  tripDate: z.string().min(1, 'Trip date is required').max(10),
});

/* ---------- Sub-components ---------- */

/** Props for {@link PresetButtons}. */
interface PresetButtonsProps {
  /** Currently selected minutes value (empty string if none). */
  selected: string;
  /** Callback when a preset is clicked. */
  onSelect: (minutes: number) => void;
}

/** Grid of preset delay minute buttons for quick selection. */
function PresetButtons({ selected, onSelect }: PresetButtonsProps) {
  const { t } = useTranslation('driver');
  return (
    <div className="grid grid-cols-4 gap-2" role="group" aria-label={t('delay.presetLabel')}>
      {PRESET_MINUTES.map((m) => (
        <Button
          key={m}
          type="button"
          variant={selected === String(m) ? 'default' : 'outline'}
          size="sm"
          onClick={() => onSelect(m)}
          aria-pressed={selected === String(m)}
        >
          <Clock className="mr-1 h-3 w-3" aria-hidden="true" />
          {m}m
        </Button>
      ))}
    </div>
  );
}

/* ---------- Main page ---------- */

/**
 * Driver delay reporting page.
 *
 * Allows the driver to report a delay for a specific trip using preset minute
 * buttons or a custom input, a reason dropdown, and optional notes.
 * Receives `scheduleId` and `date` from URL search params (set by trip-detail page).
 * On successful submission, redirects back to the trip detail page.
 *
 * @see {@link useCreateDelay} for the mutation hook
 */
export default function DriverDelayPage() {
  const { t } = useTranslation('driver');
  usePageTitle(t('delay.title'));
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const scheduleId = searchParams.get('scheduleId') ?? '';
  const tripDate = searchParams.get('date') ?? '';

  const createDelay = useCreateDelay();

  const [offsetMinutes, setOffsetMinutes] = useState('');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handlePresetSelect = useCallback((minutes: number) => {
    setOffsetMinutes(String(minutes));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.offsetMinutes;
      return next;
    });
  }, []);

  const handleCustomMinutesChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setOffsetMinutes(e.target.value);
  }, []);

  const handleBack = useCallback(() => {
    navigate(`/driver/trip/${scheduleId}?date=${tripDate}`);
  }, [navigate, scheduleId, tripDate]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setErrors({});

      const parsed = delaySchema.safeParse({
        scheduleId,
        offsetMinutes: offsetMinutes !== '' ? Number(offsetMinutes) : undefined,
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
          navigate(`/driver/trip/${scheduleId}?date=${tripDate}`);
        },
      });
    },
    [scheduleId, offsetMinutes, reason, note, tripDate, createDelay, navigate],
  );

  /* Missing params guard */
  if (!scheduleId || !tripDate) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-6">
        <p className="text-muted-foreground">{t('delay.missingParams')}</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/driver')}>
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
          {t('delay.backToTrips')}
        </Button>
      </div>
    );
  }

  return (
    <section className="mx-auto w-full max-w-lg px-4 py-6" aria-labelledby="delay-page-heading">
      <h1 id="delay-page-heading" className="sr-only">
        {t('delay.title')}
      </h1>

      <Button variant="ghost" size="sm" className="mb-4" onClick={handleBack}>
        <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
        {t('delay.backToTrip')}
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" aria-hidden="true" />
            {t('delay.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} noValidate className="space-y-6">
            {/* Preset minutes */}
            <div>
              <Label className="mb-2 block">{t('delay.quickSelect')}</Label>
              <PresetButtons selected={offsetMinutes} onSelect={handlePresetSelect} />
            </div>

            {/* Custom minutes */}
            <div>
              <Label htmlFor="delay-minutes">{t('delay.delayMinutes')}</Label>
              <Input
                id="delay-minutes"
                type="number"
                min={1}
                max={1440}
                value={offsetMinutes}
                onChange={handleCustomMinutesChange}
                placeholder={t('delay.customMinutesPlaceholder')}
                aria-describedby={errors.offsetMinutes ? 'delay-minutes-error' : undefined}
              />
              {errors.offsetMinutes && (
                <p id="delay-minutes-error" className="mt-1 text-sm text-destructive">
                  {errors.offsetMinutes}
                </p>
              )}
            </div>

            {/* Reason dropdown */}
            <div>
              <Label htmlFor="delay-reason">{t('delay.reason')}</Label>
              <select
                id="delay-reason"
                className={SELECT_CLASS}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                aria-describedby={errors.reason ? 'delay-reason-error' : undefined}
              >
                <option value="">{t('delay.selectReason')}</option>
                {DELAY_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {t(`delay.reasons.${r}`)}
                  </option>
                ))}
              </select>
              {errors.reason && (
                <p id="delay-reason-error" className="mt-1 text-sm text-destructive">
                  {errors.reason}
                </p>
              )}
            </div>

            {/* Notes */}
            <div>
              <Label htmlFor="delay-note">{t('delay.notesOptional')}</Label>
              <textarea
                id="delay-note"
                className={`${SELECT_CLASS} min-h-[80px] resize-y`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('delay.notesPlaceholder')}
                maxLength={500}
                aria-describedby={errors.note ? 'delay-note-error' : 'delay-note-hint'}
              />
              <p id="delay-note-hint" className="mt-1 text-xs text-muted-foreground">
                {t('delay.characterCount', { current: note.length, max: 500 })}
              </p>
              {errors.note && (
                <p id="delay-note-error" className="mt-1 text-sm text-destructive">
                  {errors.note}
                </p>
              )}
            </div>

            {/* Submit */}
            <div className="flex gap-3">
              <Button type="button" variant="outline" className="flex-1" onClick={handleBack}>
                {t('delay.cancel')}
              </Button>
              <Button type="submit" className="flex-1" disabled={createDelay.isPending}>
                <AlertTriangle className="mr-2 h-4 w-4" aria-hidden="true" />
                {createDelay.isPending ? t('delay.submitting') : t('delay.submit')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
