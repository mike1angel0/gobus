import type { DelayReason } from '@/generated/prisma/client.js';

/** Delay data representing a reported delay for a scheduled trip. */
export interface DelayData {
  /** Unique delay record identifier (cuid). */
  id: string;
  /** Schedule affected by the delay. */
  scheduleId: string;
  /** Delay duration in minutes (1-1440). */
  offsetMinutes: number;
  /** Reason for the delay. */
  reason: DelayReason;
  /** Optional free-text note about the delay. */
  note: string | null;
  /** Date of the affected trip. */
  tripDate: Date;
  /** Whether the delay is currently active. */
  active: boolean;
  /** Delay creation timestamp. */
  createdAt: Date;
}
