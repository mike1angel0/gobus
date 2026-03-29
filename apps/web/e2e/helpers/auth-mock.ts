import type { Page } from '@playwright/test';

type Role = 'PASSENGER' | 'PROVIDER' | 'DRIVER' | 'ADMIN';

const MOCK_USERS: Record<Role, object> = {
  PASSENGER: {
    id: 'user_passenger_01',
    email: 'ion.popescu@example.com',
    name: 'Ion Popescu',
    role: 'PASSENGER',
    phone: '+40712345678',
    avatarUrl: null,
    providerId: null,
    preferences: { language: 'en', notifications: true, emailNotifications: true },
    status: 'ACTIVE',
    createdAt: '2025-01-15T10:00:00.000Z',
    updatedAt: '2025-06-01T12:00:00.000Z',
  },
  PROVIDER: {
    id: 'user_provider_01',
    email: 'maria.ionescu@transbus.ro',
    name: 'Maria Ionescu',
    role: 'PROVIDER',
    phone: '+40723456789',
    avatarUrl: null,
    providerId: 'provider_01',
    preferences: { language: 'en', notifications: true, emailNotifications: true },
    status: 'ACTIVE',
    createdAt: '2024-11-01T08:00:00.000Z',
    updatedAt: '2025-05-20T09:00:00.000Z',
  },
  DRIVER: {
    id: 'user_driver_01',
    email: 'andrei.vasile@transbus.ro',
    name: 'Andrei Vasile',
    role: 'DRIVER',
    phone: '+40734567890',
    avatarUrl: null,
    providerId: 'provider_01',
    preferences: { language: 'en', notifications: true, emailNotifications: true },
    status: 'ACTIVE',
    createdAt: '2025-02-10T07:00:00.000Z',
    updatedAt: '2025-06-01T10:00:00.000Z',
  },
  ADMIN: {
    id: 'user_admin_01',
    email: 'admin@gobus.ro',
    name: 'Admin GoBus',
    role: 'ADMIN',
    phone: '+40700000000',
    avatarUrl: null,
    providerId: null,
    preferences: { language: 'en', notifications: true, emailNotifications: true },
    status: 'ACTIVE',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2025-06-01T00:00:00.000Z',
  },
};

// A fake JWT with exp far in the future (year 2030)
const FAKE_ACCESS_TOKEN =
  'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyXzAxIiwiZXhwIjoxODkzNDU2MDAwfQ.fake_sig';
const FAKE_REFRESH_TOKEN = 'fake_refresh_token_for_e2e';

export async function setupAuthMock(page: Page, role: Role): Promise<void> {
  const user = MOCK_USERS[role];

  // Set refresh token in localStorage before page loads
  await page.addInitScript(
    ({ token, key }) => {
      localStorage.setItem(key, token);
    },
    { token: FAKE_REFRESH_TOKEN, key: 'gobus_refresh_token' },
  );

  // Mock POST /api/v1/auth/refresh
  await page.route('**/api/v1/auth/refresh', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: { accessToken: FAKE_ACCESS_TOKEN, refreshToken: FAKE_REFRESH_TOKEN },
      }),
    }),
  );

  // Mock GET /api/v1/auth/me
  await page.route('**/api/v1/auth/me', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: user }),
      });
    }
    return route.fallback();
  });
}
