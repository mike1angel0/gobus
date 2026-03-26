/** Delay severity level. */
export type DelaySeverity = 'on-time' | 'minor' | 'major';

/**
 * Returns the delay severity based on delay minutes.
 * @param minutes - Delay duration in minutes
 * @returns Severity: 'on-time' (≤0), 'minor' (1–15), or 'major' (>15)
 */
export function getDelaySeverity(minutes: number): DelaySeverity {
  if (minutes <= 0) return 'on-time';
  if (minutes <= 15) return 'minor';
  return 'major';
}
