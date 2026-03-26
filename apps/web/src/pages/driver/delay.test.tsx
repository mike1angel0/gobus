import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DriverDelayPage from './delay';
import { renderWithProviders } from '@/test/helpers';

/* ---------- Mocks ---------- */

const mockMutate = vi.fn();
const mockCreateDelay = vi.fn().mockReturnValue({
  mutate: mockMutate,
  isPending: false,
});

vi.mock('@/hooks/use-delays', () => ({
  useCreateDelay: () => mockCreateDelay(),
}));

const mockNavigate = vi.fn();
let mockSearchParams = new URLSearchParams('scheduleId=sched-1&date=2026-04-01');

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [mockSearchParams],
  };
});

/* ---------- Setup ---------- */

beforeEach(() => {
  vi.clearAllMocks();
  mockSearchParams = new URLSearchParams('scheduleId=sched-1&date=2026-04-01');
  mockCreateDelay.mockReturnValue({ mutate: mockMutate, isPending: false });
});

/* ---------- Tests ---------- */

describe('DriverDelayPage', () => {
  describe('missing params', () => {
    it('shows missing params message when scheduleId is absent', () => {
      mockSearchParams = new URLSearchParams('date=2026-04-01');
      renderWithProviders(<DriverDelayPage />);

      expect(screen.getByText('Missing schedule or date information.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /back to trips/i })).toBeInTheDocument();
    });

    it('shows missing params message when date is absent', () => {
      mockSearchParams = new URLSearchParams('scheduleId=sched-1');
      renderWithProviders(<DriverDelayPage />);

      expect(screen.getByText('Missing schedule or date information.')).toBeInTheDocument();
    });

    it('navigates to /driver on back to trips click', async () => {
      mockSearchParams = new URLSearchParams('');
      renderWithProviders(<DriverDelayPage />);
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: /back to trips/i }));
      expect(mockNavigate).toHaveBeenCalledWith('/driver');
    });
  });

  describe('form rendering', () => {
    it('renders the page heading and card title', () => {
      renderWithProviders(<DriverDelayPage />);

      // sr-only h1 + card title both say "Report Delay"
      const elements = screen.getAllByText('Report Delay');
      expect(elements.length).toBeGreaterThanOrEqual(2);
    });

    it('renders preset minute buttons', () => {
      renderWithProviders(<DriverDelayPage />);

      const group = screen.getByRole('group', { name: /preset delay options/i });
      for (const m of [5, 10, 15, 20, 30, 45, 60]) {
        expect(within(group).getByRole('button', { name: `${m}m` })).toBeInTheDocument();
      }
    });

    it('renders custom minutes input', () => {
      renderWithProviders(<DriverDelayPage />);

      expect(screen.getByLabelText('Delay (minutes)')).toBeInTheDocument();
    });

    it('renders reason dropdown with all options', () => {
      renderWithProviders(<DriverDelayPage />);

      const select = screen.getByLabelText('Reason');
      expect(select).toBeInTheDocument();
      expect(within(select).getByText('Traffic')).toBeInTheDocument();
      expect(within(select).getByText('Mechanical')).toBeInTheDocument();
      expect(within(select).getByText('Weather')).toBeInTheDocument();
      expect(within(select).getByText('Other')).toBeInTheDocument();
    });

    it('renders notes textarea with character count', () => {
      renderWithProviders(<DriverDelayPage />);

      expect(screen.getByLabelText('Notes (optional)')).toBeInTheDocument();
      expect(screen.getByText('0/500 characters')).toBeInTheDocument();
    });

    it('renders submit and cancel buttons', () => {
      renderWithProviders(<DriverDelayPage />);

      expect(screen.getByRole('button', { name: /report delay/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });
  });

  describe('preset buttons', () => {
    it('selects a preset and fills the minutes input', async () => {
      renderWithProviders(<DriverDelayPage />);
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: '15m' }));

      const input = screen.getByLabelText('Delay (minutes)') as HTMLInputElement;
      expect(input.value).toBe('15');
      expect(screen.getByRole('button', { name: '15m' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: '5m' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('custom input overrides preset selection', async () => {
      renderWithProviders(<DriverDelayPage />);
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: '15m' }));
      const input = screen.getByLabelText('Delay (minutes)');
      await user.clear(input);
      await user.type(input, '25');

      expect((input as HTMLInputElement).value).toBe('25');
      // No preset should show as pressed for value 25
      expect(screen.getByRole('button', { name: '15m' })).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('character count', () => {
    it('updates character count as user types', async () => {
      renderWithProviders(<DriverDelayPage />);
      const user = userEvent.setup();

      const textarea = screen.getByLabelText('Notes (optional)');
      await user.type(textarea, 'Road construction');

      expect(screen.getByText('17/500 characters')).toBeInTheDocument();
    });
  });

  describe('validation', () => {
    it('shows error when submitting without minutes', async () => {
      renderWithProviders(<DriverDelayPage />);
      const user = userEvent.setup();

      // Select a reason but no minutes
      await user.selectOptions(screen.getByLabelText('Reason'), 'TRAFFIC');
      await user.click(screen.getByRole('button', { name: /report delay/i }));

      expect(screen.getByText('Required')).toBeInTheDocument();
      expect(mockMutate).not.toHaveBeenCalled();
    });

    it('shows error for minutes below minimum', async () => {
      renderWithProviders(<DriverDelayPage />);
      const user = userEvent.setup();

      const input = screen.getByLabelText('Delay (minutes)');
      await user.type(input, '0');
      await user.selectOptions(screen.getByLabelText('Reason'), 'TRAFFIC');
      await user.click(screen.getByRole('button', { name: /report delay/i }));

      expect(screen.getByText('Must be at least 1 minute')).toBeInTheDocument();
      expect(mockMutate).not.toHaveBeenCalled();
    });

    it('shows error when submitting without reason', async () => {
      renderWithProviders(<DriverDelayPage />);
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: '10m' }));
      await user.click(screen.getByRole('button', { name: /report delay/i }));

      expect(screen.getByText('Reason is required')).toBeInTheDocument();
      expect(mockMutate).not.toHaveBeenCalled();
    });
  });

  describe('submission', () => {
    it('submits valid form data and navigates on success', async () => {
      mockMutate.mockImplementation((_data: unknown, opts: { onSuccess: () => void }) => {
        opts.onSuccess();
      });
      renderWithProviders(<DriverDelayPage />);
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: '15m' }));
      await user.selectOptions(screen.getByLabelText('Reason'), 'TRAFFIC');
      await user.type(screen.getByLabelText('Notes (optional)'), 'Heavy traffic on highway');
      await user.click(screen.getByRole('button', { name: /report delay/i }));

      expect(mockMutate).toHaveBeenCalledWith(
        {
          scheduleId: 'sched-1',
          offsetMinutes: 15,
          reason: 'TRAFFIC',
          note: 'Heavy traffic on highway',
          tripDate: '2026-04-01',
        },
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      );

      expect(mockNavigate).toHaveBeenCalledWith('/driver/trip/sched-1?date=2026-04-01');
    });

    it('submits without note when note is empty', async () => {
      mockMutate.mockImplementation((_data: unknown, opts: { onSuccess: () => void }) => {
        opts.onSuccess();
      });
      renderWithProviders(<DriverDelayPage />);
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: '5m' }));
      await user.selectOptions(screen.getByLabelText('Reason'), 'WEATHER');
      await user.click(screen.getByRole('button', { name: /report delay/i }));

      expect(mockMutate).toHaveBeenCalledWith(
        {
          scheduleId: 'sched-1',
          offsetMinutes: 5,
          reason: 'WEATHER',
          tripDate: '2026-04-01',
        },
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      );
    });

    it('disables submit button when mutation is pending', () => {
      mockCreateDelay.mockReturnValue({ mutate: mockMutate, isPending: true });
      renderWithProviders(<DriverDelayPage />);

      const submitBtn = screen.getByRole('button', { name: /reporting\.\.\./i });
      expect(submitBtn).toBeDisabled();
    });
  });

  describe('navigation', () => {
    it('back to trip button navigates to trip detail', async () => {
      renderWithProviders(<DriverDelayPage />);
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: /back to trip/i }));
      expect(mockNavigate).toHaveBeenCalledWith('/driver/trip/sched-1?date=2026-04-01');
    });

    it('cancel button navigates to trip detail', async () => {
      renderWithProviders(<DriverDelayPage />);
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: /cancel/i }));
      expect(mockNavigate).toHaveBeenCalledWith('/driver/trip/sched-1?date=2026-04-01');
    });
  });

  describe('accessibility', () => {
    it('has sr-only page heading', () => {
      renderWithProviders(<DriverDelayPage />);

      const heading = screen.getByRole('heading', { level: 1, name: 'Report Delay' });
      expect(heading).toHaveClass('sr-only');
    });

    it('has a labelled section landmark', () => {
      renderWithProviders(<DriverDelayPage />);

      expect(screen.getByRole('region', { name: 'Report Delay' })).toBeInTheDocument();
    });

    it('preset buttons have aria-pressed attribute', () => {
      renderWithProviders(<DriverDelayPage />);

      const buttons = screen.getAllByRole('button', { name: /\dm$/ });
      for (const btn of buttons) {
        expect(btn).toHaveAttribute('aria-pressed', 'false');
      }
    });

    it('form fields have proper labels', () => {
      renderWithProviders(<DriverDelayPage />);

      expect(screen.getByLabelText('Delay (minutes)')).toBeInTheDocument();
      expect(screen.getByLabelText('Reason')).toBeInTheDocument();
      expect(screen.getByLabelText('Notes (optional)')).toBeInTheDocument();
    });

    it('error messages are linked via aria-describedby', async () => {
      renderWithProviders(<DriverDelayPage />);
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: /report delay/i }));

      const minutesInput = screen.getByLabelText('Delay (minutes)');
      expect(minutesInput).toHaveAttribute('aria-describedby', 'delay-minutes-error');
    });
  });
});
