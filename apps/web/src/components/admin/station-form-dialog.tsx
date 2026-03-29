import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
} from '@/components/ui/dialog';
import type { components } from '@/api/generated/types';

type Station = components['schemas']['Station'];
type StationType = components['schemas']['StationType'];
type StationFacility = components['schemas']['StationFacility'];

const STATION_TYPES: StationType[] = ['HUB', 'STATION', 'STOP'];
const FACILITIES: StationFacility[] = [
  'WIFI',
  'PARKING',
  'WAITING_ROOM',
  'RESTROOM',
  'TICKET_OFFICE',
  'LUGGAGE_STORAGE',
];

const stationFormSchema = z.object({
  name: z.string().min(1).max(200),
  cityName: z.string().min(1).max(200),
  type: z.enum(['HUB', 'STATION', 'STOP']),
  address: z.string().min(1).max(500),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  facilities: z.array(z.enum(['WIFI', 'PARKING', 'WAITING_ROOM', 'RESTROOM', 'TICKET_OFFICE', 'LUGGAGE_STORAGE'])),
  phone: z.string().max(20).optional().or(z.literal('')),
  email: z.string().email().max(255).optional().or(z.literal('')),
  platformCount: z.coerce.number().int().min(0).max(100).optional().or(z.literal('')),
});

type StationFormData = z.infer<typeof stationFormSchema>;

/** Props for the station form dialog. */
interface StationFormDialogProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Callback when the dialog should close. */
  onOpenChange: (open: boolean) => void;
  /** Station to edit, or null for create mode. */
  station: Station | null;
  /** Callback when the form is submitted. */
  onSubmit: (data: StationFormData) => void;
  /** Whether a mutation is in progress. */
  isPending: boolean;
}

/** Dialog form for creating or editing a station. */
export function StationFormDialog({ open, onOpenChange, station, onSubmit, isPending }: StationFormDialogProps) {
  const { t } = useTranslation('admin');
  const isEdit = station !== null;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<StationFormData>({
    resolver: zodResolver(stationFormSchema),
    defaultValues: {
      name: '',
      cityName: '',
      type: 'STOP',
      address: '',
      lat: 0,
      lng: 0,
      facilities: [],
      phone: '',
      email: '',
      platformCount: '',
    },
  });

  const selectedFacilities = watch('facilities');

  useEffect(() => {
    if (station) {
      reset({
        name: station.name,
        cityName: station.cityName,
        type: station.type,
        address: station.address,
        lat: station.lat,
        lng: station.lng,
        facilities: station.facilities,
        phone: station.phone ?? '',
        email: station.email ?? '',
        platformCount: station.platformCount ?? '',
      });
    } else {
      reset({
        name: '',
        cityName: '',
        type: 'STOP',
        address: '',
        lat: 0,
        lng: 0,
        facilities: [],
        phone: '',
        email: '',
        platformCount: '',
      });
    }
  }, [station, reset]);

  const handleFacilityToggle = (facility: StationFacility, checked: boolean) => {
    const current = selectedFacilities ?? [];
    setValue(
      'facilities',
      checked ? [...current, facility] : current.filter((f: string) => f !== facility),
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('stations.form.editTitle') : t('stations.form.createTitle')}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? t('stations.form.editTitle') : t('stations.form.createTitle')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="station-name">{t('stations.form.name')}</Label>
              <Input
                id="station-name"
                placeholder={t('stations.form.namePlaceholder')}
                {...register('name')}
                aria-invalid={!!errors.name}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="station-city">{t('stations.form.cityName')}</Label>
              <Input
                id="station-city"
                placeholder={t('stations.form.cityNamePlaceholder')}
                {...register('cityName')}
                aria-invalid={!!errors.cityName}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="station-type">{t('stations.form.type')}</Label>
              <select
                id="station-type"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register('type')}
              >
                {STATION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`stations.types.${type}`)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="station-platforms">{t('stations.form.platformCount')}</Label>
              <Input
                id="station-platforms"
                type="number"
                placeholder={t('stations.form.platformCountPlaceholder')}
                {...register('platformCount')}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="station-address">{t('stations.form.address')}</Label>
            <Input
              id="station-address"
              placeholder={t('stations.form.addressPlaceholder')}
              {...register('address')}
              aria-invalid={!!errors.address}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="station-lat">{t('stations.form.lat')}</Label>
              <Input
                id="station-lat"
                type="number"
                step="any"
                {...register('lat')}
                aria-invalid={!!errors.lat}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="station-lng">{t('stations.form.lng')}</Label>
              <Input
                id="station-lng"
                type="number"
                step="any"
                {...register('lng')}
                aria-invalid={!!errors.lng}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="station-phone">{t('stations.form.phone')}</Label>
              <Input
                id="station-phone"
                placeholder={t('stations.form.phonePlaceholder')}
                {...register('phone')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="station-email">{t('stations.form.email')}</Label>
              <Input
                id="station-email"
                type="email"
                placeholder={t('stations.form.emailPlaceholder')}
                {...register('email')}
              />
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t('stations.form.facilities')}</legend>
            <div className="grid grid-cols-2 gap-2">
              {FACILITIES.map((facility) => (
                <label key={facility} className="flex items-center space-x-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-input"
                    checked={(selectedFacilities ?? []).includes(facility)}
                    onChange={(e) => handleFacilityToggle(facility, e.target.checked)}
                  />
                  <span>{t(`stations.facilities.${facility}`)}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              {t('stations.form.cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? isEdit
                  ? t('stations.form.updating')
                  : t('stations.form.creating')
                : t('stations.form.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
