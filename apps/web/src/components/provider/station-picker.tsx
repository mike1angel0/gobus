import { useState, useCallback, useRef, useEffect } from 'react';
import { MapPin, Plus, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useSearchStations, useProviderCreateStop } from '@/hooks/use-stations';
import type { components } from '@/api/generated/types';

type Station = components['schemas']['Station'];

/** Props for the station picker component. */
interface StationPickerProps {
  /** Currently selected station. */
  value: Station | null;
  /** Callback when a station is selected. */
  onChange: (station: Station | null) => void;
  /** Placeholder text. */
  placeholder?: string;
  /** Whether to show inline creation form when no results found. */
  allowCreate?: boolean;
}

/**
 * Station picker component with search, selection, and inline stop creation.
 * Used by providers when creating routes to pick stations/stops.
 */
export function StationPicker({ value, onChange, placeholder, allowCreate }: StationPickerProps) {
  const { t } = useTranslation('admin');
  const { t: tp } = useTranslation('provider');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data } = useSearchStations({
    search: search.length >= 2 ? search : undefined,
    pageSize: 10,
  });

  const stations = data?.data ?? [];
  const createStop = useProviderCreateStop();

  const handleSelect = useCallback(
    (station: Station) => {
      onChange(station);
      setOpen(false);
      setSearch('');
      setShowCreateForm(false);
    },
    [onChange],
  );

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowCreateForm(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        className="w-full justify-start text-left font-normal"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {value ? (
          <span className="flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">{value.name}</span>
            <Badge variant="outline" className="ml-auto text-xs">
              {value.cityName}
            </Badge>
          </span>
        ) : (
          <span className="text-muted-foreground">
            {placeholder ?? tp('routes.stops.selectStation')}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-80 rounded-md border bg-background shadow-md">
          {!showCreateForm ? (
            <>
              <div className="flex items-center border-b px-3">
                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" aria-hidden />
                <Input
                  placeholder="Search stations..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="border-0 focus-visible:ring-0"
                  aria-label="Search stations"
                  autoFocus
                />
              </div>

              <div className="max-h-60 overflow-y-auto p-1" role="listbox">
                {stations.length === 0 && search.length >= 2 && (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No stations found.
                    {allowCreate && (
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="mt-1 w-full"
                        onClick={() => setShowCreateForm(true)}
                      >
                        <Plus className="mr-1 h-3 w-3" aria-hidden />
                        {tp('routes.stops.createStopTitle')}
                      </Button>
                    )}
                  </div>
                )}

                {stations.map((station) => (
                  <button
                    key={station.id}
                    type="button"
                    role="option"
                    aria-selected={value?.id === station.id}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                    onClick={() => handleSelect(station)}
                  >
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="flex-1 truncate">{station.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {t(`stations.types.${station.type}`)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{station.cityName}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <InlineCreateForm
              onCreated={(station) => handleSelect(station)}
              onCancel={() => setShowCreateForm(false)}
              createStop={createStop}
              initialName={search}
            />
          )}
        </div>
      )}
    </div>
  );
}

/** Props for the inline create form. */
interface InlineCreateFormProps {
  /** Callback when a stop is successfully created. */
  onCreated: (station: Station) => void;
  /** Callback when creation is cancelled. */
  onCancel: () => void;
  /** The mutation hook for creating stops. */
  createStop: ReturnType<typeof useProviderCreateStop>;
  /** Pre-fill name from search. */
  initialName: string;
}

/** Inline form for creating a new stop inside the picker dropdown. */
function InlineCreateForm({ onCreated, onCancel, createStop, initialName }: InlineCreateFormProps) {
  const { t } = useTranslation('provider');
  const [name, setName] = useState(initialName);
  const [cityName, setCityName] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    if (!name.trim() || !cityName.trim() || !address.trim() || isNaN(parsedLat) || isNaN(parsedLng)) return;

    createStop.mutate(
      { name: name.trim(), cityName: cityName.trim(), address: address.trim(), lat: parsedLat, lng: parsedLng },
      {
        onSuccess: (data) => {
          if (data?.data) {
            onCreated(data.data as Station);
          }
        },
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 p-3">
      <p className="text-sm font-medium">{t('routes.stops.createStopTitle')}</p>
      <div>
        <Label htmlFor="inline-stop-name" className="sr-only">{t('routes.stops.createStopName')}</Label>
        <Input id="inline-stop-name" placeholder={t('routes.stops.createStopName')} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </div>
      <div>
        <Label htmlFor="inline-stop-city" className="sr-only">{t('routes.stops.createStopCity')}</Label>
        <Input id="inline-stop-city" placeholder={t('routes.stops.createStopCity')} value={cityName} onChange={(e) => setCityName(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="inline-stop-address" className="sr-only">{t('routes.stops.createStopAddress')}</Label>
        <Input id="inline-stop-address" placeholder={t('routes.stops.createStopAddress')} value={address} onChange={(e) => setAddress(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <Label htmlFor="inline-stop-lat" className="sr-only">{t('routes.stops.createStopLat')}</Label>
          <Input id="inline-stop-lat" placeholder={t('routes.stops.createStopLat')} type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)} />
        </div>
        <div className="flex-1">
          <Label htmlFor="inline-stop-lng" className="sr-only">{t('routes.stops.createStopLng')}</Label>
          <Input id="inline-stop-lng" placeholder={t('routes.stops.createStopLng')} type="number" step="any" value={lng} onChange={(e) => setLng(e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" size="sm" disabled={createStop.isPending}>
          {createStop.isPending ? t('routes.stops.createStopCreating') : t('routes.stops.createStopSubmit')}
        </Button>
      </div>
    </form>
  );
}
