import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ProviderRoutesPage from './routes';
import { renderWithProviders } from '@/test/helpers';

/* ---------- Mocks ---------- */

const mockRoutes = vi.fn();
const mockCreateRoute = vi.fn();
const mockDeleteRoute = vi.fn();

vi.mock('@/hooks/use-routes', () => ({
  useRoutes: (...args: unknown[]) => mockRoutes(...args),
  useCreateRoute: () => mockCreateRoute(),
  useDeleteRoute: () => mockDeleteRoute(),
}));

/* ---------- Helpers ---------- */

/** Returns a loaded state for the useRoutes hook. */
function loadedState(routes: unknown[] = []) {
  return {
    data: { data: routes, meta: { total: routes.length, page: 1, pageSize: 50, totalPages: 1 } },
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

/** Creates a mock route. */
function createMockRoute(id: string, name: string) {
  return { id, name, providerId: 'prov_1', createdAt: '2026-03-20T10:00:00Z' };
}

/** Returns a default mutation result (idle). */
function idleMutation() {
  return { mutate: vi.fn(), isPending: false };
}

/* ---------- Tests ---------- */

describe('ProviderRoutesPage', () => {
  beforeEach(() => {
    mockRoutes.mockReset();
    mockCreateRoute.mockReset();
    mockDeleteRoute.mockReset();
    mockCreateRoute.mockReturnValue(idleMutation());
    mockDeleteRoute.mockReturnValue(idleMutation());
  });

  describe('loading state', () => {
    it('renders skeleton loaders while loading', () => {
      mockRoutes.mockReturnValue(loadingState());

      renderWithProviders(<ProviderRoutesPage />);

      expect(screen.getByLabelText('Loading routes')).toHaveAttribute('aria-busy', 'true');
    });
  });

  describe('loaded state', () => {
    it('renders route cards with names', () => {
      const routes = [
        createMockRoute('route_1', 'Bucharest — Cluj'),
        createMockRoute('route_2', 'Iasi — Timisoara'),
      ];
      mockRoutes.mockReturnValue(loadedState(routes));

      renderWithProviders(<ProviderRoutesPage />);

      expect(screen.getByText('Bucharest — Cluj')).toBeInTheDocument();
      expect(screen.getByText('Iasi — Timisoara')).toBeInTheDocument();
    });

    it('renders empty state when no routes exist', () => {
      mockRoutes.mockReturnValue(loadedState([]));

      renderWithProviders(<ProviderRoutesPage />);

      expect(screen.getByText('No routes yet')).toBeInTheDocument();
      expect(
        screen.getByText('Create your first route to start scheduling trips.'),
      ).toBeInTheDocument();
    });

    it('renders create route button', () => {
      mockRoutes.mockReturnValue(loadedState([]));

      renderWithProviders(<ProviderRoutesPage />);

      expect(screen.getByRole('button', { name: /Create route/ })).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('renders error state when query fails', () => {
      mockRoutes.mockReturnValue(errorState());

      renderWithProviders(<ProviderRoutesPage />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Failed to load routes')).toBeInTheDocument();
    });

    it('calls refetch on retry button click', async () => {
      const user = userEvent.setup();
      const refetch = vi.fn();
      mockRoutes.mockReturnValue({ ...errorState(), refetch });

      renderWithProviders(<ProviderRoutesPage />);

      await user.click(screen.getByRole('button', { name: 'Try again' }));
      expect(refetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('create route dialog', () => {
    it('opens create dialog when button is clicked', async () => {
      const user = userEvent.setup();
      mockRoutes.mockReturnValue(loadedState([]));

      renderWithProviders(<ProviderRoutesPage />);

      await user.click(screen.getByRole('button', { name: /Create route/ }));

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(
        screen.getByText('Create route', { selector: '[class*="font-semibold"]' }),
      ).toBeInTheDocument();
    });

    it('has route name input and two initial stops', async () => {
      const user = userEvent.setup();
      mockRoutes.mockReturnValue(loadedState([]));

      renderWithProviders(<ProviderRoutesPage />);

      await user.click(screen.getByRole('button', { name: /Create route/ }));

      expect(screen.getByLabelText('Route name')).toBeInTheDocument();
      const stopsList = screen.getByRole('list', { name: 'Route stops' });
      expect(within(stopsList).getAllByPlaceholderText('Stop name')).toHaveLength(2);
    });

    it('validates empty route name', async () => {
      const user = userEvent.setup();
      mockRoutes.mockReturnValue(loadedState([]));

      renderWithProviders(<ProviderRoutesPage />);

      await user.click(screen.getByRole('button', { name: /Create route/ }));
      await user.click(screen.getByRole('button', { name: 'Create route' }));

      expect(screen.getByText('Route name is required.')).toBeInTheDocument();
    });

    it('validates minimum 2 stops', async () => {
      const user = userEvent.setup();
      mockRoutes.mockReturnValue(loadedState([]));

      renderWithProviders(<ProviderRoutesPage />);

      await user.click(screen.getByRole('button', { name: /Create route/ }));

      // Remove both default stops
      const removeButtons = screen.getAllByRole('button', { name: /Remove stop/ });
      await user.click(removeButtons[1]);
      await user.click(screen.getByRole('button', { name: /Remove stop/ }));

      await user.type(screen.getByLabelText('Route name'), 'Test Route');
      await user.click(screen.getByRole('button', { name: 'Create route' }));

      expect(screen.getByText('A route must have at least 2 stops.')).toBeInTheDocument();
    });

    it('validates stop coordinates', async () => {
      const user = userEvent.setup();
      mockRoutes.mockReturnValue(loadedState([]));

      renderWithProviders(<ProviderRoutesPage />);

      await user.click(screen.getByRole('button', { name: /Create route/ }));

      await user.type(screen.getByLabelText('Route name'), 'Test Route');

      const stopNames = screen.getAllByPlaceholderText('Stop name');
      await user.type(stopNames[0], 'Stop A');
      await user.type(stopNames[1], 'Stop B');

      // Leave lat/lng empty — should fail validation
      await user.click(screen.getByRole('button', { name: 'Create route' }));

      expect(screen.getByText(/latitude must be between/)).toBeInTheDocument();
    });

    it('submits form with valid data', async () => {
      const user = userEvent.setup();
      const mutateFn = vi.fn();
      mockRoutes.mockReturnValue(loadedState([]));
      mockCreateRoute.mockReturnValue({ mutate: mutateFn, isPending: false });

      renderWithProviders(<ProviderRoutesPage />);

      await user.click(screen.getByRole('button', { name: /Create route/ }));

      await user.type(screen.getByLabelText('Route name'), 'Bucharest — Cluj');

      const stopNames = screen.getAllByPlaceholderText('Stop name');
      const lats = screen.getAllByPlaceholderText('Lat');
      const lngs = screen.getAllByPlaceholderText('Lng');

      await user.type(stopNames[0], 'Bucharest');
      await user.type(lats[0], '44.4268');
      await user.type(lngs[0], '26.1025');

      await user.type(stopNames[1], 'Cluj');
      await user.type(lats[1], '46.7712');
      await user.type(lngs[1], '23.6236');

      await user.click(screen.getByRole('button', { name: 'Create route' }));

      expect(mutateFn).toHaveBeenCalledTimes(1);
      expect(mutateFn).toHaveBeenCalledWith(
        {
          name: 'Bucharest — Cluj',
          stops: [
            { name: 'Bucharest', lat: 44.4268, lng: 26.1025, orderIndex: 0 },
            { name: 'Cluj', lat: 46.7712, lng: 23.6236, orderIndex: 1 },
          ],
        },
        expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
      );
    });

    it('can add and remove stops', async () => {
      const user = userEvent.setup();
      mockRoutes.mockReturnValue(loadedState([]));

      renderWithProviders(<ProviderRoutesPage />);

      await user.click(screen.getByRole('button', { name: /Create route/ }));

      // Start with 2 stops
      const stopsList = screen.getByRole('list', { name: 'Route stops' });
      expect(within(stopsList).getAllByPlaceholderText('Stop name')).toHaveLength(2);

      // Add a stop
      await user.click(screen.getByRole('button', { name: 'Add stop' }));
      expect(within(stopsList).getAllByPlaceholderText('Stop name')).toHaveLength(3);

      // Remove a stop
      const removeButtons = within(stopsList).getAllByRole('button', { name: /Remove stop/ });
      await user.click(removeButtons[0]);
      expect(within(stopsList).getAllByPlaceholderText('Stop name')).toHaveLength(2);
    });

    it('can reorder stops with arrow buttons', async () => {
      const user = userEvent.setup();
      mockRoutes.mockReturnValue(loadedState([]));

      renderWithProviders(<ProviderRoutesPage />);

      await user.click(screen.getByRole('button', { name: /Create route/ }));

      const stopNames = screen.getAllByPlaceholderText('Stop name');
      await user.type(stopNames[0], 'First');
      await user.type(stopNames[1], 'Second');

      // Move first stop down
      await user.click(screen.getByRole('button', { name: /Move stop First down/ }));

      // After reorder, "Second" should be first
      const reorderedNames = screen.getAllByPlaceholderText('Stop name');
      expect(reorderedNames[0]).toHaveValue('Second');
      expect(reorderedNames[1]).toHaveValue('First');
    });
  });

  describe('delete route', () => {
    it('opens confirmation dialog when delete button is clicked', async () => {
      const user = userEvent.setup();
      const routes = [createMockRoute('route_1', 'Test Route')];
      mockRoutes.mockReturnValue(loadedState(routes));

      renderWithProviders(<ProviderRoutesPage />);

      await user.click(screen.getByRole('button', { name: 'Delete route Test Route' }));

      expect(screen.getByText('Delete route')).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to delete/)).toBeInTheDocument();
    });

    it('calls delete mutation on confirm', async () => {
      const user = userEvent.setup();
      const mutateFn = vi.fn();
      const routes = [createMockRoute('route_1', 'Test Route')];
      mockRoutes.mockReturnValue(loadedState(routes));
      mockDeleteRoute.mockReturnValue({ mutate: mutateFn, isPending: false });

      renderWithProviders(<ProviderRoutesPage />);

      await user.click(screen.getByRole('button', { name: 'Delete route Test Route' }));
      await user.click(screen.getByRole('button', { name: 'Delete' }));

      expect(mutateFn).toHaveBeenCalledWith('route_1');
    });

    it('can cancel delete via cancel button', async () => {
      const user = userEvent.setup();
      const mutateFn = vi.fn();
      const routes = [createMockRoute('route_1', 'Test Route')];
      mockRoutes.mockReturnValue(loadedState(routes));
      mockDeleteRoute.mockReturnValue({ mutate: mutateFn, isPending: false });

      renderWithProviders(<ProviderRoutesPage />);

      await user.click(screen.getByRole('button', { name: 'Delete route Test Route' }));
      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(mutateFn).not.toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('has proper heading hierarchy', () => {
      mockRoutes.mockReturnValue(loadedState([]));

      renderWithProviders(<ProviderRoutesPage />);

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Routes');
      expect(screen.getByRole('heading', { level: 2, name: 'Routes' })).toBeInTheDocument();
    });

    it('uses landmark section with aria-labelledby', () => {
      mockRoutes.mockReturnValue(loadedState([]));

      renderWithProviders(<ProviderRoutesPage />);

      expect(screen.getByLabelText('Routes')).toBeInTheDocument();
    });

    it('icons have aria-hidden attribute', () => {
      const routes = [createMockRoute('route_1', 'Test Route')];
      mockRoutes.mockReturnValue(loadedState(routes));

      const { container } = renderWithProviders(<ProviderRoutesPage />);

      const svgs = container.querySelectorAll('svg');
      svgs.forEach((svg) => {
        expect(svg).toHaveAttribute('aria-hidden', 'true');
      });
    });

    it('delete buttons have descriptive aria labels', () => {
      const routes = [
        createMockRoute('route_1', 'Route Alpha'),
        createMockRoute('route_2', 'Route Beta'),
      ];
      mockRoutes.mockReturnValue(loadedState(routes));

      renderWithProviders(<ProviderRoutesPage />);

      expect(screen.getByRole('button', { name: 'Delete route Route Alpha' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete route Route Beta' })).toBeInTheDocument();
    });
  });

  describe('responsive layout', () => {
    it('route grid uses responsive classes', () => {
      const routes = [createMockRoute('route_1', 'Test Route')];
      mockRoutes.mockReturnValue(loadedState(routes));

      renderWithProviders(<ProviderRoutesPage />);

      const grid = screen.getByLabelText('Routes list');
      expect(grid).toHaveClass('sm:grid-cols-2', 'lg:grid-cols-3');
    });
  });

  describe('data fetching', () => {
    it('fetches routes with pageSize 50', () => {
      mockRoutes.mockReturnValue(loadedState([]));

      renderWithProviders(<ProviderRoutesPage />);

      expect(mockRoutes).toHaveBeenCalledWith({ page: 1, pageSize: 50 });
    });
  });
});
