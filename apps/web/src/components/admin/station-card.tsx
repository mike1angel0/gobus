import { MapPin, Phone, Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FacilityIcon } from '@/components/shared/facility-icons';
import type { components } from '@/api/generated/types';

type Station = components['schemas']['Station'];
type StationType = components['schemas']['StationType'];

/** Maps station type to badge variant. */
function getTypeBadgeVariant(type: StationType): 'default' | 'secondary' | 'outline' {
  switch (type) {
    case 'HUB':
      return 'default';
    case 'STATION':
      return 'secondary';
    case 'STOP':
      return 'outline';
  }
}

/** Props for the station card component. */
interface StationCardProps {
  /** The station to display. */
  station: Station;
  /** Callback when the edit button is clicked. */
  onEdit: (station: Station) => void;
  /** Callback when the deactivate button is clicked. */
  onDeactivate: (station: Station) => void;
}

/** Card component displaying a station's details. */
export function StationCard({ station, onEdit, onDeactivate }: StationCardProps) {
  const { t } = useTranslation('admin');

  return (
    <Card className={!station.isActive ? 'opacity-60' : ''}>
      <CardContent className="flex items-start justify-between gap-4 p-4">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-medium">{station.name}</h3>
            <Badge variant={getTypeBadgeVariant(station.type)}>
              {t(`stations.types.${station.type}`)}
            </Badge>
            {!station.isActive && (
              <Badge variant="destructive">Inactive</Badge>
            )}
          </div>

          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{station.address}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {station.phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" aria-hidden />
                {station.phone}
              </span>
            )}
            {station.email && (
              <span className="flex items-center gap-1">
                <Mail className="h-3 w-3" aria-hidden />
                {station.email}
              </span>
            )}
            {station.platformCount != null && station.platformCount > 0 && (
              <span>{station.platformCount} platforms</span>
            )}
          </div>

          {station.facilities.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {station.facilities.map((facility) => (
                <span
                  key={facility}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
                  title={t(`stations.facilities.${facility}`)}
                >
                  <FacilityIcon facility={facility} />
                  {t(`stations.facilities.${facility}`)}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => onEdit(station)}>
            {t('stations.actions.edit')}
          </Button>
          {station.isActive && (
            <Button variant="destructive" size="sm" onClick={() => onDeactivate(station)}>
              {t('stations.actions.deactivate')}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
