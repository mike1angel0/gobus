import { Wifi, ParkingSquare, Armchair, Bath, Ticket, Luggage } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { components } from '@/api/generated/types';

type StationFacility = components['schemas']['StationFacility'];

/** Props for {@link FacilityIcon}. */
interface FacilityIconProps {
  /** The facility to render an icon for. */
  facility: StationFacility;
  /** Icon size class (defaults to "h-3.5 w-3.5"). */
  className?: string;
}

/** Renders the appropriate lucide icon for a station facility. */
export function FacilityIcon({ facility, className = 'h-3.5 w-3.5' }: FacilityIconProps) {
  const iconProps = { className, 'aria-hidden': true as const };
  switch (facility) {
    case 'WIFI':
      return <Wifi {...iconProps} />;
    case 'PARKING':
      return <ParkingSquare {...iconProps} />;
    case 'WAITING_ROOM':
      return <Armchair {...iconProps} />;
    case 'RESTROOM':
      return <Bath {...iconProps} />;
    case 'TICKET_OFFICE':
      return <Ticket {...iconProps} />;
    case 'LUGGAGE_STORAGE':
      return <Luggage {...iconProps} />;
  }
}

/** Props for {@link FacilityIconList}. */
interface FacilityIconListProps {
  /** Array of facility identifiers to display. */
  facilities: StationFacility[];
  /** Icon size class (defaults to "h-3 w-3"). */
  iconClassName?: string;
}

/** Compact row of facility icons with title tooltips. */
export function FacilityIconList({ facilities, iconClassName = 'h-3 w-3' }: FacilityIconListProps) {
  const { t } = useTranslation('admin');

  if (facilities.length === 0) return null;

  return (
    <div className="flex items-center gap-1 text-muted-foreground">
      {facilities.map((facility) => (
        <span key={facility} title={t(`stations.facilities.${facility}`)}>
          <FacilityIcon facility={facility} className={iconClassName} />
        </span>
      ))}
    </div>
  );
}
