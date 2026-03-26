import type { components } from '@/api/generated/types';

type Role = components['schemas']['Role'];

/** A navigation link with role-based visibility. */
export interface NavLink {
  /** Display label for the link. */
  label: string;
  /** Route path. */
  href: string;
  /** Roles that can see this link. If empty, visible to all authenticated users. */
  roles: Role[];
}

/** Navigation links shown to authenticated users, filtered by role. */
export const AUTH_NAV_LINKS: NavLink[] = [
  { label: 'Home', href: '/', roles: ['PASSENGER'] },
  { label: 'Search', href: '/search', roles: ['PASSENGER'] },
  { label: 'My Trips', href: '/my-trips', roles: ['PASSENGER'] },
  { label: 'Dashboard', href: '/provider', roles: ['PROVIDER'] },
  { label: 'Routes', href: '/provider/routes', roles: ['PROVIDER'] },
  { label: 'Fleet', href: '/provider/fleet', roles: ['PROVIDER'] },
  { label: 'Schedules', href: '/provider/schedules', roles: ['PROVIDER'] },
  { label: 'Drivers', href: '/provider/drivers', roles: ['PROVIDER'] },
  { label: 'Tracking', href: '/provider/tracking', roles: ['PROVIDER'] },
  { label: 'Trips', href: '/driver', roles: ['DRIVER'] },
  { label: 'History', href: '/driver/trip', roles: ['DRIVER'] },
  { label: 'Fleet', href: '/admin/fleet', roles: ['ADMIN'] },
];

/** Public links shown to unauthenticated users. */
export const PUBLIC_NAV_LINKS: NavLink[] = [
  { label: 'Home', href: '/', roles: [] },
  { label: 'Search', href: '/search', roles: [] },
];

/**
 * Filters navigation links by user role.
 *
 * @param role - The authenticated user's role.
 * @returns Navigation links visible to the given role.
 */
export function getLinksForRole(role: Role): NavLink[] {
  return AUTH_NAV_LINKS.filter((link) => link.roles.includes(role));
}
