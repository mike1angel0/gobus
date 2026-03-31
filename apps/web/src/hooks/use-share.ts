import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { toast } from '@/hooks/use-toast';

/** Data needed to share a trip. */
export interface ShareTripData {
  /** Display name of the route (e.g. "Cluj-Napoca → Bucharest"). */
  routeName: string;
  /** Schedule ID used in the trip URL. */
  scheduleId: string;
  /** Trip date in YYYY-MM-DD format. */
  tripDate: string;
  /** Departure time display string (e.g. "14:30"). */
  departureTime?: string;
  /** Arrival time display string (e.g. "18:45"). */
  arrivalTime?: string;
  /** Transport provider name. */
  providerName?: string;
}

/**
 * Builds the shareable text for a trip.
 * @param data - Trip sharing data
 * @param url - Full URL to the trip detail page
 * @returns Formatted share text
 */
function buildShareText(data: ShareTripData, url: string): string {
  const lines: string[] = [data.routeName, data.tripDate];

  if (data.departureTime && data.arrivalTime) {
    lines.push(`${data.departureTime} - ${data.arrivalTime}`);
  }

  if (data.providerName) {
    lines.push(data.providerName);
  }

  lines.push('', url);
  return lines.join('\n');
}

/**
 * Hook that returns a `share` function for sharing trip details.
 *
 * Uses the Web Share API on supported devices (mobile) and falls back to
 * copying to clipboard on desktop, with a toast confirmation.
 *
 * @returns Object with a `share` function that accepts {@link ShareTripData}.
 */
export function useShareTrip() {
  const { t } = useTranslation('common');

  const share = useCallback(
    async (data: ShareTripData) => {
      const url = `${window.location.origin}/trip/${data.scheduleId}?date=${data.tripDate}`;
      const text = buildShareText(data, url);

      if (navigator.share) {
        try {
          await navigator.share({ text });
        } catch (err) {
          if (err instanceof DOMException && err.code === DOMException.ABORT_ERR) return;
          throw err;
        }
      } else {
        await navigator.clipboard.writeText(text);
        toast({
          title: t('share.copied'),
          description: t('share.copiedDescription'),
        });
      }
    },
    [t],
  );

  return { share };
}
