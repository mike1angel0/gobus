import { memo, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/** Coordinate pair used by the map. */
interface LatLng {
  lat: number;
  lng: number;
}

/** A stop to display on the map. */
export interface MapStop {
  /** Stop name shown in the popup. */
  name: string;
  /** Latitude. */
  lat: number;
  /** Longitude. */
  lng: number;
}

/** Bus position data for the live marker. */
export interface BusPosition {
  /** Latitude. */
  lat: number;
  /** Longitude. */
  lng: number;
  /** Compass heading in degrees (0 = North). */
  heading: number;
}

/** Props for the {@link LiveMap} component. */
export interface LiveMapProps {
  /** Ordered list of stops along the route. */
  stops: MapStop[];
  /** Current bus position. If undefined, bus marker is not shown. */
  busPosition?: BusPosition;
  /** Fallback center when no stops or bus position available. Defaults to Europe center. */
  center?: LatLng;
  /** Fallback zoom level. Defaults to 6. */
  zoom?: number;
  /** Additional CSS class name for the container. */
  className?: string;
}

const DARK_TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const DARK_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>';

const ROUTE_COLOR = '#3b82f6';

const DEFAULT_CENTER: LatLng = { lat: 48.5, lng: 16.0 };
const DEFAULT_ZOOM = 6;

/** Creates a colored circle icon for stop markers. */
function createStopIcon(): L.DivIcon {
  return L.divIcon({
    className: 'live-map-stop-icon',
    html: '<div style="width:12px;height:12px;border-radius:50%;background:#3b82f6;border:2px solid #fff;"></div>',
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
}

/** Creates a rotated bus icon pointing in the heading direction. */
function createBusIcon(heading: number): L.DivIcon {
  return L.divIcon({
    className: 'live-map-bus-icon',
    html: `<div style="width:24px;height:24px;transform:rotate(${heading}deg);display:flex;align-items:center;justify-content:center;" aria-label="Bus position">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L6 20h12L12 2z" fill="#ef4444" stroke="#fff" stroke-width="1.5"/>
      </svg>
    </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

/**
 * Inner component that auto-fits map bounds when stops change.
 * Uses useMap() hook which must be inside MapContainer.
 */
function AutoFitBounds({ stops, busPosition }: { stops: MapStop[]; busPosition?: BusPosition }) {
  const map = useMap();

  useEffect(() => {
    const points: L.LatLngExpression[] = stops.map((s) => [s.lat, s.lng]);
    if (busPosition) {
      points.push([busPosition.lat, busPosition.lng]);
    }
    if (points.length >= 2) {
      const bounds = L.latLngBounds(points as L.LatLngTuple[]);
      map.fitBounds(bounds, { padding: [40, 40] });
    } else if (points.length === 1) {
      map.setView(points[0], 13);
    }
  }, [map, stops, busPosition]);

  return null;
}

/**
 * Inner component that updates bus marker position via ref to avoid full re-render.
 */
const BusMarker = memo(function BusMarker({ position }: { position: BusPosition }) {
  const markerRef = useRef<L.Marker>(null);

  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.setLatLng([position.lat, position.lng]);
      markerRef.current.setIcon(createBusIcon(position.heading));
    }
  }, [position.lat, position.lng, position.heading]);

  return (
    <Marker
      ref={markerRef}
      position={[position.lat, position.lng]}
      icon={createBusIcon(position.heading)}
    />
  );
});

/**
 * Live map component using react-leaflet with dark CartoDB tiles.
 *
 * Displays a route polyline, stop markers with popup labels, and an optional
 * bus position marker. Auto-fits bounds to show all content. Bus position
 * updates without full re-render using refs.
 *
 * @example
 * ```tsx
 * <LiveMap
 *   stops={[{ name: 'Vienna', lat: 48.2, lng: 16.37 }, { name: 'Budapest', lat: 47.5, lng: 19.04 }]}
 *   busPosition={{ lat: 47.8, lng: 17.5, heading: 135 }}
 * />
 * ```
 */
export const LiveMap = memo(function LiveMap({
  stops,
  busPosition,
  center,
  zoom,
  className,
}: LiveMapProps) {
  const mapCenter = center ?? DEFAULT_CENTER;
  const mapZoom = zoom ?? DEFAULT_ZOOM;
  const stopIcon = useMemo(() => createStopIcon(), []);

  const routePositions: L.LatLngExpression[] = stops.map((s) => [s.lat, s.lng]);

  return (
    <div
      className={className}
      style={{ width: '100%', height: '100%', minHeight: 300 }}
      role="region"
      aria-label="Live route map"
    >
      <MapContainer
        center={[mapCenter.lat, mapCenter.lng]}
        zoom={mapZoom}
        style={{ width: '100%', height: '100%' }}
        scrollWheelZoom={false}
      >
        <TileLayer url={DARK_TILE_URL} attribution={DARK_TILE_ATTRIBUTION} />

        <AutoFitBounds stops={stops} busPosition={busPosition} />

        {routePositions.length >= 2 && (
          <Polyline positions={routePositions} color={ROUTE_COLOR} weight={3} />
        )}

        {stops.map((stop) => (
          <Marker
            key={`${stop.name}-${stop.lat}-${stop.lng}`}
            position={[stop.lat, stop.lng]}
            icon={stopIcon}
          >
            <Popup>{stop.name}</Popup>
          </Marker>
        ))}

        {busPosition && <BusMarker position={busPosition} />}
      </MapContainer>
    </div>
  );
});
