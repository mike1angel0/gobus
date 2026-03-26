import { cva, type VariantProps } from 'class-variance-authority';
import { getDelaySeverity } from '@/lib/delay';
import { cn } from '@/lib/utils';

const delayBadgeVariants = cva('inline-flex items-center rounded-full font-medium', {
  variants: {
    severity: {
      'on-time': 'bg-green-500/10 text-green-500',
      minor: 'bg-yellow-500/10 text-yellow-500',
      major: 'bg-red-500/10 text-red-500',
    },
    size: {
      sm: 'px-2 py-0.5 text-xs',
      md: 'px-2.5 py-1 text-sm',
    },
  },
  defaultVariants: {
    size: 'sm',
  },
});

/** Props for the {@link DelayBadge} component. */
export interface DelayBadgeProps extends VariantProps<typeof delayBadgeVariants> {
  /** Delay duration in minutes. 0 or negative means on time. */
  delayMinutes: number;
  /** Optional human-readable reason for the delay. */
  reason?: string;
  /** CSS class name applied to the badge element. */
  className?: string;
}

/**
 * Color-coded delay badge indicating trip delay status.
 *
 * Severity levels:
 * - **On time** (green): delay ≤ 0 minutes — displays "On Time"
 * - **Minor** (yellow): delay 1–15 minutes — displays "+Xmin"
 * - **Major** (red): delay > 15 minutes — displays "+Xmin"
 *
 * Shows the optional reason in the accessible label when provided.
 *
 * @example
 * ```tsx
 * <DelayBadge delayMinutes={0} />
 * <DelayBadge delayMinutes={10} reason="Traffic" size="md" />
 * <DelayBadge delayMinutes={25} reason="Mechanical" />
 * ```
 */
export function DelayBadge({ delayMinutes, reason, size, className }: DelayBadgeProps) {
  const severity = getDelaySeverity(delayMinutes);
  const label =
    severity === 'on-time'
      ? 'On Time'
      : `Delayed ${delayMinutes}min${reason ? ` — ${reason}` : ''}`;

  return (
    <span className={cn(delayBadgeVariants({ severity, size }), className)} aria-label={label}>
      {severity === 'on-time' ? 'On Time' : `+${delayMinutes}min`}
    </span>
  );
}
