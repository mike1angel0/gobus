import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ProviderFleetPage from './fleet';
import { renderWithProviders } from '@/test/helpers';

/* ---------- Mocks ---------- */

const mockBuses = vi.fn();
const mockBusTemplates = vi.fn();
const mockCreateBus = vi.fn();
const mockDeleteBus = vi.fn();

vi.mock('@/hooks/use-buses', () => ({
  useBuses: (...args: unknown[]) => mockBuses(...args),
  useBusTemplates: () => mockBusTemplates(),
  useCreateBus: () => mockCreateBus(),
  useDeleteBus: () => mockDeleteBus(),
}));

/* ---------- Helpers ---------- */

/** Returns a loaded state for the useBuses hook. */
function loadedState(buses: unknown[] = []) {
  return {
    data: { data: buses, meta: { total: buses.length, page: 1, pageSize: 50, totalPages: 1 } },
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

/** Returns a loaded templates state. */
function templatesLoaded(templates: unknown[] = []) {
  return {
    data: { data: templates },
    isLoading: false,
    isError: false,
  };
}

/** Returns a loading templates state. */
function templatesLoading() {
  return {
    data: undefined,
    isLoading: true,
    isError: false,
  };
}

/** Creates a mock bus. */
function createMockBus(id: string, licensePlate: string, model: string) {
  return {
    id,
    licensePlate,
    model,
    capacity: 48,
    rows: 12,
    columns: 4,
    providerId: 'prov_1',
    createdAt: '2026-03-20T10:00:00Z',
  };
}

/** Creates a mock bus template. */
function createMockTemplate(id: string, name: string) {
  return {
    id,
    name,
    rows: 12,
    columns: 4,
    capacity: 48,
    seats: Array.from({ length: 48 }, (_, i) => ({
      row: Math.floor(i / 4) + 1,
      column: (i % 4) + 1,
      label: `${Math.floor(i / 4) + 1}${String.fromCharCode(65 + (i % 4))}`,
      type: 'STANDARD' as const,
      price: 0,
    })),
  };
}

/** Returns a default mutation result (idle). */
function idleMutation() {
  return { mutate: vi.fn(), isPending: false };
}

/* ---------- Tests ---------- */

describe('ProviderFleetPage', () => {
  beforeEach(() => {
    mockBuses.mockReset();
    mockBusTemplates.mockReset();
    mockCreateBus.mockReset();
    mockDeleteBus.mockReset();
    mockCreateBus.mockReturnValue(idleMutation());
    mockDeleteBus.mockReturnValue(idleMutation());
    mockBusTemplates.mockReturnValue(templatesLoaded([]));
  });

  describe('loading state', () => {
    it('renders skeleton loaders while loading', () => {
      mockBuses.mockReturnValue(loadingState());

      renderWithProviders(<ProviderFleetPage />);

      expect(screen.getByLabelText('Loading fleet')).toHaveAttribute('aria-busy', 'true');
    });
  });

  describe('loaded state', () => {
    it('renders bus cards with license plates and models', () => {
      const buses = [
        createMockBus('bus_1', 'AB-123-CD', 'Mercedes Tourismo'),
        createMockBus('bus_2', 'EF-456-GH', 'Volvo 9700'),
      ];
      mockBuses.mockReturnValue(loadedState(buses));

      renderWithProviders(<ProviderFleetPage />);

      expect(screen.getByText('AB-123-CD')).toBeInTheDocument();
      expect(screen.getByText('EF-456-GH')).toBeInTheDocument();
      expect(screen.getByText('Mercedes Tourismo')).toBeInTheDocument();
      expect(screen.getByText('Volvo 9700')).toBeInTheDocument();
    });

    it('renders bus capacity and dimensions', () => {
      const buses = [createMockBus('bus_1', 'AB-123-CD', 'Mercedes')];
      mockBuses.mockReturnValue(loadedState(buses));

      renderWithProviders(<ProviderFleetPage />);

      expect(screen.getByText('48 seats · 12×4')).toBeInTheDocument();
    });

    it('renders empty state when no buses exist', () => {
      mockBuses.mockReturnValue(loadedState([]));

      renderWithProviders(<ProviderFleetPage />);

      expect(screen.getByText('No buses yet')).toBeInTheDocument();
      expect(
        screen.getByText('Add your first bus to start creating schedules.'),
      ).toBeInTheDocument();
    });

    it('renders add bus button', () => {
      mockBuses.mockReturnValue(loadedState([]));

      renderWithProviders(<ProviderFleetPage />);

      expect(screen.getByRole('button', { name: /Add bus/ })).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('renders error state when query fails', () => {
      mockBuses.mockReturnValue(errorState());

      renderWithProviders(<ProviderFleetPage />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Failed to load fleet')).toBeInTheDocument();
    });

    it('calls refetch on retry button click', async () => {
      const user = userEvent.setup();
      const refetch = vi.fn();
      mockBuses.mockReturnValue({ ...errorState(), refetch });

      renderWithProviders(<ProviderFleetPage />);

      await user.click(screen.getByRole('button', { name: 'Try again' }));
      expect(refetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('create bus dialog', () => {
    it('opens create dialog when button is clicked', async () => {
      const user = userEvent.setup();
      mockBuses.mockReturnValue(loadedState([]));

      renderWithProviders(<ProviderFleetPage />);

      await user.click(screen.getByRole('button', { name: /Add bus/ }));

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Add bus', { selector: '[class*="font-semibold"]' })).toBeInTheDocument();
    });

    it('has license plate and model inputs', async () => {
      const user = userEvent.setup();
      mockBuses.mockReturnValue(loadedState([]));

      renderWithProviders(<ProviderFleetPage />);

      await user.click(screen.getByRole('button', { name: /Add bus/ }));

      expect(screen.getByLabelText('License plate')).toBeInTheDocument();
      expect(screen.getByLabelText('Model')).toBeInTheDocument();
    });

    it('shows template and manual mode toggle', async () => {
      const user = userEvent.setup();
      mockBuses.mockReturnValue(loadedState([]));

      renderWithProviders(<ProviderFleetPage />);

      await user.click(screen.getByRole('button', { name: /Add bus/ }));

      expect(screen.getByRole('radio', { name: /Template/ })).toHaveAttribute('aria-checked', 'true');
      expect(screen.getByRole('radio', { name: /Manual/ })).toHaveAttribute('aria-checked', 'false');
    });

    it('shows template cards when templates are loaded', async () => {
      const user = userEvent.setup();
      mockBuses.mockReturnValue(loadedState([]));
      mockBusTemplates.mockReturnValue(
        templatesLoaded([
          createMockTemplate('tpl_1', 'Standard 48-seat'),
          createMockTemplate('tpl_2', 'Premium 36-seat'),
        ]),
      );

      renderWithProviders(<ProviderFleetPage />);

      await user.click(screen.getByRole('button', { name: /Add bus/ }));

      expect(screen.getByText('Standard 48-seat')).toBeInTheDocument();
      expect(screen.getByText('Premium 36-seat')).toBeInTheDocument();
    });

    it('shows loading skeleton for templates', async () => {
      const user = userEvent.setup();
      mockBuses.mockReturnValue(loadedState([]));
      mockBusTemplates.mockReturnValue(templatesLoading());

      renderWithProviders(<ProviderFleetPage />);

      await user.click(screen.getByRole('button', { name: /Add bus/ }));

      expect(screen.getByLabelText('Loading templates')).toHaveAttribute('aria-busy', 'true');
    });

    it('selects a template when clicked', async () => {
      const user = userEvent.setup();
      mockBuses.mockReturnValue(loadedState([]));
      mockBusTemplates.mockReturnValue(
        templatesLoaded([createMockTemplate('tpl_1', 'Standard 48-seat')]),
      );

      renderWithProviders(<ProviderFleetPage />);

      await user.click(screen.getByRole('button', { name: /Add bus/ }));

      const templateBtn = screen.getByRole('button', { name: /Standard 48-seat/ });
      await user.click(templateBtn);

      expect(templateBtn).toHaveAttribute('aria-pressed', 'true');
    });

    it('switches to manual mode and shows rows/columns inputs', async () => {
      const user = userEvent.setup();
      mockBuses.mockReturnValue(loadedState([]));

      renderWithProviders(<ProviderFleetPage />);

      await user.click(screen.getByRole('button', { name: /Add bus/ }));
      await user.click(screen.getByRole('radio', { name: /Manual/ }));

      expect(screen.getByLabelText('Rows')).toBeInTheDocument();
      expect(screen.getByLabelText('Columns')).toBeInTheDocument();
    });

    it('validates empty license plate', async () => {
      const user = userEvent.setup();
      mockBuses.mockReturnValue(loadedState([]));

      renderWithProviders(<ProviderFleetPage />);

      await user.click(screen.getByRole('button', { name: /Add bus/ }));

      // Switch to manual mode so we can fill rows/columns
      await user.click(screen.getByRole('radio', { name: /Manual/ }));
      await user.type(screen.getByLabelText('Model'), 'Mercedes');
      await user.type(screen.getByLabelText('Rows'), '12');
      await user.type(screen.getByLabelText('Columns'), '4');

      // Find the submit button inside the dialog
      const dialog = screen.getByRole('dialog');
      await user.click(within(dialog).getByRole('button', { name: 'Add bus' }));

      expect(screen.getByText('License plate is required.')).toBeInTheDocument();
    });

    it('validates empty model', async () => {
      const user = userEvent.setup();
      mockBuses.mockReturnValue(loadedState([]));

      renderWithProviders(<ProviderFleetPage />);

      await user.click(screen.getByRole('button', { name: /Add bus/ }));
      await user.click(screen.getByRole('radio', { name: /Manual/ }));

      await user.type(screen.getByLabelText('License plate'), 'AB-123');
      await user.type(screen.getByLabelText('Rows'), '12');
      await user.type(screen.getByLabelText('Columns'), '4');

      const dialog = screen.getByRole('dialog');
      await user.click(within(dialog).getByRole('button', { name: 'Add bus' }));

      expect(screen.getByText('Model is required.')).toBeInTheDocument();
    });

    it('validates manual mode rows and columns', async () => {
      const user = userEvent.setup();
      mockBuses.mockReturnValue(loadedState([]));

      renderWithProviders(<ProviderFleetPage />);

      await user.click(screen.getByRole('button', { name: /Add bus/ }));
      await user.click(screen.getByRole('radio', { name: /Manual/ }));

      await user.type(screen.getByLabelText('License plate'), 'AB-123');
      await user.type(screen.getByLabelText('Model'), 'Mercedes');
      // Leave rows and columns empty

      const dialog = screen.getByRole('dialog');
      await user.click(within(dialog).getByRole('button', { name: 'Add bus' }));

      expect(screen.getByText(/Rows must be between/)).toBeInTheDocument();
      expect(screen.getByText(/Columns must be between/)).toBeInTheDocument();
    });

    it('validates template mode requires template selection', async () => {
      const user = userEvent.setup();
      mockBuses.mockReturnValue(loadedState([]));
      mockBusTemplates.mockReturnValue(
        templatesLoaded([createMockTemplate('tpl_1', 'Standard 48-seat')]),
      );

      renderWithProviders(<ProviderFleetPage />);

      await user.click(screen.getByRole('button', { name: /Add bus/ }));

      await user.type(screen.getByLabelText('License plate'), 'AB-123');
      await user.type(screen.getByLabelText('Model'), 'Mercedes');
      // Don't select a template

      const dialog = screen.getByRole('dialog');
      await user.click(within(dialog).getByRole('button', { name: 'Add bus' }));

      expect(screen.getByText('Please select a template.')).toBeInTheDocument();
    });

    it('submits form with template data', async () => {
      const user = userEvent.setup();
      const mutateFn = vi.fn();
      mockBuses.mockReturnValue(loadedState([]));
      mockCreateBus.mockReturnValue({ mutate: mutateFn, isPending: false });
      const template = createMockTemplate('tpl_1', 'Standard 48-seat');
      mockBusTemplates.mockReturnValue(templatesLoaded([template]));

      renderWithProviders(<ProviderFleetPage />);

      await user.click(screen.getByRole('button', { name: /Add bus/ }));

      await user.type(screen.getByLabelText('License plate'), 'AB-123-CD');
      await user.type(screen.getByLabelText('Model'), 'Mercedes Tourismo');

      // Select template
      await user.click(screen.getByRole('button', { name: /Standard 48-seat/ }));

      const dialog = screen.getByRole('dialog');
      await user.click(within(dialog).getByRole('button', { name: 'Add bus' }));

      expect(mutateFn).toHaveBeenCalledTimes(1);
      expect(mutateFn).toHaveBeenCalledWith(
        expect.objectContaining({
          licensePlate: 'AB-123-CD',
          model: 'Mercedes Tourismo',
          capacity: 48,
          rows: 12,
          columns: 4,
          seats: expect.arrayContaining([
            expect.objectContaining({ row: 1, column: 1, label: '1A', type: 'STANDARD' }),
          ]),
        }),
        expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
      );
    });

    it('submits form with manual config', async () => {
      const user = userEvent.setup();
      const mutateFn = vi.fn();
      mockBuses.mockReturnValue(loadedState([]));
      mockCreateBus.mockReturnValue({ mutate: mutateFn, isPending: false });

      renderWithProviders(<ProviderFleetPage />);

      await user.click(screen.getByRole('button', { name: /Add bus/ }));
      await user.click(screen.getByRole('radio', { name: /Manual/ }));

      await user.type(screen.getByLabelText('License plate'), 'XY-789');
      await user.type(screen.getByLabelText('Model'), 'Volvo 9700');
      await user.type(screen.getByLabelText('Rows'), '3');
      await user.type(screen.getByLabelText('Columns'), '2');

      const dialog = screen.getByRole('dialog');
      await user.click(within(dialog).getByRole('button', { name: 'Add bus' }));

      expect(mutateFn).toHaveBeenCalledTimes(1);
      expect(mutateFn).toHaveBeenCalledWith(
        expect.objectContaining({
          licensePlate: 'XY-789',
          model: 'Volvo 9700',
          capacity: 6,
          rows: 3,
          columns: 2,
        }),
        expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
      );
    });
  });

  describe('delete bus', () => {
    it('opens confirmation dialog when delete button is clicked', async () => {
      const user = userEvent.setup();
      const buses = [createMockBus('bus_1', 'AB-123-CD', 'Mercedes')];
      mockBuses.mockReturnValue(loadedState(buses));

      renderWithProviders(<ProviderFleetPage />);

      await user.click(screen.getByRole('button', { name: 'Delete bus AB-123-CD' }));

      expect(screen.getByText('Delete bus')).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to delete/)).toBeInTheDocument();
      expect(screen.getByText(/Schedules referencing this bus may be affected/)).toBeInTheDocument();
    });

    it('calls delete mutation on confirm', async () => {
      const user = userEvent.setup();
      const mutateFn = vi.fn();
      const buses = [createMockBus('bus_1', 'AB-123-CD', 'Mercedes')];
      mockBuses.mockReturnValue(loadedState(buses));
      mockDeleteBus.mockReturnValue({ mutate: mutateFn, isPending: false });

      renderWithProviders(<ProviderFleetPage />);

      await user.click(screen.getByRole('button', { name: 'Delete bus AB-123-CD' }));
      await user.click(screen.getByRole('button', { name: 'Delete' }));

      expect(mutateFn).toHaveBeenCalledWith('bus_1');
    });

    it('can cancel delete via cancel button', async () => {
      const user = userEvent.setup();
      const mutateFn = vi.fn();
      const buses = [createMockBus('bus_1', 'AB-123-CD', 'Mercedes')];
      mockBuses.mockReturnValue(loadedState(buses));
      mockDeleteBus.mockReturnValue({ mutate: mutateFn, isPending: false });

      renderWithProviders(<ProviderFleetPage />);

      await user.click(screen.getByRole('button', { name: 'Delete bus AB-123-CD' }));
      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(mutateFn).not.toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('has proper heading hierarchy', () => {
      mockBuses.mockReturnValue(loadedState([]));

      renderWithProviders(<ProviderFleetPage />);

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Fleet');
      expect(screen.getByRole('heading', { level: 2, name: 'Fleet' })).toBeInTheDocument();
    });

    it('uses landmark section with aria-labelledby', () => {
      mockBuses.mockReturnValue(loadedState([]));

      renderWithProviders(<ProviderFleetPage />);

      const section = screen.getByRole('region', { name: 'Fleet' });
      expect(section).toBeInTheDocument();
    });

    it('icons have aria-hidden attribute', () => {
      const buses = [createMockBus('bus_1', 'AB-123-CD', 'Mercedes')];
      mockBuses.mockReturnValue(loadedState(buses));

      const { container } = renderWithProviders(<ProviderFleetPage />);

      const svgs = container.querySelectorAll('svg');
      svgs.forEach((svg) => {
        expect(svg).toHaveAttribute('aria-hidden', 'true');
      });
    });

    it('delete buttons have descriptive aria labels', () => {
      const buses = [
        createMockBus('bus_1', 'AB-123-CD', 'Mercedes'),
        createMockBus('bus_2', 'EF-456-GH', 'Volvo'),
      ];
      mockBuses.mockReturnValue(loadedState(buses));

      renderWithProviders(<ProviderFleetPage />);

      expect(screen.getByRole('button', { name: 'Delete bus AB-123-CD' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete bus EF-456-GH' })).toBeInTheDocument();
    });
  });

  describe('responsive layout', () => {
    it('bus grid uses responsive classes', () => {
      const buses = [createMockBus('bus_1', 'AB-123-CD', 'Mercedes')];
      mockBuses.mockReturnValue(loadedState(buses));

      renderWithProviders(<ProviderFleetPage />);

      const grid = screen.getByLabelText('Fleet list');
      expect(grid).toHaveClass('sm:grid-cols-2', 'lg:grid-cols-3');
    });
  });

  describe('data fetching', () => {
    it('fetches buses with pageSize 50', () => {
      mockBuses.mockReturnValue(loadedState([]));

      renderWithProviders(<ProviderFleetPage />);

      expect(mockBuses).toHaveBeenCalledWith({ page: 1, pageSize: 50 });
    });
  });
});
