import { useState, useCallback, useMemo } from 'react';
import { MapPin, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PageError } from '@/components/shared/error-state';
import { EmptyState } from '@/components/shared/empty-state';
import { StationCard } from '@/components/admin/station-card';
import { StationFormDialog } from '@/components/admin/station-form-dialog';
import {
  useAdminStations,
  useCreateStation,
  useUpdateStation,
  useDeactivateStation,
} from '@/hooks/use-stations';
import { usePageTitle } from '@/hooks/use-page-title';
import type { components } from '@/api/generated/types';

type Station = components['schemas']['Station'];
type StationType = components['schemas']['StationType'];

const PAGE_SIZE = 20;
const STATION_TYPES: StationType[] = ['HUB', 'STATION', 'STOP'];

/* ---------- Skeleton ---------- */

/** Loading skeleton for the stations page. */
function StationListSkeleton({ t }: { t: (key: string) => string }) {
  return (
    <div aria-label={t('stations.loadingLabel')} className="space-y-3">
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-28 w-full rounded-lg" />
      ))}
    </div>
  );
}

/* ---------- Filter Bar ---------- */

/** Props for the station filter bar. */
interface StationFilterBarProps {
  /** Currently selected type filter. */
  type: StationType | undefined;
  /** Callback when the type filter changes. */
  onTypeChange: (type: StationType | undefined) => void;
  /** Current city filter value. */
  city: string;
  /** Callback when the city filter changes. */
  onCityChange: (city: string) => void;
  /** Whether to show only active stations. */
  activeOnly: boolean;
  /** Callback when the active filter changes. */
  onActiveChange: (active: boolean) => void;
  /** Current search query. */
  search: string;
  /** Callback when the search query changes. */
  onSearchChange: (search: string) => void;
}

/** Filter bar for the admin stations list. */
function StationFilterBar({
  type,
  onTypeChange,
  city,
  onCityChange,
  activeOnly,
  onActiveChange,
  search,
  onSearchChange,
}: StationFilterBarProps) {
  const { t } = useTranslation('admin');

  return (
    <div
      className="flex flex-wrap items-center gap-3"
      role="search"
      aria-label={t('stations.filtersLabel')}
    >
      <select
        className="flex h-10 w-36 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        value={type ?? 'ALL'}
        onChange={(e) => onTypeChange(e.target.value === 'ALL' ? undefined : (e.target.value as StationType))}
        aria-label={t('stations.typeLabel')}
      >
        <option value="ALL">{t('stations.allTypes')}</option>
        {STATION_TYPES.map((st) => (
          <option key={st} value={st}>
            {t(`stations.types.${st}`)}
          </option>
        ))}
      </select>

      <Input
        className="w-44"
        placeholder={t('stations.cityPlaceholder')}
        value={city}
        onChange={(e) => onCityChange(e.target.value)}
        aria-label={t('stations.cityLabel')}
      />

      <Input
        className="w-52"
        placeholder={t('stations.searchPlaceholder')}
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        aria-label={t('stations.searchLabel')}
      />

      <label className="flex items-center space-x-2 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-input"
          checked={activeOnly}
          onChange={(e) => onActiveChange(e.target.checked)}
        />
        <span>{t('stations.activeOnly')}</span>
      </label>
    </div>
  );
}

/* ---------- Pagination ---------- */

/** Pagination controls for the stations list. */
function StationPagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const { t } = useTranslation('admin');

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-4">
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
    </div>
  );
}

/* ---------- Grouped List ---------- */

/** Groups stations by city and renders them. */
function GroupedStationList({
  stations,
  onEdit,
  onDeactivate,
}: {
  stations: Station[];
  onEdit: (station: Station) => void;
  onDeactivate: (station: Station) => void;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, Station[]>();
    for (const station of stations) {
      const list = map.get(station.cityName) ?? [];
      list.push(station);
      map.set(station.cityName, list);
    }
    return Array.from(map.entries());
  }, [stations]);

  return (
    <div className="space-y-6">
      {grouped.map(([city, cityStations]) => (
        <div key={city} className="space-y-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
            <MapPin className="h-4 w-4" aria-hidden />
            {city}
          </h3>
          <div className="space-y-2">
            {cityStations.map((station) => (
              <StationCard
                key={station.id}
                station={station}
                onEdit={onEdit}
                onDeactivate={onDeactivate}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Main Page ---------- */

/** Admin stations management page. */
function AdminStationsPage() {
  const { t } = useTranslation('admin');
  usePageTitle(t('stations.title'));

  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<StationType | undefined>(undefined);
  const [cityFilter, setCityFilter] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editingStation, setEditingStation] = useState<Station | null>(null);
  const [deactivateStation, setDeactivateStation] = useState<Station | null>(null);

  const queryParams = useMemo(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      type: typeFilter,
      city: cityFilter || undefined,
      isActive: activeOnly || undefined,
      search: searchQuery || undefined,
    }),
    [page, typeFilter, cityFilter, activeOnly, searchQuery],
  );

  const { data: queryData, isLoading, isError, refetch } = useAdminStations(queryParams);
  const createMutation = useCreateStation();
  const updateMutation = useUpdateStation();
  const deactivateMutation = useDeactivateStation();

  const stations = queryData?.data ?? [];
  const totalPages = queryData?.meta?.totalPages ?? 1;

  const handleOpenCreate = useCallback(() => {
    setEditingStation(null);
    setFormOpen(true);
  }, []);

  const handleOpenEdit = useCallback((station: Station) => {
    setEditingStation(station);
    setFormOpen(true);
  }, []);

  const handleFormSubmit = useCallback(
    (data: Record<string, unknown>) => {
      const cleanData = { ...data };
      if (cleanData.phone === '') cleanData.phone = undefined;
      if (cleanData.email === '') cleanData.email = undefined;
      if (cleanData.platformCount === '') cleanData.platformCount = undefined;

      if (editingStation) {
        updateMutation.mutate(
          { id: editingStation.id, body: cleanData as components['schemas']['UpdateStationRequest'] },
          { onSuccess: () => setFormOpen(false) },
        );
      } else {
        createMutation.mutate(cleanData as components['schemas']['CreateStationRequest'], {
          onSuccess: () => setFormOpen(false),
        });
      }
    },
    [editingStation, createMutation, updateMutation],
  );

  const handleDeactivateConfirm = useCallback(() => {
    if (!deactivateStation) return;
    deactivateMutation.mutate(
      { id: deactivateStation.id },
      { onSuccess: () => setDeactivateStation(null) },
    );
  }, [deactivateStation, deactivateMutation]);

  const handleTypeChange = useCallback((type: StationType | undefined) => {
    setTypeFilter(type);
    setPage(1);
  }, []);

  const handleCityChange = useCallback((city: string) => {
    setCityFilter(city);
    setPage(1);
  }, []);

  const handleActiveChange = useCallback((active: boolean) => {
    setActiveOnly(active);
    setPage(1);
  }, []);

  const handleSearchChange = useCallback((search: string) => {
    setSearchQuery(search);
    setPage(1);
  }, []);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('stations.title')}</h1>
          <p className="mt-1 text-muted-foreground">{t('stations.subtitle')}</p>
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus className="mr-2 h-4 w-4" aria-hidden />
          {t('stations.addStation')}
        </Button>
      </div>

      <div className="mt-6">
        <StationFilterBar
          type={typeFilter}
          onTypeChange={handleTypeChange}
          city={cityFilter}
          onCityChange={handleCityChange}
          activeOnly={activeOnly}
          onActiveChange={handleActiveChange}
          search={searchQuery}
          onSearchChange={handleSearchChange}
        />
      </div>

      <section className="mt-6" aria-labelledby="station-list-heading">
        <h2 id="station-list-heading" className="sr-only">
          {t('stations.heading')}
        </h2>

        {isLoading && <StationListSkeleton t={t} />}

        {isError && !queryData && (
          <PageError
            title={t('stations.error.title')}
            message={t('stations.error.message')}
            onRetry={() => void refetch()}
          />
        )}

        {!isLoading && !isError && stations.length === 0 && (
          <EmptyState
            icon={MapPin}
            title={t('stations.empty.title')}
            message={t('stations.empty.message')}
          />
        )}

        {!isLoading && stations.length > 0 && (
          <>
            <GroupedStationList
              stations={stations}
              onEdit={handleOpenEdit}
              onDeactivate={setDeactivateStation}
            />
            <div className="mt-6">
              <StationPagination
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            </div>
          </>
        )}
      </section>

      {/* Create/Edit Dialog */}
      <StationFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        station={editingStation}
        onSubmit={handleFormSubmit}
        isPending={createMutation.isPending || updateMutation.isPending}
      />

      {/* Deactivate Confirmation Dialog */}
      <Dialog open={!!deactivateStation} onOpenChange={(open) => !open && setDeactivateStation(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('stations.confirm.deactivateTitle')}</DialogTitle>
            <DialogDescription>
              {t('stations.confirm.deactivateDescription')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeactivateStation(null)}
              disabled={deactivateMutation.isPending}
            >
              {t('stations.confirm.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeactivateConfirm}
              disabled={deactivateMutation.isPending}
            >
              {deactivateMutation.isPending
                ? t('stations.confirm.processing')
                : t('stations.actions.deactivate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AdminStationsPage;
