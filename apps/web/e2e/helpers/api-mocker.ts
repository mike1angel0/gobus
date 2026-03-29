import type { Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(__dirname, '../fixtures');

function loadFixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, `${name}.json`), 'utf-8');
}

function jsonRoute(page: Page, urlPattern: string, fixtureName: string): Promise<void> {
  return page.route(urlPattern, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: loadFixture(fixtureName),
    }),
  );
}

type ScreenMocks = { url: string; fixture: string }[];

const SCREEN_MOCKS: Record<string, ScreenMocks> = {
  home: [{ url: '**/api/v1/cities', fixture: 'cities' }],
  search: [
    { url: '**/api/v1/cities', fixture: 'cities' },
    { url: '**/api/v1/search*', fixture: 'search-results' },
  ],
  'trip-detail': [
    { url: '**/api/v1/trips/*', fixture: 'trip-detail' },
    { url: '**/api/v1/cities', fixture: 'cities' },
  ],
  login: [],
  register: [],
  'forgot-password': [],
  'reset-password': [],
  'change-password': [],
  'my-trips': [{ url: '**/api/v1/bookings*', fixture: 'bookings' }],
  profile: [],
  'provider-dashboard': [
    { url: '**/api/v1/provider/analytics*', fixture: 'provider-analytics' },
    { url: '**/api/v1/schedules*', fixture: 'schedules' },
    { url: '**/api/v1/routes*', fixture: 'routes' },
    { url: '**/api/v1/buses*', fixture: 'buses' },
    { url: '**/api/v1/drivers*', fixture: 'drivers' },
  ],
  'provider-routes': [{ url: '**/api/v1/routes*', fixture: 'routes' }],
  'provider-fleet': [
    { url: '**/api/v1/buses/templates*', fixture: 'bus-templates' },
    { url: '**/api/v1/buses*', fixture: 'buses' },
  ],
  'provider-schedules': [
    { url: '**/api/v1/schedules*', fixture: 'schedules' },
    { url: '**/api/v1/routes*', fixture: 'routes' },
    { url: '**/api/v1/buses*', fixture: 'buses' },
    { url: '**/api/v1/drivers*', fixture: 'drivers' },
  ],
  'provider-drivers': [{ url: '**/api/v1/drivers*', fixture: 'drivers' }],
  'admin-dashboard': [
    { url: '**/api/v1/admin/audit-logs*', fixture: 'admin-audit-logs' },
    { url: '**/api/v1/admin/users*', fixture: 'admin-users' },
    { url: '**/api/v1/admin/buses*', fixture: 'admin-buses' },
  ],
  'admin-users': [{ url: '**/api/v1/admin/users*', fixture: 'admin-users' }],
  'admin-audit-logs': [{ url: '**/api/v1/admin/audit-logs*', fixture: 'admin-audit-logs' }],
  'driver-trips': [{ url: '**/api/v1/driver/trips*', fixture: 'driver-trips' }],
  'driver-trip-detail': [
    { url: '**/api/v1/driver/trips/*/passengers*', fixture: 'driver-passengers' },
    { url: '**/api/v1/driver/trips/*', fixture: 'driver-trip-detail' },
  ],
  'driver-delay': [
    { url: '**/api/v1/driver/trips*', fixture: 'driver-trips' },
    { url: '**/api/v1/delays*', fixture: 'delay-created' },
  ],
};

export async function setupApiMocks(page: Page, screenName: string): Promise<void> {
  const mocks = SCREEN_MOCKS[screenName] ?? [];

  // Register specific mocks (order matters — more specific patterns first)
  for (const mock of mocks) {
    await jsonRoute(page, mock.url, mock.fixture);
  }

  // Catch-all for any unmocked API endpoints
  await page.route('**/api/v1/**', (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: {} }),
    });
  });
}
