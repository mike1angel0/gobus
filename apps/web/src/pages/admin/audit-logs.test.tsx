import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import i18n from '@/i18n/config';
import AdminAuditLogsPage from './audit-logs';
import { renderWithProviders } from '@/test/helpers';

/* ---------- Mocks ---------- */

const mockAuditLogs = vi.fn();

vi.mock('@/hooks/use-admin', () => ({
  useAuditLogs: (...args: unknown[]) => mockAuditLogs(...args),
}));

/* ---------- Helpers ---------- */

function createLog(overrides: Record<string, unknown> = {}) {
  return {
    id: 'log-1',
    userId: 'user-abc',
    action: 'LOGIN',
    resource: 'session',
    resourceId: 'sess-123',
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0 Test Browser',
    metadata: { browser: 'Chrome' },
    createdAt: '2026-03-20T14:30:00Z',
    ...overrides,
  };
}

function loadedState(logs: unknown[] = [], meta?: Record<string, unknown>) {
  return {
    data: {
      data: logs,
      meta: meta ?? { total: logs.length, page: 1, pageSize: 20, totalPages: 1 },
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

/* ---------- Tests ---------- */

describe('AdminAuditLogsPage', () => {
  beforeEach(() => {
    i18n.changeLanguage('en');
    mockAuditLogs.mockReset();
  });

  describe('loading state', () => {
    it('renders skeleton while loading', () => {
      mockAuditLogs.mockReturnValue(loadingState());

      renderWithProviders(<AdminAuditLogsPage />);

      expect(screen.getByLabelText('Loading audit logs')).toHaveAttribute('aria-busy', 'true');
    });
  });

  describe('error state', () => {
    it('renders error state when query fails', () => {
      mockAuditLogs.mockReturnValue(errorState());

      renderWithProviders(<AdminAuditLogsPage />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Failed to load audit logs')).toBeInTheDocument();
    });

    it('calls refetch on retry click', async () => {
      const user = userEvent.setup();
      const refetch = vi.fn();
      mockAuditLogs.mockReturnValue({ ...errorState(), refetch });

      renderWithProviders(<AdminAuditLogsPage />);
      await user.click(screen.getByRole('button', { name: 'Try again' }));

      expect(refetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('empty state', () => {
    it('renders empty state when no logs match', () => {
      mockAuditLogs.mockReturnValue(loadedState([]));

      renderWithProviders(<AdminAuditLogsPage />);

      expect(screen.getByText('No audit logs found')).toBeInTheDocument();
      expect(screen.getByText('No audit logs match the selected filters.')).toBeInTheDocument();
    });
  });

  describe('audit log list', () => {
    it('renders log rows with timestamp, action badge, resource, and IP', () => {
      const logs = [
        createLog({
          id: 'log-1',
          action: 'PROFILE_UPDATE',
          resource: 'session',
          ipAddress: '10.0.0.1',
        }),
        createLog({ id: 'log-2', action: 'USER_SUSPEND', resource: 'user', resourceId: 'u-42' }),
      ];
      mockAuditLogs.mockReturnValue(loadedState(logs));

      renderWithProviders(<AdminAuditLogsPage />);

      // Action badges (use getAllByText since actions also appear in dropdown)
      expect(screen.getAllByText('PROFILE_UPDATE').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('USER_SUSPEND').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('session')).toBeInTheDocument();
      expect(screen.getByText(/IP:.*10\.0\.0\.1/)).toBeInTheDocument();
    });

    it('shows userId on log row', () => {
      mockAuditLogs.mockReturnValue(loadedState([createLog({ userId: 'user-xyz' })]));

      renderWithProviders(<AdminAuditLogsPage />);

      expect(screen.getByText(/User:.*user-xyz/)).toBeInTheDocument();
    });

    it('shows resourceId in parentheses', () => {
      mockAuditLogs.mockReturnValue(loadedState([createLog({ resourceId: 'res-99' })]));

      renderWithProviders(<AdminAuditLogsPage />);

      expect(screen.getByText('(res-99)')).toBeInTheDocument();
    });
  });

  describe('expandable detail', () => {
    it('expands to show userAgent and metadata on click', async () => {
      const user = userEvent.setup();
      mockAuditLogs.mockReturnValue(
        loadedState([
          createLog({
            id: 'log-1',
            userAgent: 'TestAgent/1.0',
            metadata: { reason: 'scheduled' },
          }),
        ]),
      );

      renderWithProviders(<AdminAuditLogsPage />);

      // Detail should not be visible initially
      expect(screen.queryByTestId('audit-log-detail')).not.toBeInTheDocument();

      // Click to expand
      const rowButton = screen.getByRole('button', { name: /LOGIN on session/ });
      await user.click(rowButton);

      expect(screen.getByTestId('audit-log-detail')).toBeInTheDocument();
      expect(screen.getByText('TestAgent/1.0')).toBeInTheDocument();
      expect(screen.getByText(/"reason": "scheduled"/)).toBeInTheDocument();
    });

    it('collapses detail on second click', async () => {
      const user = userEvent.setup();
      mockAuditLogs.mockReturnValue(loadedState([createLog({ id: 'log-1', userAgent: 'Agent' })]));

      renderWithProviders(<AdminAuditLogsPage />);

      const rowButton = screen.getByRole('button', { name: /LOGIN on session/ });
      await user.click(rowButton);
      expect(screen.getByTestId('audit-log-detail')).toBeInTheDocument();

      await user.click(rowButton);
      expect(screen.queryByTestId('audit-log-detail')).not.toBeInTheDocument();
    });

    it('disables expand button when no detail data', () => {
      mockAuditLogs.mockReturnValue(
        loadedState([createLog({ id: 'log-1', userAgent: null, metadata: null })]),
      );

      renderWithProviders(<AdminAuditLogsPage />);

      const rowButton = screen.getByRole('button', { name: /LOGIN on session/ });
      expect(rowButton).toBeDisabled();
    });
  });

  describe('filters', () => {
    it('filters by action', async () => {
      const user = userEvent.setup();
      mockAuditLogs.mockReturnValue(loadedState([createLog()]));

      renderWithProviders(<AdminAuditLogsPage />);
      await user.selectOptions(screen.getByLabelText('Action'), 'USER_SUSPEND');

      expect(mockAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'USER_SUSPEND', page: 1 }),
      );
    });

    it('filters by user ID', async () => {
      const user = userEvent.setup();
      mockAuditLogs.mockReturnValue(loadedState([createLog()]));

      renderWithProviders(<AdminAuditLogsPage />);
      const input = screen.getByLabelText('User ID');
      await user.clear(input);
      await user.type(input, 'user-123');

      const lastCall = mockAuditLogs.mock.calls[mockAuditLogs.mock.calls.length - 1];
      expect(lastCall[0]).toMatchObject({ userId: 'user-123', page: 1 });
    });

    it('filters by dateFrom', async () => {
      const user = userEvent.setup();
      mockAuditLogs.mockReturnValue(loadedState([createLog()]));

      renderWithProviders(<AdminAuditLogsPage />);
      const input = screen.getByLabelText('From');
      await user.type(input, '2026-03-01');

      const lastCall = mockAuditLogs.mock.calls[mockAuditLogs.mock.calls.length - 1];
      expect(lastCall[0].dateFrom).toBeTruthy();
      expect(lastCall[0].page).toBe(1);
    });

    it('filters by dateTo', async () => {
      const user = userEvent.setup();
      mockAuditLogs.mockReturnValue(loadedState([createLog()]));

      renderWithProviders(<AdminAuditLogsPage />);
      const input = screen.getByLabelText('To');
      await user.type(input, '2026-03-31');

      const lastCall = mockAuditLogs.mock.calls[mockAuditLogs.mock.calls.length - 1];
      expect(lastCall[0].dateTo).toBeTruthy();
      expect(lastCall[0].page).toBe(1);
    });

    it('resets to page 1 when filter changes', async () => {
      const user = userEvent.setup();
      mockAuditLogs.mockReturnValue(
        loadedState([createLog()], { total: 40, page: 1, pageSize: 20, totalPages: 2 }),
      );

      renderWithProviders(<AdminAuditLogsPage />);

      // Go to page 2
      await user.click(screen.getByRole('button', { name: 'Next' }));
      // Change filter
      await user.selectOptions(screen.getByLabelText('Action'), 'LOGOUT');

      const lastCall = mockAuditLogs.mock.calls[mockAuditLogs.mock.calls.length - 1];
      expect(lastCall[0]).toMatchObject({ page: 1 });
    });
  });

  describe('pagination', () => {
    it('does not render pagination when single page', () => {
      mockAuditLogs.mockReturnValue(loadedState([createLog()]));

      renderWithProviders(<AdminAuditLogsPage />);

      expect(screen.queryByLabelText('Audit log pagination')).not.toBeInTheDocument();
    });

    it('renders pagination controls when multiple pages', () => {
      mockAuditLogs.mockReturnValue(
        loadedState([createLog()], { total: 40, page: 1, pageSize: 20, totalPages: 2 }),
      );

      renderWithProviders(<AdminAuditLogsPage />);

      expect(screen.getByLabelText('Audit log pagination')).toBeInTheDocument();
      expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    });

    it('disables Previous on first page', () => {
      mockAuditLogs.mockReturnValue(
        loadedState([createLog()], { total: 40, page: 1, pageSize: 20, totalPages: 2 }),
      );

      renderWithProviders(<AdminAuditLogsPage />);

      expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    });

    it('navigates to next page', async () => {
      const user = userEvent.setup();
      mockAuditLogs.mockReturnValue(
        loadedState([createLog()], { total: 40, page: 1, pageSize: 20, totalPages: 2 }),
      );

      renderWithProviders(<AdminAuditLogsPage />);
      await user.click(screen.getByRole('button', { name: 'Next' }));

      expect(mockAuditLogs).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));
    });
  });

  describe('accessibility', () => {
    it('has proper heading hierarchy', () => {
      mockAuditLogs.mockReturnValue(loadedState([createLog()]));

      renderWithProviders(<AdminAuditLogsPage />);

      expect(screen.getByRole('heading', { level: 1, name: 'Audit Logs' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: 'Audit log list' })).toBeInTheDocument();
    });

    it('filter group has aria-label', () => {
      mockAuditLogs.mockReturnValue(loadedState([createLog()]));

      renderWithProviders(<AdminAuditLogsPage />);

      expect(screen.getByRole('group', { name: 'Audit log filters' })).toBeInTheDocument();
    });

    it('filter inputs have labels', () => {
      mockAuditLogs.mockReturnValue(loadedState([createLog()]));

      renderWithProviders(<AdminAuditLogsPage />);

      expect(screen.getByLabelText('User ID')).toBeInTheDocument();
      expect(screen.getByLabelText('Action')).toBeInTheDocument();
      expect(screen.getByLabelText('From')).toBeInTheDocument();
      expect(screen.getByLabelText('To')).toBeInTheDocument();
    });

    it('row buttons have aria-expanded attribute', () => {
      mockAuditLogs.mockReturnValue(loadedState([createLog({ userAgent: 'Agent' })]));

      renderWithProviders(<AdminAuditLogsPage />);

      const rowButton = screen.getByRole('button', { name: /LOGIN on session/ });
      expect(rowButton).toHaveAttribute('aria-expanded', 'false');
    });

    it('icons have aria-hidden', () => {
      mockAuditLogs.mockReturnValue(loadedState([createLog({ userAgent: 'Agent' })]));

      const { container } = renderWithProviders(<AdminAuditLogsPage />);

      const svgs = container.querySelectorAll('svg');
      svgs.forEach((svg) => {
        expect(svg).toHaveAttribute('aria-hidden', 'true');
      });
    });
  });
});
