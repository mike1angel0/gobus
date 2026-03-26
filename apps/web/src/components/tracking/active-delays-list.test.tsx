import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import i18n from '@/i18n/config';
import { ActiveDelaysList } from './active-delays-list';
import { renderWithProviders } from '@/test/helpers';
import type { components } from '@/api/generated/types';

type Delay = components['schemas']['Delay'];

/* ---------- Mocks ---------- */

const mutateFn = vi.fn();
const mockUpdateDelay = vi.fn();

vi.mock('@/hooks/use-delays', () => ({
  useUpdateDelay: () => mockUpdateDelay(),
}));

/* ---------- Helpers ---------- */

function makeDelay(overrides: Partial<Delay> = {}): Delay {
  return {
    id: 'delay-1',
    scheduleId: 'sched-1',
    tripDate: '2026-04-01',
    offsetMinutes: 15,
    reason: 'TRAFFIC' as const,
    active: true,
    createdAt: '2026-04-01T08:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  i18n.changeLanguage('en');
  vi.clearAllMocks();
  mutateFn.mockReset();
  mockUpdateDelay.mockReturnValue({ mutate: mutateFn, isPending: false });
});

/* ---------- Tests ---------- */

describe('ActiveDelaysList', () => {
  it('renders loading skeleton', () => {
    renderWithProviders(<ActiveDelaysList delays={[]} isLoading={true} />);

    expect(screen.getByLabelText('Loading delays')).toBeInTheDocument();
    expect(screen.getByLabelText('Loading delays')).toHaveAttribute('aria-busy', 'true');
  });

  it('shows "No active delays" when all delays are inactive', () => {
    const delays = [makeDelay({ active: false })];
    renderWithProviders(<ActiveDelaysList delays={delays} isLoading={false} />);

    expect(screen.getByText('No active delays')).toBeInTheDocument();
  });

  it('shows "No active delays" when delays array is empty', () => {
    renderWithProviders(<ActiveDelaysList delays={[]} isLoading={false} />);

    expect(screen.getByText('No active delays')).toBeInTheDocument();
  });

  it('filters out inactive delays and shows only active ones', () => {
    const delays = [
      makeDelay({ id: 'd1', active: true, offsetMinutes: 10, reason: 'TRAFFIC' }),
      makeDelay({ id: 'd2', active: false, offsetMinutes: 20, reason: 'WEATHER' }),
      makeDelay({ id: 'd3', active: true, offsetMinutes: 30, reason: 'MECHANICAL' }),
    ];
    renderWithProviders(<ActiveDelaysList delays={delays} isLoading={false} />);

    expect(screen.getByText(/\+10 min/)).toBeInTheDocument();
    expect(screen.getByText(/\+30 min/)).toBeInTheDocument();
    expect(screen.queryByText(/\+20 min/)).not.toBeInTheDocument();
  });

  it('renders delay reason in title case', () => {
    const delays = [makeDelay({ reason: 'MECHANICAL' })];
    renderWithProviders(<ActiveDelaysList delays={delays} isLoading={false} />);

    expect(screen.getByText(/Mechanical/)).toBeInTheDocument();
  });

  it('renders delay note when present', () => {
    const delays = [makeDelay({ note: 'Heavy congestion on highway' })];
    renderWithProviders(<ActiveDelaysList delays={delays} isLoading={false} />);

    expect(screen.getByText('Heavy congestion on highway')).toBeInTheDocument();
  });

  it('does not render note when null', () => {
    const delays = [makeDelay({ note: null })];
    renderWithProviders(<ActiveDelaysList delays={delays} isLoading={false} />);

    const listItems = screen.getAllByRole('listitem');
    expect(listItems).toHaveLength(1);
    // No note paragraph
    expect(screen.queryByText('Heavy congestion')).not.toBeInTheDocument();
  });

  it('calls updateDelay.mutate with correct args on deactivate click', async () => {
    const delays = [makeDelay({ id: 'delay-42', offsetMinutes: 15 })];
    renderWithProviders(<ActiveDelaysList delays={delays} isLoading={false} />);

    await userEvent.click(screen.getByRole('button', { name: 'Deactivate delay of 15 minutes' }));

    expect(mutateFn).toHaveBeenCalledWith({ id: 'delay-42', body: { active: false } });
  });

  it('disables deactivate button when mutation is pending', () => {
    mockUpdateDelay.mockReturnValue({ mutate: mutateFn, isPending: true });
    const delays = [makeDelay()];
    renderWithProviders(<ActiveDelaysList delays={delays} isLoading={false} />);

    expect(screen.getByRole('button', { name: 'Deactivate delay of 15 minutes' })).toBeDisabled();
  });

  it('renders list with accessible role and label', () => {
    const delays = [makeDelay()];
    renderWithProviders(<ActiveDelaysList delays={delays} isLoading={false} />);

    expect(screen.getByRole('list', { name: 'Active delays' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('has aria-live region for real-time updates', () => {
    const delays = [makeDelay()];
    renderWithProviders(<ActiveDelaysList delays={delays} isLoading={false} />);

    const list = screen.getByRole('list', { name: 'Active delays' });
    expect(list).toHaveAttribute('aria-live', 'polite');
  });
});
