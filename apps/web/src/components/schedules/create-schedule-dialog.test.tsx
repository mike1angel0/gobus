import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { CreateScheduleDialog } from '@/components/schedules/create-schedule-dialog';
import { ApiError } from '@/api/errors';

/* ---------- Mocks ---------- */

const mockMutate = vi.fn();
const mockRoutes = vi.fn();
const mockBuses = vi.fn();
const mockDrivers = vi.fn();
const mockRouteDetail = vi.fn();

vi.mock('@/hooks/use-routes', () => ({
  useRoutes: (...args: unknown[]) => mockRoutes(...args),
  useRouteDetail: (...args: unknown[]) => mockRouteDetail(...args),
}));

vi.mock('@/hooks/use-buses', () => ({
  useBuses: (...args: unknown[]) => mockBuses(...args),
}));

vi.mock('@/hooks/use-drivers', () => ({
  useDrivers: (...args: unknown[]) => mockDrivers(...args),
}));

vi.mock('@/hooks/use-schedules', () => ({
  useCreateSchedule: () => ({ mutate: mockMutate, isPending: false }),
}));

const mockToast = vi.fn();

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

/* ---------- Helpers ---------- */

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function emptyListResult() {
  return {
    data: { data: [], meta: { total: 0, page: 1, pageSize: 100, totalPages: 0 } },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  };
}

function routeListResult() {
  return {
    data: {
      data: [
        {
          id: 'route_1',
          name: 'Berlin - Prague',
          providerId: 'prov_1',
          createdAt: '2026-01-01T00:00:00Z',
        },
      ],
      meta: { total: 1, page: 1, pageSize: 100, totalPages: 1 },
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  };
}

function busListResult() {
  return {
    data: {
      data: [
        {
          id: 'bus_1',
          licensePlate: 'AB-123',
          model: 'Mercedes',
          capacity: 50,
          rows: 13,
          columns: 4,
          providerId: 'prov_1',
          createdAt: '2026-01-01T00:00:00Z',
        },
      ],
      meta: { total: 1, page: 1, pageSize: 100, totalPages: 1 },
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  };
}

function driverListResult() {
  return {
    data: {
      data: [
        {
          id: 'drv_1',
          name: 'John Doe',
          email: 'john@example.com',
          userId: 'u1',
          providerId: 'prov_1',
          createdAt: '2026-01-01T00:00:00Z',
        },
      ],
      meta: { total: 1, page: 1, pageSize: 100, totalPages: 1 },
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  };
}

function routeDetailResult() {
  return {
    data: {
      data: {
        id: 'route_1',
        name: 'Berlin - Prague',
        providerId: 'prov_1',
        stops: [
          { id: 'stop_1', name: 'Berlin', lat: 52.52, lng: 13.4, orderIndex: 0 },
          { id: 'stop_2', name: 'Dresden', lat: 51.05, lng: 13.73, orderIndex: 1 },
          { id: 'stop_3', name: 'Prague', lat: 50.07, lng: 14.43, orderIndex: 2 },
        ],
        createdAt: '2026-01-01T00:00:00Z',
      },
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  };
}

function emptyRouteDetail() {
  return { data: undefined, isLoading: false, isError: false, refetch: vi.fn() };
}

function setupDefaultMocks() {
  mockRoutes.mockReturnValue(routeListResult());
  mockBuses.mockReturnValue(busListResult());
  mockDrivers.mockReturnValue(driverListResult());
  mockRouteDetail.mockReturnValue(emptyRouteDetail());
}

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Open' }));
  return screen.getByRole('dialog');
}

function renderDialog() {
  return render(
    <CreateScheduleDialog>
      <button>Open</button>
    </CreateScheduleDialog>,
    { wrapper: createWrapper() },
  );
}

/* ---------- Tests ---------- */

describe('CreateScheduleDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it('opens and shows form fields', async () => {
    const user = userEvent.setup();
    renderDialog();

    const dialog = await openDialog(user);

    expect(within(dialog).getByRole('heading', { name: 'Create schedule' })).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Route')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Bus')).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Driver/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Trip date')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Departure time')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Arrival time')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Base price')).toBeInTheDocument();
  });

  it('populates route, bus, and driver dropdowns', async () => {
    const user = userEvent.setup();
    renderDialog();

    const dialog = await openDialog(user);

    const routeSelect = within(dialog).getByLabelText('Route');
    expect(routeSelect).toHaveTextContent('Berlin - Prague');

    const busSelect = within(dialog).getByLabelText('Bus');
    expect(busSelect).toHaveTextContent('AB-123');

    const driverSelect = within(dialog).getByLabelText(/Driver/);
    expect(driverSelect).toHaveTextContent('John Doe');
  });

  describe('validation', () => {
    it('shows errors for all empty required fields', async () => {
      const user = userEvent.setup();
      renderDialog();
      const dialog = await openDialog(user);

      await user.click(within(dialog).getByRole('button', { name: 'Create schedule' }));

      expect(within(dialog).getByText('Route is required.')).toBeInTheDocument();
      expect(within(dialog).getByText('Bus is required.')).toBeInTheDocument();
      expect(within(dialog).getByText('Departure time is required.')).toBeInTheDocument();
      expect(within(dialog).getByText('Arrival time is required.')).toBeInTheDocument();
      expect(within(dialog).getByText('Base price is required.')).toBeInTheDocument();
      expect(within(dialog).getByText('Trip date is required.')).toBeInTheDocument();
      expect(mockMutate).not.toHaveBeenCalled();
    });

    it('shows error when arrival is before departure', async () => {
      const user = userEvent.setup();
      renderDialog();
      mockRouteDetail.mockReturnValue(routeDetailResult());
      const dialog = await openDialog(user);

      await user.selectOptions(within(dialog).getByLabelText('Route'), 'route_1');
      await user.selectOptions(within(dialog).getByLabelText('Bus'), 'bus_1');

      const depInput = within(dialog).getByLabelText('Departure time');
      const arrInput = within(dialog).getByLabelText('Arrival time');
      await user.type(depInput, '2026-04-10T12:00');
      await user.type(arrInput, '2026-04-10T08:00');

      await user.type(within(dialog).getByLabelText('Base price'), '25');
      await user.type(within(dialog).getByLabelText('Trip date'), '2026-04-10');

      await user.click(within(dialog).getByRole('button', { name: 'Create schedule' }));

      expect(
        within(dialog).getByText('Arrival time must be after departure time.'),
      ).toBeInTheDocument();
    });

    it('shows error when base price is NaN', async () => {
      const user = userEvent.setup();
      renderDialog();
      mockRouteDetail.mockReturnValue(routeDetailResult());
      const dialog = await openDialog(user);

      await user.selectOptions(within(dialog).getByLabelText('Route'), 'route_1');
      await user.selectOptions(within(dialog).getByLabelText('Bus'), 'bus_1');
      await user.type(within(dialog).getByLabelText('Departure time'), '2026-04-10T08:00');
      await user.type(within(dialog).getByLabelText('Arrival time'), '2026-04-10T12:00');

      // Type non-numeric text (onChange stores string, parseFloat returns NaN)
      const priceInput = within(dialog).getByLabelText('Base price');
      fireEvent.change(priceInput, { target: { value: 'abc' } });
      await user.type(within(dialog).getByLabelText('Trip date'), '2026-04-10');

      await user.click(within(dialog).getByRole('button', { name: 'Create schedule' }));

      expect(within(dialog).getByText('Base price is required.')).toBeInTheDocument();
    });

    it('shows error when route has fewer than 2 stops', async () => {
      const user = userEvent.setup();
      mockRouteDetail.mockReturnValue({
        ...routeDetailResult(),
        data: {
          data: {
            ...routeDetailResult().data!.data,
            stops: [{ id: 'stop_1', name: 'Berlin', lat: 52.52, lng: 13.4, orderIndex: 0 }],
          },
        },
      });
      renderDialog();
      const dialog = await openDialog(user);

      await user.selectOptions(within(dialog).getByLabelText('Route'), 'route_1');
      await user.selectOptions(within(dialog).getByLabelText('Bus'), 'bus_1');
      await user.type(within(dialog).getByLabelText('Departure time'), '2026-04-10T08:00');
      await user.type(within(dialog).getByLabelText('Arrival time'), '2026-04-10T12:00');
      await user.type(within(dialog).getByLabelText('Base price'), '25');
      await user.type(within(dialog).getByLabelText('Trip date'), '2026-04-10');

      await user.click(within(dialog).getByRole('button', { name: 'Create schedule' }));

      expect(
        within(dialog).getByText('Selected route must have at least 2 stops.'),
      ).toBeInTheDocument();
    });
  });

  describe('submission', () => {
    it('submits valid form data with stop times', async () => {
      const user = userEvent.setup();
      mockRouteDetail.mockReturnValue(routeDetailResult());
      renderDialog();
      const dialog = await openDialog(user);

      await user.selectOptions(within(dialog).getByLabelText('Route'), 'route_1');
      await user.selectOptions(within(dialog).getByLabelText('Bus'), 'bus_1');
      await user.selectOptions(within(dialog).getByLabelText(/Driver/), 'drv_1');
      await user.type(within(dialog).getByLabelText('Departure time'), '2026-04-10T08:00');
      await user.type(within(dialog).getByLabelText('Arrival time'), '2026-04-10T12:00');
      await user.type(within(dialog).getByLabelText('Base price'), '25');
      await user.type(within(dialog).getByLabelText('Trip date'), '2026-04-10');

      await user.click(within(dialog).getByRole('button', { name: 'Create schedule' }));

      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          routeId: 'route_1',
          busId: 'bus_1',
          driverId: 'drv_1',
          basePrice: 25,
          stopTimes: expect.arrayContaining([
            expect.objectContaining({ stopName: 'Berlin', orderIndex: 0, priceFromStart: 0 }),
            expect.objectContaining({ stopName: 'Prague', orderIndex: 2 }),
          ]),
        }),
        expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
      );
    });

    it('submits without driver when none selected', async () => {
      const user = userEvent.setup();
      mockRouteDetail.mockReturnValue(routeDetailResult());
      renderDialog();
      const dialog = await openDialog(user);

      await user.selectOptions(within(dialog).getByLabelText('Route'), 'route_1');
      await user.selectOptions(within(dialog).getByLabelText('Bus'), 'bus_1');
      await user.type(within(dialog).getByLabelText('Departure time'), '2026-04-10T08:00');
      await user.type(within(dialog).getByLabelText('Arrival time'), '2026-04-10T12:00');
      await user.type(within(dialog).getByLabelText('Base price'), '25');
      await user.type(within(dialog).getByLabelText('Trip date'), '2026-04-10');

      await user.click(within(dialog).getByRole('button', { name: 'Create schedule' }));

      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({ driverId: undefined }),
        expect.any(Object),
      );
    });

    it('includes daysOfWeek when days are toggled', async () => {
      const user = userEvent.setup();
      mockRouteDetail.mockReturnValue(routeDetailResult());
      renderDialog();
      const dialog = await openDialog(user);

      await user.selectOptions(within(dialog).getByLabelText('Route'), 'route_1');
      await user.selectOptions(within(dialog).getByLabelText('Bus'), 'bus_1');
      await user.type(within(dialog).getByLabelText('Departure time'), '2026-04-10T08:00');
      await user.type(within(dialog).getByLabelText('Arrival time'), '2026-04-10T12:00');
      await user.type(within(dialog).getByLabelText('Base price'), '25');
      await user.type(within(dialog).getByLabelText('Trip date'), '2026-04-10');

      // Toggle Mon (1) and Fri (5)
      await user.click(within(dialog).getByRole('button', { name: 'Mon' }));
      await user.click(within(dialog).getByRole('button', { name: 'Fri' }));

      await user.click(within(dialog).getByRole('button', { name: 'Create schedule' }));

      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({ daysOfWeek: [1, 5] }),
        expect.any(Object),
      );
    });

    it('un-toggles a day when clicked again', async () => {
      const user = userEvent.setup();
      mockRouteDetail.mockReturnValue(routeDetailResult());
      renderDialog();
      const dialog = await openDialog(user);

      // Toggle Mon, then un-toggle Mon
      const monBtn = within(dialog).getByRole('button', { name: 'Mon' });
      await user.click(monBtn);
      expect(monBtn).toHaveAttribute('aria-pressed', 'true');
      await user.click(monBtn);
      expect(monBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('stop times preview', () => {
    it('shows stop times preview when route is selected', async () => {
      const user = userEvent.setup();
      mockRouteDetail.mockReturnValue(routeDetailResult());
      renderDialog();
      const dialog = await openDialog(user);

      await user.selectOptions(within(dialog).getByLabelText('Route'), 'route_1');

      await waitFor(() => {
        expect(within(dialog).getByText(/3 stops/)).toBeInTheDocument();
      });

      expect(within(dialog).getByText('1. Berlin')).toBeInTheDocument();
      expect(within(dialog).getByText('2. Dresden')).toBeInTheDocument();
      expect(within(dialog).getByText('3. Prague')).toBeInTheDocument();
    });

    it('does not show preview when no route selected', async () => {
      const user = userEvent.setup();
      renderDialog();
      const dialog = await openDialog(user);

      expect(within(dialog).queryByText(/stops/)).not.toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('handles 404 error from mutation', async () => {
      const user = userEvent.setup();
      mockRouteDetail.mockReturnValue(routeDetailResult());
      renderDialog();
      const dialog = await openDialog(user);

      await user.selectOptions(within(dialog).getByLabelText('Route'), 'route_1');
      await user.selectOptions(within(dialog).getByLabelText('Bus'), 'bus_1');
      await user.type(within(dialog).getByLabelText('Departure time'), '2026-04-10T08:00');
      await user.type(within(dialog).getByLabelText('Arrival time'), '2026-04-10T12:00');
      await user.type(within(dialog).getByLabelText('Base price'), '25');
      await user.type(within(dialog).getByLabelText('Trip date'), '2026-04-10');

      await user.click(within(dialog).getByRole('button', { name: 'Create schedule' }));

      const onError = mockMutate.mock.calls[0][1].onError;
      onError(new ApiError({ type: 'about:blank', title: 'Not Found', status: 404 }));

      await waitFor(() => {
        expect(
          within(dialog).getByText('Referenced route, bus, or driver not found.'),
        ).toBeInTheDocument();
      });
    });

    it('handles field errors from mutation', async () => {
      const user = userEvent.setup();
      mockRouteDetail.mockReturnValue(routeDetailResult());
      renderDialog();
      const dialog = await openDialog(user);

      await user.selectOptions(within(dialog).getByLabelText('Route'), 'route_1');
      await user.selectOptions(within(dialog).getByLabelText('Bus'), 'bus_1');
      await user.type(within(dialog).getByLabelText('Departure time'), '2026-04-10T08:00');
      await user.type(within(dialog).getByLabelText('Arrival time'), '2026-04-10T12:00');
      await user.type(within(dialog).getByLabelText('Base price'), '25');
      await user.type(within(dialog).getByLabelText('Trip date'), '2026-04-10');

      await user.click(within(dialog).getByRole('button', { name: 'Create schedule' }));

      const onError = mockMutate.mock.calls[0][1].onError;
      onError(
        new ApiError({
          type: 'about:blank',
          title: 'Bad Request',
          status: 400,
          errors: [{ field: 'basePrice', message: 'Price too high' }],
        }),
      );

      await waitFor(() => {
        expect(within(dialog).getByText('Price too high')).toBeInTheDocument();
      });
    });

    it('ignores field errors for unknown fields', async () => {
      const user = userEvent.setup();
      mockRouteDetail.mockReturnValue(routeDetailResult());
      renderDialog();
      const dialog = await openDialog(user);

      await user.selectOptions(within(dialog).getByLabelText('Route'), 'route_1');
      await user.selectOptions(within(dialog).getByLabelText('Bus'), 'bus_1');
      await user.type(within(dialog).getByLabelText('Departure time'), '2026-04-10T08:00');
      await user.type(within(dialog).getByLabelText('Arrival time'), '2026-04-10T12:00');
      await user.type(within(dialog).getByLabelText('Base price'), '25');
      await user.type(within(dialog).getByLabelText('Trip date'), '2026-04-10');

      await user.click(within(dialog).getByRole('button', { name: 'Create schedule' }));

      const onError = mockMutate.mock.calls[0][1].onError;
      onError(
        new ApiError({
          type: 'about:blank',
          title: 'Bad Request',
          status: 400,
          errors: [{ field: 'unknownField', message: 'Unknown error' }],
        }),
      );

      await waitFor(() => {
        expect(within(dialog).queryByText('Unknown error')).not.toBeInTheDocument();
      });
    });

    it('ignores non-API errors in mutation handler', async () => {
      const user = userEvent.setup();
      mockRouteDetail.mockReturnValue(routeDetailResult());
      renderDialog();
      const dialog = await openDialog(user);

      await user.selectOptions(within(dialog).getByLabelText('Route'), 'route_1');
      await user.selectOptions(within(dialog).getByLabelText('Bus'), 'bus_1');
      await user.type(within(dialog).getByLabelText('Departure time'), '2026-04-10T08:00');
      await user.type(within(dialog).getByLabelText('Arrival time'), '2026-04-10T12:00');
      await user.type(within(dialog).getByLabelText('Base price'), '25');
      await user.type(within(dialog).getByLabelText('Trip date'), '2026-04-10');

      await user.click(within(dialog).getByRole('button', { name: 'Create schedule' }));

      const onError = mockMutate.mock.calls[0][1].onError;
      // Non-API error should not throw or cause UI changes
      onError(new Error('Network failure'));

      // No error text should appear from the mutation error handler
      expect(
        within(dialog).queryByText('Referenced route, bus, or driver not found.'),
      ).not.toBeInTheDocument();
    });
  });

  describe('success behavior', () => {
    it('closes dialog on successful creation', async () => {
      const user = userEvent.setup();
      mockRouteDetail.mockReturnValue(routeDetailResult());
      renderDialog();
      const dialog = await openDialog(user);

      await user.selectOptions(within(dialog).getByLabelText('Route'), 'route_1');
      await user.selectOptions(within(dialog).getByLabelText('Bus'), 'bus_1');
      await user.type(within(dialog).getByLabelText('Departure time'), '2026-04-10T08:00');
      await user.type(within(dialog).getByLabelText('Arrival time'), '2026-04-10T12:00');
      await user.type(within(dialog).getByLabelText('Base price'), '25');
      await user.type(within(dialog).getByLabelText('Trip date'), '2026-04-10');

      await user.click(within(dialog).getByRole('button', { name: 'Create schedule' }));

      const onSuccess = mockMutate.mock.calls[0][1].onSuccess;
      onSuccess();

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('empty data', () => {
    it('renders with empty dropdown options', async () => {
      const user = userEvent.setup();
      mockRoutes.mockReturnValue(emptyListResult());
      mockBuses.mockReturnValue(emptyListResult());
      mockDrivers.mockReturnValue(emptyListResult());
      renderDialog();

      const dialog = await openDialog(user);

      const routeSelect = within(dialog).getByLabelText('Route');
      expect(routeSelect.querySelectorAll('option')).toHaveLength(1); // only placeholder
    });
  });

  describe('accessibility', () => {
    it('marks invalid fields with aria-invalid', async () => {
      const user = userEvent.setup();
      renderDialog();
      const dialog = await openDialog(user);

      await user.click(within(dialog).getByRole('button', { name: 'Create schedule' }));

      expect(within(dialog).getByLabelText('Route')).toHaveAttribute('aria-invalid', 'true');
      expect(within(dialog).getByLabelText('Bus')).toHaveAttribute('aria-invalid', 'true');
    });

    it('has aria-pressed on day of week buttons', async () => {
      const user = userEvent.setup();
      renderDialog();
      const dialog = await openDialog(user);

      const monBtn = within(dialog).getByRole('button', { name: 'Mon' });
      expect(monBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});
