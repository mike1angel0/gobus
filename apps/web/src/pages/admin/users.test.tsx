import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdminUsersPage from './users';
import { renderWithProviders } from '@/test/helpers';

/* ---------- Mocks ---------- */

const mockAdminUsers = vi.fn();
const mockUpdateUserStatus = vi.fn();
const mockForceLogout = vi.fn();

vi.mock('@/hooks/use-admin', () => ({
  useAdminUsers: (...args: unknown[]) => mockAdminUsers(...args),
  useUpdateUserStatus: () => mockUpdateUserStatus(),
  useForceLogout: () => mockForceLogout(),
}));

const mockAuth = vi.fn();

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockAuth(),
}));

/* ---------- Helpers ---------- */

const ADMIN_USER = {
  id: 'admin-1',
  name: 'Admin User',
  email: 'admin@test.com',
  role: 'ADMIN' as const,
  status: 'ACTIVE' as const,
  failedLoginAttempts: 0,
  createdAt: '2026-01-15T10:00:00Z',
  updatedAt: '2026-01-15T10:00:00Z',
};

function createUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    role: 'PASSENGER',
    status: 'ACTIVE',
    failedLoginAttempts: 0,
    createdAt: '2026-02-10T08:00:00Z',
    updatedAt: '2026-02-10T08:00:00Z',
    ...overrides,
  };
}

function loadedState(users: unknown[] = [], meta?: Record<string, unknown>) {
  return {
    data: {
      data: users,
      meta: meta ?? { total: users.length, page: 1, pageSize: 20, totalPages: 1 },
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  };
}

function loadingState() {
  return { data: undefined, isLoading: true, isError: false, refetch: vi.fn() };
}

function errorState() {
  return { data: undefined, isLoading: false, isError: true, refetch: vi.fn() };
}

function mutationIdle() {
  return { mutate: vi.fn(), isPending: false };
}

/* ---------- Tests ---------- */

describe('AdminUsersPage', () => {
  beforeEach(() => {
    mockAdminUsers.mockReset();
    mockUpdateUserStatus.mockReset();
    mockForceLogout.mockReset();
    mockAuth.mockReset();

    mockAuth.mockReturnValue({ user: ADMIN_USER });
    mockUpdateUserStatus.mockReturnValue(mutationIdle());
    mockForceLogout.mockReturnValue(mutationIdle());
  });

  describe('loading state', () => {
    it('renders skeleton while loading', () => {
      mockAdminUsers.mockReturnValue(loadingState());

      renderWithProviders(<AdminUsersPage />);

      expect(screen.getByLabelText('Loading users')).toHaveAttribute('aria-busy', 'true');
    });
  });

  describe('error state', () => {
    it('renders error state when query fails', () => {
      mockAdminUsers.mockReturnValue(errorState());

      renderWithProviders(<AdminUsersPage />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Failed to load users')).toBeInTheDocument();
    });

    it('calls refetch on retry click', async () => {
      const user = userEvent.setup();
      const refetch = vi.fn();
      mockAdminUsers.mockReturnValue({ ...errorState(), refetch });

      renderWithProviders(<AdminUsersPage />);
      await user.click(screen.getByRole('button', { name: 'Try again' }));

      expect(refetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('empty state', () => {
    it('renders empty state when no users match', () => {
      mockAdminUsers.mockReturnValue(loadedState([]));

      renderWithProviders(<AdminUsersPage />);

      expect(screen.getByText('No users found')).toBeInTheDocument();
      expect(screen.getByText('No users match the selected filters.')).toBeInTheDocument();
    });
  });

  describe('user list', () => {
    it('renders user rows with name, email, role badge, and status badge', () => {
      const users = [
        createUser({ id: 'u1', name: 'Alice', email: 'alice@test.com', role: 'PASSENGER', status: 'ACTIVE' }),
        createUser({ id: 'u2', name: 'Bob', email: 'bob@test.com', role: 'DRIVER', status: 'SUSPENDED' }),
      ];
      mockAdminUsers.mockReturnValue(loadedState(users));

      renderWithProviders(<AdminUsersPage />);

      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('alice@test.com')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByText('bob@test.com')).toBeInTheDocument();
      expect(screen.getByText('PASSENGER')).toBeInTheDocument();
      expect(screen.getByText('DRIVER')).toBeInTheDocument();
      expect(screen.getByText('ACTIVE')).toBeInTheDocument();
      expect(screen.getByText('SUSPENDED')).toBeInTheDocument();
    });

    it('shows provider ID when present', () => {
      mockAdminUsers.mockReturnValue(
        loadedState([createUser({ providerId: 'prov-123' })]),
      );

      renderWithProviders(<AdminUsersPage />);

      expect(screen.getByText('Provider: prov-123')).toBeInTheDocument();
    });

    it('shows createdAt date', () => {
      mockAdminUsers.mockReturnValue(
        loadedState([createUser({ createdAt: '2026-02-10T08:00:00Z' })]),
      );

      renderWithProviders(<AdminUsersPage />);

      const timeEl = screen.getByRole('time' as string) ?? screen.getByText(/2\/10\/2026|2026/);
      expect(timeEl).toBeInTheDocument();
    });
  });

  describe('filters', () => {
    it('filters by role', async () => {
      const user = userEvent.setup();
      mockAdminUsers.mockReturnValue(loadedState([createUser()]));

      renderWithProviders(<AdminUsersPage />);
      await user.selectOptions(screen.getByLabelText('Role'), 'DRIVER');

      expect(mockAdminUsers).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'DRIVER', page: 1 }),
      );
    });

    it('filters by status', async () => {
      const user = userEvent.setup();
      mockAdminUsers.mockReturnValue(loadedState([createUser()]));

      renderWithProviders(<AdminUsersPage />);
      await user.selectOptions(screen.getByLabelText('Status'), 'LOCKED');

      expect(mockAdminUsers).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'LOCKED', page: 1 }),
      );
    });

    it('resets to page 1 when filter changes', async () => {
      const user = userEvent.setup();
      mockAdminUsers.mockReturnValue(
        loadedState([createUser()], { total: 40, page: 1, pageSize: 20, totalPages: 2 }),
      );

      renderWithProviders(<AdminUsersPage />);

      // Go to page 2
      await user.click(screen.getByRole('button', { name: 'Next' }));
      // Change filter
      await user.selectOptions(screen.getByLabelText('Role'), 'ADMIN');

      // Last call should be page 1
      const lastCall = mockAdminUsers.mock.calls[mockAdminUsers.mock.calls.length - 1];
      expect(lastCall[0]).toMatchObject({ page: 1 });
    });
  });

  describe('actions', () => {
    it('shows suspend button for active users', () => {
      mockAdminUsers.mockReturnValue(
        loadedState([createUser({ id: 'u1', name: 'Alice', status: 'ACTIVE' })]),
      );

      renderWithProviders(<AdminUsersPage />);

      expect(screen.getByRole('button', { name: 'Suspend Alice' })).toBeInTheDocument();
    });

    it('shows unsuspend button for suspended users', () => {
      mockAdminUsers.mockReturnValue(
        loadedState([createUser({ id: 'u1', name: 'Alice', status: 'SUSPENDED' })]),
      );

      renderWithProviders(<AdminUsersPage />);

      expect(screen.getByRole('button', { name: 'Unsuspend Alice' })).toBeInTheDocument();
    });

    it('shows unlock button for locked users', () => {
      mockAdminUsers.mockReturnValue(
        loadedState([createUser({ id: 'u1', name: 'Alice', status: 'LOCKED' })]),
      );

      renderWithProviders(<AdminUsersPage />);

      expect(screen.getByRole('button', { name: 'Unlock Alice' })).toBeInTheDocument();
    });

    it('shows force logout button for all users', () => {
      mockAdminUsers.mockReturnValue(
        loadedState([createUser({ id: 'u1', name: 'Alice' })]),
      );

      renderWithProviders(<AdminUsersPage />);

      expect(screen.getByRole('button', { name: 'Force logout Alice' })).toBeInTheDocument();
    });

    it('opens confirmation dialog on suspend click', async () => {
      const user = userEvent.setup();
      mockAdminUsers.mockReturnValue(
        loadedState([createUser({ id: 'u1', name: 'Alice', email: 'alice@test.com', status: 'ACTIVE' })]),
      );

      renderWithProviders(<AdminUsersPage />);
      await user.click(screen.getByRole('button', { name: 'Suspend Alice' }));

      expect(screen.getByText('Suspend user?')).toBeInTheDocument();
      const dialog = screen.getByRole('dialog');
      expect(within(dialog).getByText(/alice@test\.com/)).toBeInTheDocument();
    });

    it('calls updateStatus on confirm suspend', async () => {
      const user = userEvent.setup();
      const mutateFn = vi.fn((_vars: unknown, opts?: { onSettled?: () => void }) => {
        opts?.onSettled?.();
      });
      mockUpdateUserStatus.mockReturnValue({ mutate: mutateFn, isPending: false });
      mockAdminUsers.mockReturnValue(
        loadedState([createUser({ id: 'u1', name: 'Alice', status: 'ACTIVE' })]),
      );

      renderWithProviders(<AdminUsersPage />);
      await user.click(screen.getByRole('button', { name: 'Suspend Alice' }));

      const dialog = screen.getByRole('dialog');
      await user.click(within(dialog).getByRole('button', { name: 'Suspend' }));

      expect(mutateFn).toHaveBeenCalledWith(
        { id: 'u1', action: 'suspend' },
        expect.objectContaining({ onSettled: expect.any(Function) }),
      );
    });

    it('calls forceLogout on confirm force-logout', async () => {
      const user = userEvent.setup();
      const mutateFn = vi.fn((_vars: unknown, opts?: { onSettled?: () => void }) => {
        opts?.onSettled?.();
      });
      mockForceLogout.mockReturnValue({ mutate: mutateFn, isPending: false });
      mockAdminUsers.mockReturnValue(
        loadedState([createUser({ id: 'u1', name: 'Alice', status: 'ACTIVE' })]),
      );

      renderWithProviders(<AdminUsersPage />);
      await user.click(screen.getByRole('button', { name: 'Force logout Alice' }));

      const dialog = screen.getByRole('dialog');
      await user.click(within(dialog).getByRole('button', { name: 'Force logout' }));

      expect(mutateFn).toHaveBeenCalledWith(
        { id: 'u1' },
        expect.objectContaining({ onSettled: expect.any(Function) }),
      );
    });

    it('closes dialog on cancel', async () => {
      const user = userEvent.setup();
      mockAdminUsers.mockReturnValue(
        loadedState([createUser({ id: 'u1', name: 'Alice', status: 'ACTIVE' })]),
      );

      renderWithProviders(<AdminUsersPage />);
      await user.click(screen.getByRole('button', { name: 'Suspend Alice' }));

      expect(screen.getByRole('dialog')).toBeInTheDocument();

      const dialog = screen.getByRole('dialog');
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('self-action prevention', () => {
    it('disables action buttons on current admin row', () => {
      mockAdminUsers.mockReturnValue(loadedState([ADMIN_USER]));

      renderWithProviders(<AdminUsersPage />);

      const suspendBtn = screen.getByRole('button', { name: `Suspend ${ADMIN_USER.name}` });
      const logoutBtn = screen.getByRole('button', { name: `Force logout ${ADMIN_USER.name}` });

      expect(suspendBtn).toBeDisabled();
      expect(logoutBtn).toBeDisabled();
    });

    it('does not disable action buttons on other users', () => {
      mockAdminUsers.mockReturnValue(
        loadedState([createUser({ id: 'other-1', name: 'Other', status: 'ACTIVE' })]),
      );

      renderWithProviders(<AdminUsersPage />);

      expect(screen.getByRole('button', { name: 'Suspend Other' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Force logout Other' })).toBeEnabled();
    });
  });

  describe('pagination', () => {
    it('does not render pagination when single page', () => {
      mockAdminUsers.mockReturnValue(loadedState([createUser()]));

      renderWithProviders(<AdminUsersPage />);

      expect(screen.queryByLabelText('User list pagination')).not.toBeInTheDocument();
    });

    it('renders pagination controls when multiple pages', () => {
      mockAdminUsers.mockReturnValue(
        loadedState([createUser()], { total: 40, page: 1, pageSize: 20, totalPages: 2 }),
      );

      renderWithProviders(<AdminUsersPage />);

      expect(screen.getByLabelText('User list pagination')).toBeInTheDocument();
      expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    });

    it('disables Previous on first page', () => {
      mockAdminUsers.mockReturnValue(
        loadedState([createUser()], { total: 40, page: 1, pageSize: 20, totalPages: 2 }),
      );

      renderWithProviders(<AdminUsersPage />);

      expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    });

    it('navigates to next page', async () => {
      const user = userEvent.setup();
      mockAdminUsers.mockReturnValue(
        loadedState([createUser()], { total: 40, page: 1, pageSize: 20, totalPages: 2 }),
      );

      renderWithProviders(<AdminUsersPage />);
      await user.click(screen.getByRole('button', { name: 'Next' }));

      expect(mockAdminUsers).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2 }),
      );
    });
  });

  describe('accessibility', () => {
    it('has proper heading hierarchy', () => {
      mockAdminUsers.mockReturnValue(loadedState([createUser()]));

      renderWithProviders(<AdminUsersPage />);

      expect(screen.getByRole('heading', { level: 1, name: 'User Management' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: 'User list' })).toBeInTheDocument();
    });

    it('filter group has aria-label', () => {
      mockAdminUsers.mockReturnValue(loadedState([createUser()]));

      renderWithProviders(<AdminUsersPage />);

      expect(screen.getByRole('group', { name: 'User filters' })).toBeInTheDocument();
    });

    it('filter selects have labels', () => {
      mockAdminUsers.mockReturnValue(loadedState([createUser()]));

      renderWithProviders(<AdminUsersPage />);

      expect(screen.getByLabelText('Role')).toBeInTheDocument();
      expect(screen.getByLabelText('Status')).toBeInTheDocument();
    });

    it('action buttons have aria-labels with user name', () => {
      mockAdminUsers.mockReturnValue(
        loadedState([createUser({ id: 'u1', name: 'Alice', status: 'ACTIVE' })]),
      );

      renderWithProviders(<AdminUsersPage />);

      expect(screen.getByRole('button', { name: 'Suspend Alice' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Force logout Alice' })).toBeInTheDocument();
    });

    it('icons have aria-hidden', () => {
      mockAdminUsers.mockReturnValue(
        loadedState([createUser({ id: 'u1', name: 'Alice', status: 'ACTIVE' })]),
      );

      const { container } = renderWithProviders(<AdminUsersPage />);

      const svgs = container.querySelectorAll('svg');
      svgs.forEach((svg) => {
        expect(svg).toHaveAttribute('aria-hidden', 'true');
      });
    });
  });
});
