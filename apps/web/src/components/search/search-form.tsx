import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRightLeft, Calendar, MapPin, Search } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/**
 * European cities available for trip search.
 * Each entry is a `[value, label]` tuple where value is what gets sent as a query param.
 */
const CITIES = [
  'Amsterdam',
  'Barcelona',
  'Berlin',
  'Brussels',
  'Budapest',
  'Copenhagen',
  'Dublin',
  'Lisbon',
  'London',
  'Munich',
  'Paris',
  'Prague',
  'Rome',
  'Vienna',
  'Warsaw',
] as const;

const today = () => format(new Date(), 'yyyy-MM-dd');

const searchFormSchema = z
  .object({
    origin: z.string().min(1, 'Origin is required'),
    destination: z.string().min(1, 'Destination is required'),
    date: z.string().min(1, 'Date is required'),
  })
  .refine((data) => data.origin !== data.destination, {
    message: 'Origin and destination must be different',
    path: ['destination'],
  });

type SearchFormValues = z.infer<typeof searchFormSchema>;

/** Props for the {@link SearchForm} component. */
export interface SearchFormProps {
  /** Compact mode renders a single-row layout for the home page hero. Full mode is for the search page. */
  mode?: 'compact' | 'full';
  /** CSS class name applied to the form wrapper. */
  className?: string;
}

/**
 * Search form for finding bus trips between European cities.
 *
 * Features:
 * - City dropdowns for origin and destination (15 European cities)
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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SearchFormValues>({
    resolver: zodResolver(searchFormSchema),
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
      className={cn(isCompact ? 'glass-card p-6' : 'rounded-lg border border-border bg-card p-6', className)}
      role="search"
      aria-label="Search trips"
      noValidate
    >
      <div
        className={cn(
          'grid gap-4',
          isCompact ? 'sm:grid-cols-2 lg:grid-cols-4' : 'gap-y-5 sm:grid-cols-2 lg:grid-cols-[1fr_auto_1fr_1fr_auto]',
        )}
      >
        {/* Origin */}
        <div className="relative">
          <Label htmlFor="search-origin" className={isCompact ? 'sr-only' : 'mb-1.5 block text-sm font-medium'}>
            Origin
          </Label>
          <div className="relative">
            <MapPin
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <select
              id="search-origin"
              {...register('origin')}
              className={cn(
                'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-9 text-sm ring-offset-background',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-50',
                !origin && 'text-muted-foreground',
                errors.origin && 'border-destructive',
              )}
              aria-invalid={errors.origin ? 'true' : undefined}
              aria-describedby={errors.origin ? 'search-origin-error' : undefined}
            >
              <option value="">Select origin</option>
              {CITIES.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>
          {errors.origin && (
            <p id="search-origin-error" className="mt-1 text-xs text-destructive" role="alert">
              {errors.origin.message}
            </p>
          )}
        </div>

        {/* Swap button (only in full mode, placed between origin and destination) */}
        {!isCompact && (
          <div className="flex items-end justify-center pb-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleSwap}
              aria-label="Swap origin and destination"
              className="h-10 w-10"
            >
              <ArrowRightLeft className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Destination */}
        <div className="relative">
          <Label htmlFor="search-destination" className={isCompact ? 'sr-only' : 'mb-1.5 block text-sm font-medium'}>
            Destination
          </Label>
          <div className="relative">
            <MapPin
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <select
              id="search-destination"
              {...register('destination')}
              className={cn(
                'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-9 text-sm ring-offset-background',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-50',
                !destination && 'text-muted-foreground',
                errors.destination && 'border-destructive',
              )}
              aria-invalid={errors.destination ? 'true' : undefined}
              aria-describedby={errors.destination ? 'search-destination-error' : undefined}
            >
              <option value="">Select destination</option>
              {CITIES.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>
          {errors.destination && (
            <p id="search-destination-error" className="mt-1 text-xs text-destructive" role="alert">
              {errors.destination.message}
            </p>
          )}
        </div>

        {/* Date */}
        <div className="relative">
          <Label htmlFor="search-date" className={isCompact ? 'sr-only' : 'mb-1.5 block text-sm font-medium'}>
            Travel date
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
              {...register('date')}
              className={cn(
                'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-9 text-sm ring-offset-background',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-50',
                errors.date && 'border-destructive',
              )}
              aria-invalid={errors.date ? 'true' : undefined}
              aria-describedby={errors.date ? 'search-date-error' : undefined}
            />
          </div>
          {errors.date && (
            <p id="search-date-error" className="mt-1 text-xs text-destructive" role="alert">
              {errors.date.message}
            </p>
          )}
        </div>

        {/* Submit + Swap (compact) */}
        <div className={cn(!isCompact && 'flex items-end')}>
          {isCompact && (
            <div className="mb-2 flex justify-center sm:hidden">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleSwap}
                aria-label="Swap origin and destination"
              >
                <ArrowRightLeft className="mr-2 h-4 w-4" />
                Swap
              </Button>
            </div>
          )}
          <Button type="submit" className="w-full">
            <Search className="mr-2 h-4 w-4" />
            Search
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
            aria-label="Swap origin and destination"
          >
            <ArrowRightLeft className="mr-2 h-4 w-4" />
            Swap
          </Button>
        </div>
      )}
    </form>
  );
}
