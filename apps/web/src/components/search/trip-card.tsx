import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bus, ChevronDown, Clock, MapPin, Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { components } from '@/api/generated/types';

type SearchResult = components['schemas']['SearchResult'];

/** Delay information to display on a TripCard. */
export interface TripDelay {
  /** Delay duration in minutes. 0 means on time. */
  delayMinutes: number;
  /** Optional human-readable reason for the delay. */
  reason?: string;
}

/** Stop time entry for the expandable stops section. */
export interface TripStop {
  /** Name of the stop. */
  stopName: string;
  /** Arrival time at this stop (ISO 8601). */
  arrivalTime: string;
  /** Departure time from this stop (ISO 8601). */
  departureTime: string;
}

/** Props for the {@link TripCard} component. */
export interface TripCardProps {
  /** Trip search result data from the API. */
  trip: SearchResult;
  /** Optional delay information. When provided, a delay badge is shown. */
  delay?: TripDelay;
  /** Optional stop list for the expandable section. */
  stops?: TripStop[];
  /** CSS class name applied to the card wrapper. */
  className?: string;
}

/**
 * Formats an ISO date-time string to a human-readable time (e.g., "14:30").
 * @param isoString - ISO 8601 date-time string
 * @returns Formatted time string in HH:MM format
 */
function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Computes trip duration in hours and minutes from departure and arrival times.
 * @param departure - ISO 8601 departure date-time
 * @param arrival - ISO 8601 arrival date-time
 * @returns Human-readable duration string (e.g., "2h 30m")
 */
function formatDuration(departure: string, arrival: string): string {
  const ms = new Date(arrival).getTime() - new Date(departure).getTime();
  const totalMinutes = Math.round(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

/**
 * Returns the seat availability level based on the ratio of available to total seats.
 * @param available - Number of available seats
 * @param total - Total number of seats
 * @returns Availability level: 'high', 'medium', or 'low'
 */
function getSeatLevel(available: number, total: number): 'high' | 'medium' | 'low' {
  if (total === 0) return 'low';
  const ratio = available / total;
  if (ratio > 0.5) return 'high';
  if (ratio > 0.2) return 'medium';
  return 'low';
}

/**
 * Returns the delay severity based on delay minutes.
 * @param minutes - Delay duration in minutes
 * @returns Severity: 'on-time', 'minor', or 'major'
 */
function getDelaySeverity(minutes: number): 'on-time' | 'minor' | 'major' {
  if (minutes <= 0) return 'on-time';
  if (minutes <= 15) return 'minor';
  return 'major';
}

const DELAY_STYLES = {
  'on-time': 'bg-green-500/10 text-green-500',
  minor: 'bg-yellow-500/10 text-yellow-500',
  major: 'bg-red-500/10 text-red-500',
} as const;

const SEAT_STYLES = {
  high: 'text-green-500',
  medium: 'text-yellow-500',
  low: 'text-red-500',
} as const;

/**
 * Card component displaying a trip search result with provider info, times,
 * route, duration, price, seat availability, and optional delay badge.
 *
 * Features:
 * - Provider name and route info
 * - Departure and arrival times with computed duration
 * - Price display and available seat count with color-coded indicator
 * - Optional delay badge (on-time/minor/major severity)
 * - Expandable stops section showing stop names and times
 * - Click navigates to trip detail page
 * - Responsive layout with accessible markup
 *
 * @example
 * ```tsx
 * <TripCard trip={searchResult} />
 * <TripCard trip={searchResult} delay={{ delayMinutes: 10, reason: 'Traffic' }} stops={stopList} />
 * ```
 */
export function TripCard({ trip, delay, stops, className }: TripCardProps) {
  const [expanded, setExpanded] = useState(false);
  const seatLevel = getSeatLevel(trip.availableSeats, trip.totalSeats);
  const tripUrl = `/trip/${encodeURIComponent(trip.scheduleId)}?date=${encodeURIComponent(trip.tripDate)}`;

  return (
    <Card className={cn('overflow-hidden transition-colors hover:border-primary/50', className)}>
      <Link
        to={tripUrl}
        className="block p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={`${trip.routeName}: ${trip.origin} to ${trip.destination}, departing ${formatTime(trip.departureTime)}, ${trip.price.toFixed(2)} EUR, ${trip.availableSeats} seats available`}
      >
        {/* Top row: provider + delay badge + price */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Bus className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="truncate text-sm text-muted-foreground">{trip.providerName}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {delay && (
              <DelayBadge
                delayMinutes={delay.delayMinutes}
                reason={delay.reason}
              />
            )}
            <span className="text-lg font-bold">{trip.price.toFixed(2)} €</span>
          </div>
        </div>

        {/* Middle row: times + duration + route */}
        <div className="mt-3 flex items-center gap-3">
          <div className="text-center">
            <p className="text-lg font-semibold">{formatTime(trip.departureTime)}</p>
            <p className="text-xs text-muted-foreground">{trip.origin}</p>
          </div>
          <div className="flex flex-1 flex-col items-center">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" aria-hidden="true" />
              <span>{formatDuration(trip.departureTime, trip.arrivalTime)}</span>
            </div>
            <div className="mt-1 h-px w-full bg-border" role="presentation" />
            <p className="mt-1 truncate text-xs text-muted-foreground">{trip.routeName}</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold">{formatTime(trip.arrivalTime)}</p>
            <p className="text-xs text-muted-foreground">{trip.destination}</p>
          </div>
        </div>

        {/* Bottom row: seats */}
        <div className="mt-3 flex items-center gap-1">
          <Users className={cn('h-4 w-4', SEAT_STYLES[seatLevel])} aria-hidden="true" />
          <span className={cn('text-sm', SEAT_STYLES[seatLevel])}>
            {trip.availableSeats} {trip.availableSeats === 1 ? 'seat' : 'seats'} available
          </span>
        </div>
      </Link>

      {/* Expandable stops section */}
      {stops && stops.length > 0 && (
        <div className="border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            className="flex w-full items-center justify-center gap-1 rounded-none py-2 text-xs text-muted-foreground"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            aria-controls="trip-stops"
          >
            <MapPin className="h-3 w-3" aria-hidden="true" />
            {expanded ? 'Hide stops' : `${stops.length} stops`}
            <ChevronDown
              className={cn('h-3 w-3 transition-transform', expanded && 'rotate-180')}
              aria-hidden="true"
            />
          </Button>
          {expanded && (
            <ol
              id="trip-stops"
              className="px-4 pb-3"
              aria-label="Trip stops"
            >
              {stops.map((stop) => (
                <li
                  key={`${stop.stopName}-${stop.departureTime}`}
                  className="flex items-center gap-3 py-1.5 text-sm"
                >
                  <span className="w-12 shrink-0 text-right font-mono text-xs text-muted-foreground">
                    {formatTime(stop.departureTime)}
                  </span>
                  <span className="h-2 w-2 shrink-0 rounded-full bg-primary" role="presentation" />
                  <span className="truncate">{stop.stopName}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </Card>
  );
}

/**
 * Inline delay badge for the TripCard. Color-coded by severity.
 * @param props - Delay minutes and optional reason
 */
function DelayBadge({ delayMinutes, reason }: { delayMinutes: number; reason?: string }) {
  const severity = getDelaySeverity(delayMinutes);
  const label =
    severity === 'on-time'
      ? 'On Time'
      : `Delayed ${delayMinutes}min${reason ? ` — ${reason}` : ''}`;

  return (
    <span
      className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', DELAY_STYLES[severity])}
      aria-label={label}
    >
      {severity === 'on-time' ? 'On Time' : `+${delayMinutes}min`}
    </span>
  );
}
