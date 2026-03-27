import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/helpers';
import { SearchForm } from './search-form';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const TEST_CITIES = ['Brașov', 'București', 'Cluj-Napoca'];

vi.mock('@/hooks/use-search', () => ({
  useCities: () => ({ data: { data: TEST_CITIES }, isLoading: false }),
}));

describe('SearchForm', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('renders city options from API in origin and destination dropdowns', () => {
    renderWithProviders(<SearchForm />);

    const originSelect = screen.getByLabelText('Origin');
    const destinationSelect = screen.getByLabelText('Destination');

    expect(originSelect).toBeInTheDocument();
    expect(destinationSelect).toBeInTheDocument();

    // 3 test cities + 1 placeholder option = 4 options each
    const originOptions = originSelect.querySelectorAll('option');
    const destinationOptions = destinationSelect.querySelectorAll('option');
    expect(originOptions).toHaveLength(4);
    expect(destinationOptions).toHaveLength(4);

    // Check cities from API are present in both dropdowns
    expect(screen.getAllByText('București')).toHaveLength(2);
    expect(screen.getAllByText('Cluj-Napoca')).toHaveLength(2);
    expect(screen.getAllByText('Brașov')).toHaveLength(2);
  });

  it('renders date input with today as default value', () => {
    renderWithProviders(<SearchForm />);

    const dateInput = screen.getByLabelText('Travel date');
    expect(dateInput).toBeInTheDocument();
    expect(dateInput).toHaveAttribute('type', 'date');
    // Has a min attribute set to today
    expect(dateInput).toHaveAttribute('min');
  });

  it('renders compact mode with glass-card styling and sr-only labels', () => {
    const { container } = renderWithProviders(<SearchForm mode="compact" />);

    const form = container.querySelector('form');
    expect(form).toHaveClass('glass-card');

    // Labels should be sr-only in compact mode
    const labels = container.querySelectorAll('label');
    labels.forEach((label) => {
      expect(label).toHaveClass('sr-only');
    });
  });

  it('renders full mode with visible labels and border styling', () => {
    const { container } = renderWithProviders(<SearchForm mode="full" />);

    const form = container.querySelector('form');
    expect(form).toHaveClass('border-border');
    expect(form).not.toHaveClass('glass-card');
  });

  it('has search role and aria-label for accessibility', () => {
    renderWithProviders(<SearchForm />);

    const form = screen.getByRole('search', { name: 'Search trips' });
    expect(form).toBeInTheDocument();
  });

  it('swaps origin and destination when swap button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SearchForm />);

    const originSelect = screen.getByLabelText('Origin') as HTMLSelectElement;
    const destinationSelect = screen.getByLabelText('Destination') as HTMLSelectElement;

    await user.selectOptions(originSelect, 'București');
    await user.selectOptions(destinationSelect, 'Cluj-Napoca');

    expect(originSelect).toHaveValue('București');
    expect(destinationSelect).toHaveValue('Cluj-Napoca');

    const swapButtons = screen.getAllByRole('button', { name: 'Swap origin and destination' });
    await user.click(swapButtons[0]);

    expect(originSelect).toHaveValue('Cluj-Napoca');
    expect(destinationSelect).toHaveValue('București');
  });

  it('navigates to /search with query params on valid submission', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SearchForm />);

    await user.selectOptions(screen.getByLabelText('Origin'), 'București');
    await user.selectOptions(screen.getByLabelText('Destination'), 'Cluj-Napoca');

    const submitButton = screen.getByRole('button', { name: /search/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledTimes(1);
    });

    const navigatedUrl = mockNavigate.mock.calls[0][0] as string;
    expect(navigatedUrl).toContain('/search?');
    expect(navigatedUrl).toContain('origin=');
    expect(navigatedUrl).toContain('destination=');
    expect(navigatedUrl).toContain('date=');
  });

  it('shows validation error when origin is empty', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SearchForm />);

    // Select destination but not origin
    await user.selectOptions(screen.getByLabelText('Destination'), 'Cluj-Napoca');

    const submitButton = screen.getByRole('button', { name: /search/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Origin is required')).toBeInTheDocument();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows validation error when origin equals destination', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SearchForm />);

    await user.selectOptions(screen.getByLabelText('Origin'), 'București');
    await user.selectOptions(screen.getByLabelText('Destination'), 'București');

    const submitButton = screen.getByRole('button', { name: /search/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Origin and destination must be different')).toBeInTheDocument();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('pre-fills form from URL search params', () => {
    renderWithProviders(<SearchForm />, {
      routerProps: {
        initialEntries: ['/search?origin=Bra%C8%99ov&destination=Cluj-Napoca&date=2026-05-01'],
      },
    });

    expect(screen.getByLabelText('Origin')).toHaveValue('Brașov');
    expect(screen.getByLabelText('Destination')).toHaveValue('Cluj-Napoca');
    expect(screen.getByLabelText('Travel date')).toHaveValue('2026-05-01');
  });

  it('renders swap button in full mode between origin and destination', () => {
    renderWithProviders(<SearchForm mode="full" />);

    const swapButtons = screen.getAllByRole('button', { name: 'Swap origin and destination' });
    expect(swapButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('applies custom className', () => {
    const { container } = renderWithProviders(<SearchForm className="my-custom-class" />);

    const form = container.querySelector('form');
    expect(form).toHaveClass('my-custom-class');
  });

  it('links error messages to fields via aria-describedby', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SearchForm />);

    const submitButton = screen.getByRole('button', { name: /search/i });
    await user.click(submitButton);

    await waitFor(() => {
      const originSelect = screen.getByLabelText('Origin');
      expect(originSelect).toHaveAttribute('aria-invalid', 'true');
      expect(originSelect).toHaveAttribute('aria-describedby', 'search-origin-error');
    });
  });

  it('all interactive elements are keyboard navigable', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SearchForm mode="full" />);

    // Tab through all interactive elements
    await user.tab();
    expect(screen.getByLabelText('Origin')).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('button', { name: 'Swap origin and destination' })).toHaveFocus();

    await user.tab();
    expect(screen.getByLabelText('Destination')).toHaveFocus();

    await user.tab();
    expect(screen.getByLabelText('Travel date')).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('button', { name: /search/i })).toHaveFocus();
  });
});
