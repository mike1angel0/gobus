import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ProviderDriversPage from './drivers';
import { renderWithProviders } from '@/test/helpers';
import { ApiError } from '@/api/errors';

/* ---------- Mocks ---------- */

const mockDrivers = vi.fn();
const mockCreateDriver = vi.fn();
const mockDeleteDriver = vi.fn();

vi.mock('@/hooks/use-drivers', () => ({
  useDrivers: (...args: unknown[]) => mockDrivers(...args),
  useCreateDriver: () => mockCreateDriver(),
  useDeleteDriver: () => mockDeleteDriver(),
}));

/* ---------- Helpers ---------- */

/** Returns a loaded state for the useDrivers hook. */
function loadedState(drivers: unknown[] = []) {
  return {
    data: { data: drivers, meta: { total: drivers.length, page: 1, pageSize: 50, totalPages: 1 } },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  };
}

/** Returns a loading state. */
function loadingState() {
  return {
    data: undefined,
    isLoading: true,
    isError: false,
    refetch: vi.fn(),
  };
}

/** Returns an error state. */
function errorState() {
  return {
    data: undefined,
    isLoading: false,
    isError: true,
    refetch: vi.fn(),
  };
}

/** Creates a mock driver. */
function createMockDriver(id: string, name: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name,
    email: `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
    role: 'DRIVER',
    status: 'ACTIVE',
    providerId: 'prov_1',
    assignedScheduleCount: 0,
    createdAt: '2026-03-20T10:00:00Z',
    phone: null,
    ...overrides,
  };
}

/** Returns a default mutation result (idle). */
function idleMutation() {
  return { mutate: vi.fn(), isPending: false };
}

/* ---------- Tests ---------- */

describe('ProviderDriversPage', () => {
  beforeEach(() => {
    mockDrivers.mockReset();
    mockCreateDriver.mockReset();
    mockDeleteDriver.mockReset();
    mockCreateDriver.mockReturnValue(idleMutation());
    mockDeleteDriver.mockReturnValue(idleMutation());
  });

  describe('loading state', () => {
    it('renders skeleton loaders while loading', () => {
      mockDrivers.mockReturnValue(loadingState());

      renderWithProviders(<ProviderDriversPage />);

      expect(screen.getByLabelText('Loading drivers')).toHaveAttribute('aria-busy', 'true');
    });
  });

  describe('loaded state', () => {
    it('renders driver cards with names and emails', () => {
      const drivers = [
        createMockDriver('drv_1', 'John Smith', { email: 'john@example.com' }),
        createMockDriver('drv_2', 'Jane Doe', { email: 'jane@example.com' }),
      ];
      mockDrivers.mockReturnValue(loadedState(drivers));

      renderWithProviders(<ProviderDriversPage />);

      expect(screen.getByText('John Smith')).toBeInTheDocument();
      expect(screen.getByText('john@example.com')).toBeInTheDocument();
      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
      expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    });

    it('shows phone when available', () => {
      const drivers = [createMockDriver('drv_1', 'John Smith', { phone: '+40 712 345 678' })];
      mockDrivers.mockReturnValue(loadedState(drivers));

      renderWithProviders(<ProviderDriversPage />);

      expect(screen.getByText('+40 712 345 678')).toBeInTheDocument();
    });

    it('shows assigned schedule count', () => {
      const drivers = [createMockDriver('drv_1', 'John Smith', { assignedScheduleCount: 3 })];
      mockDrivers.mockReturnValue(loadedState(drivers));

      renderWithProviders(<ProviderDriversPage />);

      expect(screen.getByText('3 schedules assigned')).toBeInTheDocument();
    });

    it('uses singular "schedule" for count of 1', () => {
      const drivers = [createMockDriver('drv_1', 'John Smith', { assignedScheduleCount: 1 })];
      mockDrivers.mockReturnValue(loadedState(drivers));

      renderWithProviders(<ProviderDriversPage />);

      expect(screen.getByText('1 schedule assigned')).toBeInTheDocument();
    });

    it('renders empty state when no drivers exist', () => {
      mockDrivers.mockReturnValue(loadedState([]));

      renderWithProviders(<ProviderDriversPage />);

      expect(screen.getByText('No drivers yet')).toBeInTheDocument();
      expect(
        screen.getByText('Create your first driver account to assign them to schedules.'),
      ).toBeInTheDocument();
    });

    it('renders create driver button', () => {
      mockDrivers.mockReturnValue(loadedState([]));

      renderWithProviders(<ProviderDriversPage />);

      expect(screen.getByRole('button', { name: /Create driver/ })).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('renders error state when query fails', () => {
      mockDrivers.mockReturnValue(errorState());

      renderWithProviders(<ProviderDriversPage />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Failed to load drivers')).toBeInTheDocument();
    });

    it('calls refetch on retry button click', async () => {
      const user = userEvent.setup();
      const refetch = vi.fn();
      mockDrivers.mockReturnValue({ ...errorState(), refetch });

      renderWithProviders(<ProviderDriversPage />);

      await user.click(screen.getByRole('button', { name: 'Try again' }));
      expect(refetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('create driver dialog', () => {
    it('opens create dialog when button is clicked', async () => {
      const user = userEvent.setup();
      mockDrivers.mockReturnValue(loadedState([]));

      renderWithProviders(<ProviderDriversPage />);

      await user.click(screen.getByRole('button', { name: /Create driver/ }));

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(
        screen.getByText('Create driver', { selector: '[class*="font-semibold"]' }),
      ).toBeInTheDocument();
    });

    it('has name, email, password, and phone inputs', async () => {
      const user = userEvent.setup();
      mockDrivers.mockReturnValue(loadedState([]));

      renderWithProviders(<ProviderDriversPage />);

      await user.click(screen.getByRole('button', { name: /Create driver/ }));

      expect(screen.getByLabelText('Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();
      expect(screen.getByLabelText(/Phone/)).toBeInTheDocument();
    });

    it('validates empty required fields', async () => {
      const user = userEvent.setup();
      mockDrivers.mockReturnValue(loadedState([]));

      renderWithProviders(<ProviderDriversPage />);

      await user.click(screen.getByRole('button', { name: /Create driver/ }));
      await user.click(screen.getByRole('button', { name: 'Create driver' }));

      expect(screen.getByText('Name is required.')).toBeInTheDocument();
      expect(screen.getByText('Email is required.')).toBeInTheDocument();
      expect(screen.getByText('Password is required.')).toBeInTheDocument();
    });

    it('validates invalid email format', async () => {
      const user = userEvent.setup();
      mockDrivers.mockReturnValue(loadedState([]));

      renderWithProviders(<ProviderDriversPage />);

      await user.click(screen.getByRole('button', { name: /Create driver/ }));

      await user.type(screen.getByLabelText('Name'), 'John');
      await user.type(screen.getByLabelText('Email'), 'invalid-email');
      await user.type(screen.getByLabelText('Password'), 'Password1');
      await user.click(screen.getByRole('button', { name: 'Create driver' }));

      expect(screen.getByText('Please enter a valid email address.')).toBeInTheDocument();
    });

    it('validates password requirements', async () => {
      const user = userEvent.setup();
      mockDrivers.mockReturnValue(loadedState([]));

      renderWithProviders(<ProviderDriversPage />);

      await user.click(screen.getByRole('button', { name: /Create driver/ }));

      await user.type(screen.getByLabelText('Name'), 'John');
      await user.type(screen.getByLabelText('Email'), 'john@test.com');
      await user.type(screen.getByLabelText('Password'), 'weak');
      await user.click(screen.getByRole('button', { name: 'Create driver' }));

      expect(screen.getByText(/Password must be at least 8 characters/)).toBeInTheDocument();
    });

    it('validates password pattern (uppercase, lowercase, digit)', async () => {
      const user = userEvent.setup();
      mockDrivers.mockReturnValue(loadedState([]));

      renderWithProviders(<ProviderDriversPage />);

      await user.click(screen.getByRole('button', { name: /Create driver/ }));

      await user.type(screen.getByLabelText('Name'), 'John');
      await user.type(screen.getByLabelText('Email'), 'john@test.com');
      await user.type(screen.getByLabelText('Password'), 'alllowercase');
      await user.click(screen.getByRole('button', { name: 'Create driver' }));

      expect(
        screen.getByText('Password must contain at least 1 uppercase, 1 lowercase, and 1 digit.'),
      ).toBeInTheDocument();
    });

    it('submits form with valid data', async () => {
      const user = userEvent.setup();
      const mutateFn = vi.fn();
      mockDrivers.mockReturnValue(loadedState([]));
      mockCreateDriver.mockReturnValue({ mutate: mutateFn, isPending: false });

      renderWithProviders(<ProviderDriversPage />);

      await user.click(screen.getByRole('button', { name: /Create driver/ }));

      await user.type(screen.getByLabelText('Name'), 'John Smith');
      await user.type(screen.getByLabelText('Email'), 'john@example.com');
      await user.type(screen.getByLabelText('Password'), 'Password1');
      await user.type(screen.getByLabelText(/Phone/), '+40 712 345 678');

      await user.click(screen.getByRole('button', { name: 'Create driver' }));

      expect(mutateFn).toHaveBeenCalledTimes(1);
      expect(mutateFn).toHaveBeenCalledWith(
        {
          name: 'John Smith',
          email: 'john@example.com',
          password: 'Password1',
          phone: '+40 712 345 678',
        },
        expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
      );
    });

    it('submits without phone when empty', async () => {
      const user = userEvent.setup();
      const mutateFn = vi.fn();
      mockDrivers.mockReturnValue(loadedState([]));
      mockCreateDriver.mockReturnValue({ mutate: mutateFn, isPending: false });

      renderWithProviders(<ProviderDriversPage />);

      await user.click(screen.getByRole('button', { name: /Create driver/ }));

      await user.type(screen.getByLabelText('Name'), 'John Smith');
      await user.type(screen.getByLabelText('Email'), 'john@example.com');
      await user.type(screen.getByLabelText('Password'), 'Password1');

      await user.click(screen.getByRole('button', { name: 'Create driver' }));

      expect(mutateFn).toHaveBeenCalledWith(
        {
          name: 'John Smith',
          email: 'john@example.com',
          password: 'Password1',
        },
        expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
      );
    });

    it('handles 409 email conflict error', async () => {
      const user = userEvent.setup();
      const mutateFn = vi.fn();
      mockDrivers.mockReturnValue(loadedState([]));
      mockCreateDriver.mockReturnValue({ mutate: mutateFn, isPending: false });

      renderWithProviders(<ProviderDriversPage />);

      await user.click(screen.getByRole('button', { name: /Create driver/ }));

      await user.type(screen.getByLabelText('Name'), 'John');
      await user.type(screen.getByLabelText('Email'), 'john@example.com');
      await user.type(screen.getByLabelText('Password'), 'Password1');
      await user.click(screen.getByRole('button', { name: 'Create driver' }));

      // Simulate 409 error callback
      const onError = mutateFn.mock.calls[0][1].onError;
      onError(
        new ApiError({
          status: 409,
          title: 'Conflict',
          type: 'about:blank',
          detail: 'Email already in use',
        }),
      );

      await waitFor(() => {
        expect(
          screen.getByText('A user with this email address already exists.'),
        ).toBeInTheDocument();
      });
    });
  });

  describe('delete driver', () => {
    it('opens confirmation dialog when delete button is clicked', async () => {
      const user = userEvent.setup();
      const drivers = [createMockDriver('drv_1', 'John Smith')];
      mockDrivers.mockReturnValue(loadedState(drivers));

      renderWithProviders(<ProviderDriversPage />);

      await user.click(screen.getByRole('button', { name: 'Delete driver John Smith' }));

      expect(screen.getByText('Delete driver')).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to delete/)).toBeInTheDocument();
    });

    it('warns about schedule impact in delete dialog', async () => {
      const user = userEvent.setup();
      const drivers = [createMockDriver('drv_1', 'John Smith', { assignedScheduleCount: 3 })];
      mockDrivers.mockReturnValue(loadedState(drivers));

      renderWithProviders(<ProviderDriversPage />);

      await user.click(screen.getByRole('button', { name: 'Delete driver John Smith' }));

      expect(screen.getByText(/assigned to 3 schedules/)).toBeInTheDocument();
      expect(screen.getByText(/They will be unassigned/)).toBeInTheDocument();
    });

    it('calls delete mutation on confirm', async () => {
      const user = userEvent.setup();
      const mutateFn = vi.fn();
      const drivers = [createMockDriver('drv_1', 'John Smith')];
      mockDrivers.mockReturnValue(loadedState(drivers));
      mockDeleteDriver.mockReturnValue({ mutate: mutateFn, isPending: false });

      renderWithProviders(<ProviderDriversPage />);

      await user.click(screen.getByRole('button', { name: 'Delete driver John Smith' }));
      await user.click(screen.getByRole('button', { name: 'Delete' }));

      expect(mutateFn).toHaveBeenCalledWith('drv_1');
    });

    it('can cancel delete via cancel button', async () => {
      const user = userEvent.setup();
      const mutateFn = vi.fn();
      const drivers = [createMockDriver('drv_1', 'John Smith')];
      mockDrivers.mockReturnValue(loadedState(drivers));
      mockDeleteDriver.mockReturnValue({ mutate: mutateFn, isPending: false });

      renderWithProviders(<ProviderDriversPage />);

      await user.click(screen.getByRole('button', { name: 'Delete driver John Smith' }));
      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(mutateFn).not.toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('has proper heading hierarchy', () => {
      mockDrivers.mockReturnValue(loadedState([]));

      renderWithProviders(<ProviderDriversPage />);

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Drivers');
      expect(screen.getByRole('heading', { level: 2, name: 'Drivers' })).toBeInTheDocument();
    });

    it('uses landmark section with aria-labelledby', () => {
      mockDrivers.mockReturnValue(loadedState([]));

      renderWithProviders(<ProviderDriversPage />);

      expect(screen.getByLabelText('Drivers')).toBeInTheDocument();
    });

    it('icons have aria-hidden attribute', () => {
      const drivers = [createMockDriver('drv_1', 'John Smith')];
      mockDrivers.mockReturnValue(loadedState(drivers));

      const { container } = renderWithProviders(<ProviderDriversPage />);

      const svgs = container.querySelectorAll('svg');
      svgs.forEach((svg) => {
        expect(svg).toHaveAttribute('aria-hidden', 'true');
      });
    });

    it('delete buttons have descriptive aria labels', () => {
      const drivers = [
        createMockDriver('drv_1', 'John Smith'),
        createMockDriver('drv_2', 'Jane Doe'),
      ];
      mockDrivers.mockReturnValue(loadedState(drivers));

      renderWithProviders(<ProviderDriversPage />);

      expect(screen.getByRole('button', { name: 'Delete driver John Smith' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete driver Jane Doe' })).toBeInTheDocument();
    });
  });

  describe('responsive layout', () => {
    it('driver grid uses responsive classes', () => {
      const drivers = [createMockDriver('drv_1', 'John Smith')];
      mockDrivers.mockReturnValue(loadedState(drivers));

      renderWithProviders(<ProviderDriversPage />);

      const grid = screen.getByLabelText('Drivers list');
      expect(grid).toHaveClass('sm:grid-cols-2', 'lg:grid-cols-3');
    });
  });

  describe('data fetching', () => {
    it('fetches drivers with pageSize 50', () => {
      mockDrivers.mockReturnValue(loadedState([]));

      renderWithProviders(<ProviderDriversPage />);

      expect(mockDrivers).toHaveBeenCalledWith({ page: 1, pageSize: 50 });
    });
  });
});
