import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { LiveMap, type MapStop, type BusPosition } from './live-map';

// Mock react-leaflet — MapContainer renders children in a div, leaf components render stubs
const mockFitBounds = vi.fn();
const mockSetView = vi.fn();

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children, ...props }: Record<string, unknown>) => (
    <div data-testid="map-container" data-center={JSON.stringify(props.center)} data-zoom={props.zoom}>
      {children as React.ReactNode}
    </div>
  ),
  TileLayer: ({ url }: { url: string }) => <div data-testid="tile-layer" data-url={url} />,
  Polyline: ({ positions, color }: { positions: unknown[]; color: string }) => (
    <div data-testid="polyline" data-positions={JSON.stringify(positions)} data-color={color} />
  ),
  Marker: ({ position, children }: { position: number[]; children?: React.ReactNode }) => (
    <div data-testid="marker" data-position={JSON.stringify(position)}>
      {children}
    </div>
  ),
  Popup: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="popup">{children}</div>
  ),
  useMap: () => ({
    fitBounds: mockFitBounds,
    setView: mockSetView,
  }),
}));

// Mock leaflet
vi.mock('leaflet', () => ({
  default: {
    divIcon: vi.fn(() => ({})),
    latLngBounds: vi.fn(() => ({})),
  },
  divIcon: vi.fn(() => ({})),
  latLngBounds: vi.fn(() => ({})),
}));

const VIENNA: MapStop = { name: 'Vienna', lat: 48.2, lng: 16.37 };
const BUDAPEST: MapStop = { name: 'Budapest', lat: 47.5, lng: 19.04 };
const BRATISLAVA: MapStop = { name: 'Bratislava', lat: 48.15, lng: 17.11 };

const BUS: BusPosition = { lat: 47.8, lng: 17.5, heading: 135 };

describe('LiveMap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without error with no stops', () => {
    render(<LiveMap stops={[]} />);
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
  });

  it('has accessible region role and label', () => {
    render(<LiveMap stops={[]} />);
    const region = screen.getByRole('region', { name: 'Live route map' });
    expect(region).toBeInTheDocument();
  });

  it('uses dark CartoDB tiles', () => {
    render(<LiveMap stops={[VIENNA]} />);
    const tile = screen.getByTestId('tile-layer');
    expect(tile.dataset.url).toContain('basemaps.cartocdn.com/dark_all');
  });

  it('renders stop markers with popup labels', () => {
    render(<LiveMap stops={[VIENNA, BUDAPEST]} />);
    const markers = screen.getAllByTestId('marker');
    // 2 stop markers (no bus)
    expect(markers).toHaveLength(2);
    const popups = screen.getAllByTestId('popup');
    expect(popups[0]).toHaveTextContent('Vienna');
    expect(popups[1]).toHaveTextContent('Budapest');
  });

  it('renders route polyline from stop coordinates', () => {
    render(<LiveMap stops={[VIENNA, BUDAPEST]} />);
    const polyline = screen.getByTestId('polyline');
    const positions = JSON.parse(polyline.dataset.positions ?? '[]') as number[][];
    expect(positions).toEqual([
      [VIENNA.lat, VIENNA.lng],
      [BUDAPEST.lat, BUDAPEST.lng],
    ]);
  });

  it('does not render polyline with fewer than 2 stops', () => {
    render(<LiveMap stops={[VIENNA]} />);
    expect(screen.queryByTestId('polyline')).not.toBeInTheDocument();
  });

  it('renders bus marker when busPosition is provided', () => {
    render(<LiveMap stops={[VIENNA, BUDAPEST]} busPosition={BUS} />);
    const markers = screen.getAllByTestId('marker');
    // 2 stops + 1 bus = 3 markers
    expect(markers).toHaveLength(3);
  });

  it('does not render bus marker when busPosition is undefined', () => {
    render(<LiveMap stops={[VIENNA, BUDAPEST]} />);
    const markers = screen.getAllByTestId('marker');
    // Only 2 stop markers
    expect(markers).toHaveLength(2);
  });

  it('auto-fits bounds when multiple stops exist', () => {
    render(<LiveMap stops={[VIENNA, BUDAPEST]} />);
    expect(mockFitBounds).toHaveBeenCalledTimes(1);
    expect(mockSetView).not.toHaveBeenCalled();
  });

  it('calls setView for a single stop', () => {
    render(<LiveMap stops={[VIENNA]} />);
    expect(mockSetView).toHaveBeenCalledWith([VIENNA.lat, VIENNA.lng], 13);
    expect(mockFitBounds).not.toHaveBeenCalled();
  });

  it('uses custom center and zoom', () => {
    const center = { lat: 50, lng: 20 };
    render(<LiveMap stops={[]} center={center} zoom={10} />);
    const container = screen.getByTestId('map-container');
    expect(container.dataset.center).toBe(JSON.stringify([50, 20]));
    expect(container.dataset.zoom).toBe('10');
  });

  it('uses default center when no props provided', () => {
    render(<LiveMap stops={[]} />);
    const container = screen.getByTestId('map-container');
    expect(container.dataset.center).toBe(JSON.stringify([48.5, 16.0]));
    expect(container.dataset.zoom).toBe('6');
  });

  it('applies custom className', () => {
    render(<LiveMap stops={[]} className="my-map" />);
    const region = screen.getByRole('region', { name: 'Live route map' });
    expect(region).toHaveClass('my-map');
  });

  it('renders three stop markers for three stops', () => {
    render(<LiveMap stops={[VIENNA, BRATISLAVA, BUDAPEST]} />);
    const markers = screen.getAllByTestId('marker');
    expect(markers).toHaveLength(3);
    const popups = screen.getAllByTestId('popup');
    expect(popups).toHaveLength(3);
    expect(popups[0]).toHaveTextContent('Vienna');
    expect(popups[1]).toHaveTextContent('Bratislava');
    expect(popups[2]).toHaveTextContent('Budapest');
  });

  it('polyline color is blue', () => {
    render(<LiveMap stops={[VIENNA, BUDAPEST]} />);
    const polyline = screen.getByTestId('polyline');
    expect(polyline.dataset.color).toBe('#3b82f6');
  });

  it('bus marker position matches busPosition prop', () => {
    render(<LiveMap stops={[VIENNA]} busPosition={BUS} />);
    const markers = screen.getAllByTestId('marker');
    // Bus marker is the last one (after stop markers)
    const busMarker = markers[markers.length - 1];
    expect(busMarker.dataset.position).toBe(JSON.stringify([BUS.lat, BUS.lng]));
  });

  it('includes bus position in bounds fitting', () => {
    render(<LiveMap stops={[VIENNA]} busPosition={BUS} />);
    // With 1 stop + 1 bus = 2 points, should use fitBounds
    expect(mockFitBounds).toHaveBeenCalledTimes(1);
    expect(mockSetView).not.toHaveBeenCalled();
  });
});
