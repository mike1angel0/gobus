import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setupAuthMock } from './helpers/auth-mock';
import { setupApiMocks } from './helpers/api-mocker';
import { compareScreenshots } from './helpers/screenshot-compare';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BROWSER_DIR = path.resolve(__dirname, 'screenshots/browser');

/** Max allowed diff percentage before a test fails. */
const DIFF_THRESHOLD = 15;

type AuthRole = 'PASSENGER' | 'PROVIDER' | 'DRIVER' | 'ADMIN';

interface ScreenConfig {
  name: string;
  route: string;
  width: number;
  height: number;
  auth?: AuthRole;
}

const SCREENS: ScreenConfig[] = [
  // Public pages (1280px wide in designs)
  { name: 'home', route: '/', width: 1280, height: 900 },
  { name: 'search', route: '/search?from=Bucure%C8%99ti&to=Cluj-Napoca&date=2025-07-15', width: 1280, height: 900 },
  { name: 'trip-detail', route: '/trip/sched_001?date=2025-07-15', width: 1280, height: 900 },

  // Auth pages
  { name: 'login', route: '/auth/login', width: 1440, height: 900 },
  { name: 'register', route: '/auth/register', width: 1440, height: 900 },
  { name: 'forgot-password', route: '/auth/forgot-password', width: 1440, height: 900 },
  { name: 'reset-password', route: '/auth/reset-password?token=fake_reset_token', width: 1440, height: 900 },

  // Authenticated pages
  { name: 'change-password', route: '/auth/change-password', width: 1440, height: 900, auth: 'PASSENGER' },
  { name: 'my-trips', route: '/my-trips', width: 1440, height: 900, auth: 'PASSENGER' },
  { name: 'profile', route: '/profile', width: 1440, height: 900, auth: 'PASSENGER' },

  // Provider pages
  { name: 'provider-dashboard', route: '/provider', width: 1440, height: 900, auth: 'PROVIDER' },
  { name: 'provider-routes', route: '/provider/routes', width: 1440, height: 900, auth: 'PROVIDER' },
  { name: 'provider-fleet', route: '/provider/fleet', width: 1440, height: 900, auth: 'PROVIDER' },
  { name: 'provider-schedules', route: '/provider/schedules', width: 1440, height: 900, auth: 'PROVIDER' },
  { name: 'provider-drivers', route: '/provider/drivers', width: 1440, height: 900, auth: 'PROVIDER' },

  // Admin pages
  { name: 'admin-dashboard', route: '/admin', width: 1440, height: 900, auth: 'ADMIN' },
  { name: 'admin-users', route: '/admin/users', width: 1440, height: 900, auth: 'ADMIN' },
  { name: 'admin-audit-logs', route: '/admin/audit-logs', width: 1440, height: 900, auth: 'ADMIN' },

  // Driver pages
  { name: 'driver-trips', route: '/driver', width: 1440, height: 900, auth: 'DRIVER' },
  { name: 'driver-trip-detail', route: '/driver/trip/sched_001?date=2025-07-15', width: 1440, height: 900, auth: 'DRIVER' },
  { name: 'driver-delay', route: '/driver/delay?scheduleId=sched_001&date=2025-07-15', width: 1440, height: 900, auth: 'DRIVER' },
];

for (const screen of SCREENS) {
  test(`visual: ${screen.name}`, async ({ page }) => {
    // Set viewport to match design width
    await page.setViewportSize({ width: screen.width, height: screen.height });

    // Freeze Date.now for deterministic rendering
    await page.addInitScript(() => {
      const frozen = new Date('2025-07-15T07:00:00.000Z').getTime();
      const OrigDate = Date;
      // @ts-expect-error override Date.now
      Date.now = () => frozen;
      const origDateConstructor = Date;
      // @ts-expect-error override Date constructor
      globalThis.Date = class extends origDateConstructor {
        constructor(...args: unknown[]) {
          if (args.length === 0) {
            super(frozen);
          } else {
            // @ts-expect-error spread args
            super(...args);
          }
        }

        static now() {
          return frozen;
        }

        static parse = OrigDate.parse;
        static UTC = OrigDate.UTC;
      };
    });

    // Setup auth if needed
    if (screen.auth) {
      await setupAuthMock(page, screen.auth);
    }

    // Setup API mocks
    await setupApiMocks(page, screen.name);

    // Navigate
    await page.goto(screen.route, { waitUntil: 'networkidle' });

    // Wait for rendering to settle
    await page.waitForTimeout(500);

    // Take browser screenshot
    await page.screenshot({
      path: path.join(BROWSER_DIR, `${screen.name}.png`),
      fullPage: false,
    });

    // Compare with design
    const result = compareScreenshots(screen.name);

    console.log(
      `[${screen.name}] diff: ${result.diffPercent.toFixed(2)}% ` +
        `(${result.diffPixels}/${result.totalPixels} pixels)`,
    );

    expect(
      result.diffPercent,
      `${screen.name}: diff ${result.diffPercent.toFixed(2)}% exceeds ${DIFF_THRESHOLD}% threshold. See: ${result.diffPath}`,
    ).toBeLessThan(DIFF_THRESHOLD);
  });
}
