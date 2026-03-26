import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Route as RouteIcon, Plus, Trash2, MapPin, ArrowUp, ArrowDown, X } from 'lucide-react';
import type { TFunction } from 'i18next';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { useRoutes, useCreateRoute, useDeleteRoute } from '@/hooks/use-routes';
import { isApiError } from '@/api/errors';
import type { components } from '@/api/generated/types';

type Route = components['schemas']['Route'];

/** Maximum route name length per OpenAPI spec. */
const MAX_NAME_LENGTH = 200;
/** Maximum stop name length per OpenAPI spec. */
const MAX_STOP_NAME_LENGTH = 200;
/** Maximum number of stops per route per OpenAPI spec. */
const MAX_STOPS = 100;

/** A stop entry in the create route form. */
interface StopFormEntry {
  /** Unique key for React rendering. */
  key: number;
  /** Stop name. */
  name: string;
  /** Latitude coordinate. */
  lat: string;
  /** Longitude coordinate. */
  lng: string;
}

/** Creates an empty stop entry with a unique key. */
function createEmptyStop(key: number): StopFormEntry {
  return { key, name: '', lat: '', lng: '' };
}

/* ---------- Route Card ---------- */

/** Props for {@link RouteCard}. */
interface RouteCardProps {
  /** Route data to display. */
  route: Route;
  /** Callback when delete is requested. */
  onDelete: (id: string) => void;
  /** Whether a delete operation is in progress. */
  isDeleting: boolean;
}

/** Displays a single route card with name and delete action. */
function RouteCard({ route, onDelete, isDeleting }: RouteCardProps) {
  const { t } = useTranslation('provider');
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <Card>
      <CardContent className="flex items-start justify-between p-6">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <RouteIcon className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <h3 className="truncate font-semibold">{route.name}</h3>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('routes.card.idLabel', { id: route.id })}
          </p>
        </div>
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('routes.card.deleteLabel', { name: route.name })}
            >
              <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('routes.card.deleteTitle')}</DialogTitle>
              <DialogDescription>
                {t('routes.card.deleteDescription', { name: route.name })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">{t('common.cancel')}</Button>
              </DialogClose>
              <Button
                variant="destructive"
                disabled={isDeleting}
                onClick={() => {
                  onDelete(route.id);
                  setConfirmOpen(false);
                }}
              >
                {isDeleting ? t('routes.card.deleting') : t('routes.card.delete')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

/* ---------- Stops Builder ---------- */

/** Props for {@link StopsBuilder}. */
interface StopsBuilderProps {
  /** Current list of stops. */
  stops: StopFormEntry[];
  /** Callback to update the stops list. */
  onChange: (stops: StopFormEntry[]) => void;
  /** Validation error for the stops array. */
  error?: string;
}

/** Interactive stop list builder for creating routes. */
function StopsBuilder({ stops, onChange, error }: StopsBuilderProps) {
  const { t } = useTranslation('provider');
  const nextKey = stops.length > 0 ? Math.max(...stops.map((s) => s.key)) + 1 : 0;

  function addStop() {
    if (stops.length >= MAX_STOPS) return;
    onChange([...stops, createEmptyStop(nextKey)]);
  }

  function removeStop(key: number) {
    onChange(stops.filter((s) => s.key !== key));
  }

  function updateStop(key: number, field: keyof Omit<StopFormEntry, 'key'>, value: string) {
    onChange(stops.map((s) => (s.key === key ? { ...s, [field]: value } : s)));
  }

  function moveStop(index: number, direction: -1 | 1) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= stops.length) return;
    const updated = [...stops];
    const temp = updated[index];
    updated[index] = updated[newIndex];
    updated[newIndex] = temp;
    onChange(updated);
  }

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">
        {t('routes.stops.legend', { count: stops.length })}
      </legend>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <ul className="space-y-2" aria-label={t('routes.stops.listLabel')}>
        {stops.map((stop, index) => (
          <li
            key={stop.key}
            className="flex items-start gap-2 rounded-lg border border-border/50 p-3"
          >
            <div className="flex shrink-0 flex-col gap-1 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                disabled={index === 0}
                onClick={() => moveStop(index, -1)}
                aria-label={t('routes.stops.moveUp', { name: stop.name || String(index + 1) })}
              >
                <ArrowUp className="h-3 w-3" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                disabled={index === stops.length - 1}
                onClick={() => moveStop(index, 1)}
                aria-label={t('routes.stops.moveDown', { name: stop.name || String(index + 1) })}
              >
                <ArrowDown className="h-3 w-3" aria-hidden="true" />
              </Button>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start">
              <div className="flex-1">
                <Label htmlFor={`stop-name-${stop.key}`} className="sr-only">
                  {t('routes.stops.nameLabel', { index: index + 1 })}
                </Label>
                <Input
                  id={`stop-name-${stop.key}`}
                  placeholder={t('routes.stops.namePlaceholder')}
                  maxLength={MAX_STOP_NAME_LENGTH}
                  value={stop.name}
                  onChange={(e) => updateStop(stop.key, 'name', e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <div className="w-24">
                  <Label htmlFor={`stop-lat-${stop.key}`} className="sr-only">
                    {t('routes.stops.latLabel', { index: index + 1 })}
                  </Label>
                  <Input
                    id={`stop-lat-${stop.key}`}
                    placeholder={t('routes.stops.latPlaceholder')}
                    type="number"
                    step="any"
                    min={-90}
                    max={90}
                    value={stop.lat}
                    onChange={(e) => updateStop(stop.key, 'lat', e.target.value)}
                  />
                </div>
                <div className="w-24">
                  <Label htmlFor={`stop-lng-${stop.key}`} className="sr-only">
                    {t('routes.stops.lngLabel', { index: index + 1 })}
                  </Label>
                  <Input
                    id={`stop-lng-${stop.key}`}
                    placeholder={t('routes.stops.lngPlaceholder')}
                    type="number"
                    step="any"
                    min={-180}
                    max={180}
                    value={stop.lng}
                    onChange={(e) => updateStop(stop.key, 'lng', e.target.value)}
                  />
                </div>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => removeStop(stop.key)}
              aria-label={t('routes.stops.removeLabel', { name: stop.name || String(index + 1) })}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ul>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addStop}
        disabled={stops.length >= MAX_STOPS}
      >
        <MapPin className="mr-1 h-4 w-4" aria-hidden="true" />
        {t('routes.stops.addStop')}
      </Button>
    </fieldset>
  );
}

/* ---------- Create Route Dialog ---------- */

/** Props for {@link CreateRouteDialog}. */
interface CreateRouteDialogProps {
  /** Children used as the trigger element. */
  children: React.ReactNode;
}

/** Dialog form for creating a new route with stops. */
function CreateRouteDialog({ children }: CreateRouteDialogProps) {
  const { t } = useTranslation('provider');
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [stops, setStops] = useState<StopFormEntry[]>([createEmptyStop(0), createEmptyStop(1)]);
  const [errors, setErrors] = useState<{ name?: string; stops?: string }>({});
  const createRoute = useCreateRoute();

  function resetForm() {
    setName('');
    setStops([createEmptyStop(0), createEmptyStop(1)]);
    setErrors({});
  }

  function validate(t: TFunction): boolean {
    const newErrors: { name?: string; stops?: string } = {};
    const trimmedName = name.trim();

    if (!trimmedName) {
      newErrors.name = t('routes.validation.nameRequired');
    } else if (trimmedName.length > MAX_NAME_LENGTH) {
      newErrors.name = t('routes.validation.nameMaxLength', { max: MAX_NAME_LENGTH });
    }

    if (stops.length < 2) {
      newErrors.stops = t('routes.validation.minStops');
    } else {
      for (let i = 0; i < stops.length; i++) {
        const stop = stops[i];
        if (!stop.name.trim()) {
          newErrors.stops = t('routes.validation.stopNameRequired', { index: i + 1 });
          break;
        }
        if (stop.name.trim().length > MAX_STOP_NAME_LENGTH) {
          newErrors.stops = t('routes.validation.stopNameMaxLength', {
            index: i + 1,
            max: MAX_STOP_NAME_LENGTH,
          });
          break;
        }
        const lat = parseFloat(stop.lat);
        const lng = parseFloat(stop.lng);
        if (isNaN(lat) || lat < -90 || lat > 90) {
          newErrors.stops = t('routes.validation.stopLatRange', { index: i + 1 });
          break;
        }
        if (isNaN(lng) || lng < -180 || lng > 180) {
          newErrors.stops = t('routes.validation.stopLngRange', { index: i + 1 });
          break;
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate(t)) return;

    createRoute.mutate(
      {
        name: name.trim(),
        stops: stops.map((stop, index) => ({
          name: stop.name.trim(),
          lat: parseFloat(stop.lat),
          lng: parseFloat(stop.lng),
          orderIndex: index,
        })),
      },
      {
        onSuccess: () => {
          resetForm();
          setOpen(false);
        },
        onError: (error: unknown) => {
          if (isApiError(error)) {
            for (const fieldError of error.fieldErrors) {
              if (fieldError.field === 'name') {
                setErrors((prev) => ({ ...prev, name: fieldError.message }));
              } else if (fieldError.field?.startsWith('stops')) {
                setErrors((prev) => ({ ...prev, stops: fieldError.message }));
              }
            }
          }
        },
      },
    );
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
          <DialogTitle>{t('routes.createDialog.title')}</DialogTitle>
          <DialogDescription>{t('routes.createDialog.description')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="route-name">{t('routes.createDialog.nameLabel')}</Label>
            <Input
              id="route-name"
              placeholder={t('routes.createDialog.namePlaceholder')}
              maxLength={MAX_NAME_LENGTH}
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'route-name-error' : undefined}
            />
            {errors.name && (
              <p id="route-name-error" role="alert" className="text-sm text-destructive">
                {errors.name}
              </p>
            )}
          </div>

          <StopsBuilder stops={stops} onChange={setStops} error={errors.stops} />

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={createRoute.isPending}>
              {createRoute.isPending
                ? t('routes.createDialog.creating')
                : t('routes.createDialog.createButton')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Route List Section ---------- */

/** Props for {@link RouteListSection}. */
interface RouteListSectionProps {
  /** Route data. */
  routes: Route[];
  /** Callback to delete a route. */
  onDelete: (id: string) => void;
  /** Whether a delete mutation is in progress. */
  isDeleting: boolean;
}

/** Renders the grid of route cards. */
function RouteListSection({ routes, onDelete, isDeleting }: RouteListSectionProps) {
  const { t } = useTranslation('provider');

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label={t('routes.listLabel')}>
      {routes.map((route) => (
        <RouteCard key={route.id} route={route} onDelete={onDelete} isDeleting={isDeleting} />
      ))}
    </div>
  );
}

/* ---------- Page ---------- */

/**
 * Provider route management page.
 *
 * Displays a list of the provider's routes with create and delete functionality.
 * Routes are shown in a responsive grid. Creating a route opens a dialog with
 * a form including a stops builder that supports add, remove, and reorder.
 *
 * @example
 * ```
 * // Route: /provider/routes (requires PROVIDER role)
 * <ProviderRoutesPage />
 * ```
 */
export default function ProviderRoutesPage() {
  const { t } = useTranslation('provider');
  usePageTitle(t('routes.title'));
  const routesQuery = useRoutes({ page: 1, pageSize: 50 });
  const deleteRoute = useDeleteRoute();

  const routes = routesQuery.data?.data ?? [];
  const isLoading = routesQuery.isLoading;
  const isError = routesQuery.isError && !routesQuery.data;

  function handleDelete(id: string) {
    deleteRoute.mutate(id);
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('routes.title')}</h1>
          <p className="mt-1 text-muted-foreground">{t('routes.subtitle')}</p>
        </div>
        <CreateRouteDialog>
          <Button>
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            {t('routes.create')}
          </Button>
        </CreateRouteDialog>
      </div>

      <section aria-labelledby="routes-heading">
        <h2 id="routes-heading" className="sr-only">
          {t('routes.title')}
        </h2>
        {isLoading && <CardGridSkeleton label={t('routes.loadingLabel')} />}
        {isError && (
          <PageError
            title={t('routes.error.title')}
            message={t('routes.error.message')}
            onRetry={() => routesQuery.refetch()}
          />
        )}
        {!isLoading && !isError && routes.length === 0 && (
          <EmptyState
            icon={RouteIcon}
            title={t('routes.empty.title')}
            message={t('routes.empty.message')}
          />
        )}
        {!isLoading && !isError && routes.length > 0 && (
          <RouteListSection
            routes={routes}
            onDelete={handleDelete}
            isDeleting={deleteRoute.isPending}
          />
        )}
      </section>
    </div>
  );
}
