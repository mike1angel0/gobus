import { describe, it, expect } from 'vitest';
import {
  authKeys,
  routeKeys,
  busKeys,
  scheduleKeys,
  bookingKeys,
  trackingKeys,
  searchKeys,
  driverKeys,
  delayKeys,
  adminKeys,
  driverTripKeys,
} from './keys';

describe('authKeys', () => {
  it('has correct "all" key', () => {
    expect(authKeys.all).toEqual(['auth']);
  });

  it('produces correct "me" key', () => {
    expect(authKeys.me()).toEqual(['auth', 'me']);
  });
});

describe.each([
  { name: 'routeKeys', keys: routeKeys, scope: 'routes' },
  { name: 'busKeys', keys: busKeys, scope: 'buses' },
  { name: 'scheduleKeys', keys: scheduleKeys, scope: 'schedules' },
  { name: 'bookingKeys', keys: bookingKeys, scope: 'bookings' },
  { name: 'driverKeys', keys: driverKeys, scope: 'drivers' },
  { name: 'delayKeys', keys: delayKeys, scope: 'delays' },
])('$name (createKeys-based)', ({ keys, scope }) => {
  it('has correct "all" key', () => {
    expect(keys.all).toEqual([scope]);
  });

  it('produces list key without filters', () => {
    expect(keys.lists()).toEqual([scope, 'list']);
  });

  it('produces list key with filters', () => {
    const filters = { page: 1, pageSize: 10 };
    expect(keys.lists(filters)).toEqual([scope, 'list', filters]);
  });

  it('produces detail key with id', () => {
    expect(keys.detail('abc-123')).toEqual([scope, 'detail', 'abc-123']);
  });

  it('all key is a prefix of list keys (hierarchical invalidation)', () => {
    const allKey = keys.all;
    const listKey = keys.lists();
    expect(listKey[0]).toBe(allKey[0]);
  });
});

describe('trackingKeys', () => {
  it('has correct "all" key', () => {
    expect(trackingKeys.all).toEqual(['tracking']);
  });

  it('produces list key without filters', () => {
    expect(trackingKeys.lists()).toEqual(['tracking', 'list']);
  });

  it('produces list key with filters', () => {
    expect(trackingKeys.lists({ busId: 'bus-1' })).toEqual([
      'tracking',
      'list',
      { busId: 'bus-1' },
    ]);
  });

  it('produces detail key with bus ID', () => {
    expect(trackingKeys.detail('bus-1')).toEqual(['tracking', 'detail', 'bus-1']);
  });
});

describe('searchKeys', () => {
  it('has correct "all" key', () => {
    expect(searchKeys.all).toEqual(['search']);
  });

  it('produces list key without filters', () => {
    expect(searchKeys.lists()).toEqual(['search', 'list']);
  });

  it('produces list key with search filters', () => {
    const filters = { from: 'CityA', to: 'CityB', date: '2026-03-26', passengers: 2 };
    expect(searchKeys.lists(filters)).toEqual(['search', 'list', filters]);
  });

  it('produces detail key with schedule ID', () => {
    expect(searchKeys.detail('sched-1')).toEqual(['search', 'detail', 'sched-1']);
  });
});

describe('adminKeys', () => {
  it('has correct "all" key', () => {
    expect(adminKeys.all).toEqual(['admin']);
  });

  it('produces buses key without filters', () => {
    expect(adminKeys.buses()).toEqual(['admin', 'buses']);
  });

  it('produces buses key with filters', () => {
    expect(adminKeys.buses({ page: 1 })).toEqual(['admin', 'buses', { page: 1 }]);
  });

  it('produces users key without filters', () => {
    expect(adminKeys.users()).toEqual(['admin', 'users']);
  });

  it('produces users key with filters', () => {
    expect(adminKeys.users({ role: 'PROVIDER', status: 'active' })).toEqual([
      'admin',
      'users',
      { role: 'PROVIDER', status: 'active' },
    ]);
  });

  it('produces userDetail key', () => {
    expect(adminKeys.userDetail('user-1')).toEqual(['admin', 'users', 'detail', 'user-1']);
  });

  it('produces userSessions key', () => {
    expect(adminKeys.userSessions('user-1')).toEqual(['admin', 'users', 'sessions', 'user-1']);
  });

  it('produces auditLogs key without filters', () => {
    expect(adminKeys.auditLogs()).toEqual(['admin', 'audit-logs']);
  });

  it('produces auditLogs key with filters', () => {
    expect(adminKeys.auditLogs({ page: 2 })).toEqual(['admin', 'audit-logs', { page: 2 }]);
  });
});

describe('driverTripKeys', () => {
  it('has correct "all" key', () => {
    expect(driverTripKeys.all).toEqual(['driver-trips']);
  });

  it('produces list key without filters', () => {
    expect(driverTripKeys.lists()).toEqual(['driver-trips', 'list']);
  });

  it('produces list key with filters', () => {
    expect(driverTripKeys.lists({ date: '2024-01-01' })).toEqual([
      'driver-trips',
      'list',
      { date: '2024-01-01' },
    ]);
  });

  it('produces detail key with schedule ID', () => {
    expect(driverTripKeys.detail('sched-1')).toEqual(['driver-trips', 'detail', 'sched-1']);
  });
});
