import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRightLeft, Calendar, MapPin, Search } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useCities } from '@/hooks/use-search';
import type { TFunction } from 'i18next';

const today = () => format(new Date(), 'yyyy-MM-dd');

/**
 * Creates a search form Zod schema with translated validation messages.
 * @param t - Translation function from the 'search' namespace
 * @returns Zod schema for the search form
 */
function createSearchFormSchema(t: TFunction) {
  return z
    .object({
      origin: z.string().min(1, t('form.validation.originRequired')),
      destination: z.string().min(1, t('form.validation.destinationRequired')),
      date: z.string().min(1, t('form.validation.dateRequired')),
    })
    .refine((data) => data.origin !== data.destination, {
      message: t('form.validation.sameOriginDestination'),
      path: ['destination'],
    });
}

type SearchFormValues = z.infer<ReturnType<typeof createSearchFormSchema>>;

/** Props for the {@link SearchForm} component. */
export interface SearchFormProps {
  /** Compact mode renders a single-row layout for the home page hero. Full mode is for the search page. */
  mode?: 'compact' | 'full';
  /** CSS class name applied to the form wrapper. */
  className?: string;
}

/** Props for the city select field. */
interface CitySelectProps {
  /** Field id for the input element. */
  id: string;
  /** Label text. */
  label: string;
  /** Current value (for placeholder styling). */
  value: string;
  /** Whether to hide the label (sr-only). */
  hideLabel: boolean;
  /** Error message if validation failed. */
  error?: string;
  /** Whether the field is invalid. */
  isInvalid: boolean;
  /** Register props spread onto the select. */
  registration: ReturnType<typeof useForm<SearchFormValues>>['register'] extends (
    n: infer _N,
  ) => infer R
    ? R
    : never;
  /** Placeholder text for the empty option. */
  placeholder: string;
  /** List of city names to display as options. */
  cities: string[];
}

/** City dropdown select field with icon, label, and error display. */
function CitySelect({
  id,
  label,
  value,
  hideLabel,
  error,
  isInvalid,
  registration,
  placeholder,
  cities,
}: CitySelectProps) {
  const errorId = `${id}-error`;
  return (
    <div className="relative">
      <Label htmlFor={id} className={hideLabel ? 'sr-only' : 'mb-1.5 block text-sm font-medium'}>
        {label}
      </Label>
      <div className="relative">
        <MapPin
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <select
          id={id}
          {...registration}
          className={cn(
            'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-9 text-sm ring-offset-background',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            !value && 'text-muted-foreground',
            isInvalid && 'border-destructive',
          )}
          aria-invalid={isInvalid ? 'true' : undefined}
          aria-describedby={isInvalid ? errorId : undefined}
        >
          <option value="">{placeholder}</option>
          {cities.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <p id={errorId} className="mt-1 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** Props for the date input field. */
interface DateFieldProps {
  /** Whether to hide the label (sr-only). */
  hideLabel: boolean;
  /** Error message if validation failed. */
  error?: string;
  /** Whether the field is invalid. */
  isInvalid: boolean;
  /** Register props spread onto the input. */
  registration: ReturnType<typeof useForm<SearchFormValues>>['register'] extends (
    n: infer _N,
  ) => infer R
    ? R
    : never;
  /** Label text for the date field. */
  label: string;
}

/** Date input field with calendar icon, label, and error display. */
function DateField({ hideLabel, error, isInvalid, registration, label }: DateFieldProps) {
  return (
    <div className="relative">
      <Label
        htmlFor="search-date"
        className={hideLabel ? 'sr-only' : 'mb-1.5 block text-sm font-medium'}
      >
        {label}
      </Label>
      <div className="relative">
        <Calendar
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          id="search-date"
          type="date"
          min={today()}
          {...registration}
          className={cn(
            'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-9 text-sm ring-offset-background',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            isInvalid && 'border-destructive',
          )}
          aria-invalid={isInvalid ? 'true' : undefined}
          aria-describedby={isInvalid ? 'search-date-error' : undefined}
        />
      </div>
      {error && (
        <p id="search-date-error" className="mt-1 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Search form for finding bus trips between cities.
 *
 * Features:
 * - City dropdowns populated from the API (`GET /api/v1/cities`)
 * - Date picker defaulting to today with min date constraint
 * - Swap button to exchange origin and destination
 * - Form validation: both fields required, origin ≠ destination
 * - Navigates to `/search` with query params on submit
 * - Supports compact (home hero) and full (search page) layout modes
 *
 * @example
 * ```tsx
 * <SearchForm mode="compact" />
 * <SearchForm mode="full" className="mt-4" />
 * ```
 */
export function SearchForm({ mode = 'compact', className }: SearchFormProps) {
  const { t } = useTranslation('search');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: citiesData } = useCities();
  const cities = citiesData?.data ?? [];

  const schema = useMemo(() => createSearchFormSchema(t), [t]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SearchFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      origin: searchParams.get('origin') ?? '',
      destination: searchParams.get('destination') ?? '',
      date: searchParams.get('date') ?? today(),
    },
  });

  const origin = watch('origin');
  const destination = watch('destination');

  const handleSwap = () => {
    setValue('origin', destination, { shouldValidate: true });
    setValue('destination', origin, { shouldValidate: true });
  };

  const onSubmit = (data: SearchFormValues) => {
    const params = new URLSearchParams();
    params.set('origin', data.origin);
    params.set('destination', data.destination);
    params.set('date', data.date);
    navigate(`/search?${params.toString()}`);
  };

  const isCompact = mode === 'compact';

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className={cn(
        isCompact ? 'glass-card p-6' : 'rounded-lg border border-border bg-card p-6',
        className,
      )}
      role="search"
      aria-label={t('form.searchAriaLabel')}
      noValidate
    >
      <div
        className={cn(
          'grid gap-4',
          isCompact
            ? 'sm:grid-cols-2 lg:grid-cols-4'
            : 'gap-y-5 sm:grid-cols-2 lg:grid-cols-[1fr_auto_1fr_1fr_auto]',
        )}
      >
        <CitySelect
          id="search-origin"
          label={t('form.origin')}
          value={origin}
          hideLabel={isCompact}
          error={errors.origin?.message}
          isInvalid={!!errors.origin}
          registration={register('origin')}
          placeholder={t('form.selectPlaceholder', { label: t('form.origin').toLowerCase() })}
          cities={cities}
        />

        {/* Swap button (only in full mode, placed between origin and destination) */}
        {!isCompact && (
          <div className="flex items-end justify-center pb-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleSwap}
              aria-label={t('form.swapAriaLabel')}
              className="h-10 w-10"
            >
              <ArrowRightLeft className="h-4 w-4" />
            </Button>
          </div>
        )}

        <CitySelect
          id="search-destination"
          label={t('form.destination')}
          value={destination}
          hideLabel={isCompact}
          error={errors.destination?.message}
          isInvalid={!!errors.destination}
          registration={register('destination')}
          placeholder={t('form.selectPlaceholder', { label: t('form.destination').toLowerCase() })}
          cities={cities}
        />

        <DateField
          hideLabel={isCompact}
          error={errors.date?.message}
          isInvalid={!!errors.date}
          registration={register('date')}
          label={t('form.date')}
        />

        {/* Submit + Swap (compact) */}
        <div className={cn(!isCompact && 'flex items-end')}>
          {isCompact && (
            <div className="mb-2 flex justify-center sm:hidden">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleSwap}
                aria-label={t('form.swapAriaLabel')}
              >
                <ArrowRightLeft className="mr-2 h-4 w-4" />
                {t('form.swap')}
              </Button>
            </div>
          )}
          <Button type="submit" className="w-full">
            <Search className="mr-2 h-4 w-4" />
            {t('form.submit')}
          </Button>
        </div>
      </div>

      {/* Swap button for compact mode on larger screens - between the two selects */}
      {isCompact && (
        <div className="mt-3 hidden justify-center sm:flex lg:hidden">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleSwap}
            aria-label={t('form.swapAriaLabel')}
          >
            <ArrowRightLeft className="mr-2 h-4 w-4" />
            {t('form.swap')}
          </Button>
        </div>
      )}
    </form>
  );
}
