import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, MapPin, Clock, Bus, X } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { LiveMap, type MapStop } from '@/components/maps/live-map';
import { useBookingDetail, useCancelBooking } from '@/hooks/use-bookings';
import { useBusTracking } from '@/hooks/use-tracking';
import { formatPrice } from '@/lib/utils';
import type { components } from '@/api/generated/types';

type Booking = components['schemas']['Booking'];

/** Props for the {@link BookingCard} component. */
export interface BookingCardProps {
  /** The booking to display. */
  booking: Booking;
  /** Whether the booking is in the upcoming or past tab. */
  variant: 'upcoming' | 'past';
}

/** Formats an ISO date-time string to a short time (HH:MM). */
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

/** Formats an ISO date-time string to a readable date. */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}


/** Returns a CSS class for the booking status badge. */
function getStatusClasses(status: Booking['status']): string {
  switch (status) {
    case 'CONFIRMED':
      return 'bg-green-500/10 text-green-500';
    case 'COMPLETED':
      return 'bg-blue-500/10 text-blue-500';
    case 'CANCELLED':
      return 'bg-red-500/10 text-red-500';
  }
}

/**
 * Expandable section showing booking details fetched from the detail endpoint.
 * Includes schedule info, bus info, and live tracking map for active trips.
 */
function BookingDetail({ bookingId, busId }: { bookingId: string; busId?: string }) {
  const { t } = useTranslation('booking');
  const { data: detailData, isLoading } = useBookingDetail(bookingId);
  const { data: trackingData } = useBusTracking(busId ?? '', !!busId);

  if (isLoading) {
    return (
      <div className="space-y-2 pt-4" aria-busy="true" aria-label={t('card.loadingAriaLabel')}>
        <div className="h-4 w-48 animate-pulse rounded bg-muted" />
        <div className="h-4 w-36 animate-pulse rounded bg-muted" />
        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  const detail = detailData?.data;
  if (!detail) return null;

  const schedule = detail.schedule;
  const busPosition = trackingData?.data?.isActive
    ? { lat: trackingData.data.lat, lng: trackingData.data.lng, heading: trackingData.data.heading }
    : undefined;

  // We don't have stop coordinates from the booking detail API (spec gap).
  // Show the map only when we have an active bus position.
  const mapStops: MapStop[] = [];

  return (
    <div className="space-y-3 border-t pt-4">
      <div className="grid gap-2 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Bus className="h-4 w-4" aria-hidden="true" />
          <span>
            {schedule.route.provider.name} &middot; {schedule.bus.model} (
            {schedule.bus.licensePlate})
          </span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="h-4 w-4" aria-hidden="true" />
          <span>
            {formatTime(schedule.departureTime)} &ndash; {formatTime(schedule.arrivalTime)}
          </span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <MapPin className="h-4 w-4" aria-hidden="true" />
          <span>{schedule.route.name}</span>
        </div>
      </div>

      {busPosition && (
        <div className="h-48 overflow-hidden rounded-md" aria-label="Live tracking map">
          <LiveMap stops={mapStops} busPosition={busPosition} zoom={10} />
        </div>
      )}
    </div>
  );
}

/** Props for the cancel confirmation dialog. */
interface CancelDialogProps {
  /** The booking ID to cancel. */
  bookingId: string;
  /** The order ID shown in the confirmation message. */
  orderId: string;
}

/**
 * Dialog that confirms booking cancellation before calling the API.
 */
function CancelDialog({ bookingId, orderId }: CancelDialogProps) {
  const { t } = useTranslation('booking');
  const cancelBooking = useCancelBooking();
  const [open, setOpen] = useState(false);

  const handleCancel = () => {
    cancelBooking.mutate(bookingId, {
      onSettled: () => setOpen(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm" aria-label={t('cancel.buttonAriaLabel')}>
          <X className="mr-1 h-3 w-3" aria-hidden="true" />
          {t('cancel.button')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('cancel.title')}</DialogTitle>
          <DialogDescription>{t('cancel.description', { orderId })}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t('cancel.keep')}</Button>
          </DialogClose>
          <Button variant="destructive" onClick={handleCancel} disabled={cancelBooking.isPending}>
            {cancelBooking.isPending ? t('cancel.cancelling') : t('cancel.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * A card displaying a single booking with status, route, date, seats, and price.
 *
 * Features:
 * - Color-coded status badge (CONFIRMED/COMPLETED/CANCELLED)
 * - Expandable detail section with schedule info and live tracking map
 * - Cancel button with confirmation dialog for upcoming (CONFIRMED) bookings
 * - Delay badge when delay info is available (from detail endpoint)
 *
 * @example
 * ```tsx
 * <BookingCard booking={booking} variant="upcoming" />
 * ```
 */
export function BookingCard({ booking, variant }: BookingCardProps) {
  const { t } = useTranslation('booking');
  const [expanded, setExpanded] = useState(false);
  const { data: detailData } = useBookingDetail(expanded ? booking.id : '');

  const busId = expanded ? detailData?.data?.schedule.bus.id : undefined;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-semibold">
                {booking.boardingStop} &rarr; {booking.alightingStop}
              </h3>
              <span
                className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${getStatusClasses(booking.status)}`}
              >
                {t(`status.${booking.status}`)}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{formatDate(booking.tripDate)}</p>
          </div>
          <p className="shrink-0 text-lg font-bold">{formatPrice(booking.totalPrice)}</p>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span>
            {t('card.seats')} {booking.seatLabels.join(', ')}
          </span>
          <span>
            {t('card.order')} {booking.orderId}
          </span>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              aria-expanded={expanded}
              aria-label={expanded ? t('card.collapseDetails') : t('card.expandDetails')}
            >
              {expanded ? (
                <ChevronUp className="mr-1 h-4 w-4" aria-hidden="true" />
              ) : (
                <ChevronDown className="mr-1 h-4 w-4" aria-hidden="true" />
              )}
              {t('card.details')}
            </Button>
          </div>

          {variant === 'upcoming' && booking.status === 'CONFIRMED' && (
            <CancelDialog bookingId={booking.id} orderId={booking.orderId} />
          )}
        </div>

        {expanded && <BookingDetail bookingId={booking.id} busId={busId} />}
      </CardContent>
    </Card>
  );
}
