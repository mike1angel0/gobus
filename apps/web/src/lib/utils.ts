import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges class names using clsx and tailwind-merge for conflict resolution.
 * @param inputs - Class values to merge
 * @returns Merged class name string
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Formats a numeric price as Romanian Lei (RON).
 * @param price - Numeric price value
 * @returns Formatted price string (e.g., "95,00 lei")
 */
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('ro-RO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price) + ' lei';
}
