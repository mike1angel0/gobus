import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdminDashboardPage from './dashboard';
import { renderWithProviders } from '@/test/helpers';

/* ---------- Mocks ---------- */

const mockAdminUsers = vi.fn();
const mockAdminBuses = vi.fn();
const mockAuditLogs = vi.fn();

vi.mock('@/hooks/use-admin', () => ({
  useAdminUsers: (...args: unknown[]) => mockAdminUsers(...args),
  useAdminBuses: (...args: unknown[]) => mockAdminBuses(...args),
  useAuditLogs: (...args: unknown[]) => mockAuditLogs(...args),
}));

const mockAuth = vi.fn();

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockAuth(),
}));

/* ---------- Helpers ---------- */

/** Returns a loaded query state. */
function loadedState(data: unknown[] = [], meta?: Record<string, unknown>) {
  return {
    data: {
      data,
      meta: meta ?? { total: data.length, page: 1, pageSize: 20, totalPages: 1 },
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  };
}

/** Returns a loading query state. */
function loadingState() {
  return {
    data: undefined,
    isLoading: true,
    isError: false,
    refetch: vi.fn(),
  };
}

/** Returns an error query state. */
function errorState() {
  return {
    data: undefined,
    isLoading: false,
    isError: true,
    refetch: vi.fn(),
  };
}

/** Creates a mock audit log entry. */
function createAuditEntry(action: string, userId: string, createdAt: string) {
  return { action, userId, createdAt, id: `audit_${action}`, resource: 'user', resourceId: '1' };
}

/** Sets all queries to a loaded state with given counts. */
function setupLoadedDashboard(
  userCount = 42,
  providerCount = 5,
  busCount = 18,
  auditEntries: unknown[] = [],
) {
  mockAdminUsers.mockImplementation((params: { role?: string }) => {
    if (params.role === 'PROVIDER') {
      return loadedState([], { total: providerCount, page: 1, pageSize: 1, totalPages: 1 });
    }
    return loadedState([], { total: userCount, page: 1, pageSize: 1, totalPages: 1 });
  });
  mockAdminBuses.mockReturnValue(
    loadedState([], { total: busCount, page: 1, pageSize: 1, totalPages: 1 }),
  );
  mockAuditLogs.mockReturnValue(
    loadedState(auditEntries, {
      total: auditEntries.length,
      page: 1,
      pageSize: 5,
      totalPages: 1,
    }),
  );
}

/* ---------- Tests ---------- */

describe('AdminDashboardPage', () => {
  beforeEach(() => {
    mockAdminUsers.mockReset();
    mockAdminBuses.mockReset();
    mockAuditLogs.mockReset();
    mockAuth.mockReset();
    mockAuth.mockReturnValue({ user: { name: 'Admin User', role: 'ADMIN' } });
  });

  describe('loading state', () => {
    it('renders skeleton loaders while loading', () => {
      mockAdminUsers.mockReturnValue(loadingState());
      mockAdminBuses.mockReturnValue(loadingState());
      mockAuditLogs.mockReturnValue(loadingState());

      renderWithProviders(<AdminDashboardPage />);

      expect(screen.getByLabelText('Loading dashboard statistics')).toHaveAttribute(
        'aria-busy',
        'true',
      );
      expect(screen.getByLabelText('Loading recent activity')).toHaveAttribute('aria-busy', 'true');
    });
  });

  describe('error state', () => {
    it('renders error state when all queries fail', () => {
      mockAdminUsers.mockReturnValue(errorState());
      mockAdminBuses.mockReturnValue(errorState());
      mockAuditLogs.mockReturnValue(errorState());

      renderWithProviders(<AdminDashboardPage />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Failed to load dashboard')).toBeInTheDocument();
    });

    it('calls refetch on retry button click', async () => {
      const user = userEvent.setup();
      const usersRefetch = vi.fn();
      const busesRefetch = vi.fn();
      const auditRefetch = vi.fn();

      mockAdminUsers.mockReturnValue({ ...errorState(), refetch: usersRefetch });
      mockAdminBuses.mockReturnValue({ ...errorState(), refetch: busesRefetch });
      mockAuditLogs.mockReturnValue({ ...errorState(), refetch: auditRefetch });

      renderWithProviders(<AdminDashboardPage />);

      await user.click(screen.getByRole('button', { name: 'Try again' }));

      // All 4 queries should be retried (users, providers, buses, audit)
      expect(usersRefetch).toHaveBeenCalled();
      expect(busesRefetch).toHaveBeenCalledTimes(1);
      expect(auditRefetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('loaded state', () => {
    it('renders stat cards with correct values', () => {
      setupLoadedDashboard(42, 5, 18);

      renderWithProviders(<AdminDashboardPage />);

      expect(screen.getByText('42')).toBeInTheDocument();
      expect(screen.getByText('Total Users')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('Providers')).toBeInTheDocument();
      expect(screen.getByText('18')).toBeInTheDocument();
      expect(screen.getByText('Total Buses')).toBeInTheDocument();
    });

    it('renders personalized welcome heading', () => {
      setupLoadedDashboard();

      renderWithProviders(<AdminDashboardPage />);

      expect(
        screen.getByRole('heading', { level: 1, name: 'Welcome, Admin User' }),
      ).toBeInTheDocument();
    });

    it('renders default heading when no user name', () => {
      mockAuth.mockReturnValue({ user: { role: 'ADMIN' } });
      setupLoadedDashboard();

      renderWithProviders(<AdminDashboardPage />);

      expect(
        screen.getByRole('heading', { level: 1, name: 'Admin Dashboard' }),
      ).toBeInTheDocument();
    });

    it('renders audit events count in stat card', () => {
      const entries = [
        createAuditEntry('login', 'user1@test.com', '2026-03-20T10:00:00Z'),
        createAuditEntry('suspend', 'user2@test.com', '2026-03-20T11:00:00Z'),
      ];
      setupLoadedDashboard(42, 5, 18, entries);

      renderWithProviders(<AdminDashboardPage />);

      expect(screen.getByText('Audit Events')).toBeInTheDocument();
    });
  });

  describe('recent activity', () => {
    it('renders audit log entries', () => {
      const entries = [
        createAuditEntry('login', 'user1@test.com', '2026-03-20T10:00:00Z'),
        createAuditEntry('user.suspend', 'admin@test.com', '2026-03-20T11:00:00Z'),
      ];
      setupLoadedDashboard(42, 5, 18, entries);

      renderWithProviders(<AdminDashboardPage />);

      expect(screen.getByText('login')).toBeInTheDocument();
      expect(screen.getByText('user.suspend')).toBeInTheDocument();
      expect(screen.getByText('user1@test.com')).toBeInTheDocument();
      expect(screen.getByText('admin@test.com')).toBeInTheDocument();
    });

    it('renders empty state when no audit entries', () => {
      setupLoadedDashboard(42, 5, 18, []);

      renderWithProviders(<AdminDashboardPage />);

      expect(screen.getByText('No recent activity')).toBeInTheDocument();
    });

    it('renders "View all" link to audit logs page', () => {
      setupLoadedDashboard();

      renderWithProviders(<AdminDashboardPage />);

      const viewAllLink = screen.getByRole('link', { name: /View all/ });
      expect(viewAllLink).toHaveAttribute('href', '/admin/audit-logs');
    });
  });

  describe('quick actions', () => {
    it('renders navigation links to admin sub-pages', () => {
      setupLoadedDashboard();

      renderWithProviders(<AdminDashboardPage />);

      expect(screen.getByRole('link', { name: /Manage Users/ })).toHaveAttribute(
        'href',
        '/admin/users',
      );
      expect(screen.getByRole('link', { name: /Manage Fleet/ })).toHaveAttribute(
        'href',
        '/admin/fleet',
      );
      expect(screen.getByRole('link', { name: /View Audit Logs/ })).toHaveAttribute(
        'href',
        '/admin/audit-logs',
      );
    });
  });

  describe('stat card links', () => {
    it('stat cards link to correct admin pages', () => {
      setupLoadedDashboard();

      renderWithProviders(<AdminDashboardPage />);

      // Total Users and Providers both link to /admin/users
      const usersLinks = screen.getAllByRole('link', { name: /Total Users|Providers/ });
      for (const link of usersLinks) {
        expect(link).toHaveAttribute('href', '/admin/users');
      }

      expect(screen.getByRole('link', { name: /Total Buses/ })).toHaveAttribute(
        'href',
        '/admin/fleet',
      );
      expect(screen.getByRole('link', { name: /Audit Events/ })).toHaveAttribute(
        'href',
        '/admin/audit-logs',
      );
    });
  });

  describe('accessibility', () => {
    it('has proper heading hierarchy', () => {
      setupLoadedDashboard();

      renderWithProviders(<AdminDashboardPage />);

      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: 'Statistics' })).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { level: 2, name: 'Recent activity' }),
      ).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: 'Quick actions' })).toBeInTheDocument();
    });

    it('icons have aria-hidden attribute', () => {
      setupLoadedDashboard();

      const { container } = renderWithProviders(<AdminDashboardPage />);

      const svgs = container.querySelectorAll('svg');
      svgs.forEach((svg) => {
        expect(svg).toHaveAttribute('aria-hidden', 'true');
      });
    });

    it('has landmark sections with aria-labelledby', () => {
      setupLoadedDashboard();

      renderWithProviders(<AdminDashboardPage />);

      expect(document.getElementById('stats-heading')).toBeInTheDocument();
      expect(document.getElementById('activity-heading')).toBeInTheDocument();
      expect(document.getElementById('actions-heading')).toBeInTheDocument();
    });
  });

  describe('partial states', () => {
    it('shows individual stat card skeletons when some queries still loading', () => {
      // Users loaded (both general and provider calls), buses loading
      mockAdminUsers.mockReturnValue(
        loadedState([], { total: 10, page: 1, pageSize: 1, totalPages: 1 }),
      );
      mockAdminBuses.mockReturnValue(loadingState());
      mockAuditLogs.mockReturnValue(
        loadedState([], { total: 0, page: 1, pageSize: 5, totalPages: 1 }),
      );

      renderWithProviders(<AdminDashboardPage />);

      // Loaded stats should show values (users and providers both get 10 from same mock)
      expect(screen.getAllByText('10')).toHaveLength(2);
      // Stats skeleton should not show because usersQuery has data
      expect(screen.queryByLabelText('Loading dashboard statistics')).not.toBeInTheDocument();
    });

    it('renders "Unknown user" when audit entry has no userId', () => {
      const entries = [{ action: 'system.cleanup', createdAt: '2026-03-20T10:00:00Z' }];
      setupLoadedDashboard(42, 5, 18, entries);

      renderWithProviders(<AdminDashboardPage />);

      expect(screen.getByText('Unknown user')).toBeInTheDocument();
      expect(screen.getByText('system.cleanup')).toBeInTheDocument();
    });

    it('does not show full error when some queries have data', () => {
      mockAdminUsers.mockReturnValue(errorState());
      mockAdminBuses.mockReturnValue(
        loadedState([], { total: 10, page: 1, pageSize: 1, totalPages: 1 }),
      );
      mockAuditLogs.mockReturnValue(errorState());

      renderWithProviders(<AdminDashboardPage />);

      expect(screen.queryByText('Failed to load dashboard')).not.toBeInTheDocument();
    });
  });

  describe('data fetching', () => {
    it('fetches users with pageSize 1 for counting', () => {
      setupLoadedDashboard();

      renderWithProviders(<AdminDashboardPage />);

      // Should be called twice: once for all users, once for providers
      expect(mockAdminUsers).toHaveBeenCalledWith({ page: 1, pageSize: 1 });
      expect(mockAdminUsers).toHaveBeenCalledWith({ page: 1, pageSize: 1, role: 'PROVIDER' });
    });

    it('fetches buses with pageSize 1 for counting', () => {
      setupLoadedDashboard();

      renderWithProviders(<AdminDashboardPage />);

      expect(mockAdminBuses).toHaveBeenCalledWith({ page: 1, pageSize: 1 });
    });

    it('fetches recent audit logs with pageSize 5', () => {
      setupLoadedDashboard();

      renderWithProviders(<AdminDashboardPage />);

      expect(mockAuditLogs).toHaveBeenCalledWith({ page: 1, pageSize: 5 });
    });
  });
});
