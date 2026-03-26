import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import type { ReactNode } from 'react';

import { EditBusDialog } from '@/components/fleet/edit-bus-dialog';

/* ---------- Mocks ---------- */

const mockBusDetail = vi.fn();
const mockUpdateBusMutate = vi.fn();

vi.mock('@/hooks/use-buses', () => ({
  useBusDetail: (...args: unknown[]) => mockBusDetail(...args),
  useUpdateBus: () => ({ mutate: mockUpdateBusMutate, isPending: false }),
}));

const mockToast = vi.fn();

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/components/fleet/seat-map-editor', () => ({
  SeatMapEditor: ({
    onSave,
    onCancel,
  }: {
    onSave: (seats: unknown[]) => void;
    onCancel: () => void;
  }) => (
    <div data-testid="seat-map-editor">
      <button onClick={() => onSave([])}>Save seats</button>
      <button onClick={onCancel}>Cancel editor</button>
    </div>
  ),
}));

/* ---------- Helpers ---------- */

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </I18nextProvider>
    );
  };
}

const mockBusData = {
  data: {
    id: 'bus_1',
    licensePlate: 'AB-123',
    model: 'Mercedes',
    capacity: 50,
    rows: 13,
    columns: 4,
    providerId: 'prov_1',
    seats: [
      { id: 'seat_1', row: 0, column: 0, label: '1A', type: 'STANDARD', price: 0, isEnabled: true },
    ],
    createdAt: '2026-01-01T00:00:00Z',
  },
};

/* ---------- Tests ---------- */

describe('EditBusDialog', () => {
  beforeEach(() => {
    i18n.changeLanguage('en');
    vi.clearAllMocks();
  });

  it('shows loading skeleton while bus data is loading', () => {
    mockBusDetail.mockReturnValue({ data: undefined, isLoading: true, isError: false });

    render(<EditBusDialog busId="bus_1" onClose={vi.fn()} />, { wrapper: createWrapper() });

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText('Loading seat map')).toBeInTheDocument();
  });

  it('shows error message when bus query fails', () => {
    mockBusDetail.mockReturnValue({ data: undefined, isLoading: false, isError: true });

    render(<EditBusDialog busId="bus_1" onClose={vi.fn()} />, { wrapper: createWrapper() });

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/Failed to load bus details/)).toBeInTheDocument();
  });

  it('shows seat map editor when bus data loads', () => {
    mockBusDetail.mockReturnValue({ data: mockBusData, isLoading: false, isError: false });

    render(<EditBusDialog busId="bus_1" onClose={vi.fn()} />, { wrapper: createWrapper() });

    expect(screen.getByTestId('seat-map-editor')).toBeInTheDocument();
  });

  it('calls onClose and shows toast when save is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockBusDetail.mockReturnValue({ data: mockBusData, isLoading: false, isError: false });

    render(<EditBusDialog busId="bus_1" onClose={onClose} />, { wrapper: createWrapper() });

    await user.click(screen.getByRole('button', { name: 'Save seats' }));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Seat layout saved locally' }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when dialog is closed', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockBusDetail.mockReturnValue({ data: mockBusData, isLoading: false, isError: false });

    render(<EditBusDialog busId="bus_1" onClose={onClose} />, { wrapper: createWrapper() });

    // Cancel from editor
    await user.click(screen.getByRole('button', { name: 'Cancel editor' }));

    expect(onClose).toHaveBeenCalled();
  });

  it('does not show seat map when bus has no seats', () => {
    mockBusDetail.mockReturnValue({
      data: { data: { ...mockBusData.data, seats: undefined } },
      isLoading: false,
      isError: false,
    });

    render(<EditBusDialog busId="bus_1" onClose={vi.fn()} />, { wrapper: createWrapper() });

    expect(screen.queryByTestId('seat-map-editor')).not.toBeInTheDocument();
  });
});
