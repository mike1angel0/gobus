import type { components } from '@/api/generated/types';

type Role = components['schemas']['Role'];

/** A navigation link with role-based visibility. */
export interface NavLink {
  /** Translation key within the `nav` namespace (e.g. `links.home`). */
  labelKey: string;
  /** Route path. */
  href: string;
  /** Roles that can see this link. If empty, visible to all authenticated users. */
  roles: Role[];
}

/** Navigation links shown to authenticated users, filtered by role. */
export const AUTH_NAV_LINKS: NavLink[] = [
  { labelKey: 'links.home', href: '/', roles: ['PASSENGER'] },
  { labelKey: 'links.search', href: '/search', roles: ['PASSENGER'] },
  { labelKey: 'links.myTrips', href: '/my-trips', roles: ['PASSENGER'] },
  { labelKey: 'links.dashboard', href: '/provider', roles: ['PROVIDER'] },
  { labelKey: 'links.routes', href: '/provider/routes', roles: ['PROVIDER'] },
  { labelKey: 'links.fleet', href: '/provider/fleet', roles: ['PROVIDER'] },
  { labelKey: 'links.schedules', href: '/provider/schedules', roles: ['PROVIDER'] },
  { labelKey: 'links.drivers', href: '/provider/drivers', roles: ['PROVIDER'] },
  { labelKey: 'links.tracking', href: '/provider/tracking', roles: ['PROVIDER'] },
  { labelKey: 'links.profile', href: '/provider/profile', roles: ['PROVIDER'] },
  { labelKey: 'links.trips', href: '/driver', roles: ['DRIVER'] },
  { labelKey: 'links.history', href: '/driver/trip', roles: ['DRIVER'] },
  { labelKey: 'links.dashboard', href: '/admin', roles: ['ADMIN'] },
  { labelKey: 'links.users', href: '/admin/users', roles: ['ADMIN'] },
  { labelKey: 'links.fleet', href: '/admin/fleet', roles: ['ADMIN'] },
  { labelKey: 'links.auditLogs', href: '/admin/audit-logs', roles: ['ADMIN'] },
  { labelKey: 'links.profile', href: '/profile', roles: [] },
];

/** Public links shown to unauthenticated users. */
export const PUBLIC_NAV_LINKS: NavLink[] = [
  { labelKey: 'links.home', href: '/', roles: [] },
  { labelKey: 'links.search', href: '/search', roles: [] },
];

/**
 * Filters navigation links by user role.
 *
 * @param role - The authenticated user's role.
 * @returns Navigation links visible to the given role.
 */
export function getLinksForRole(role: Role): NavLink[] {
  return AUTH_NAV_LINKS.filter((link) => link.roles.length === 0 || link.roles.includes(role));
}
