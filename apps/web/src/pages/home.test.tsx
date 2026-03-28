import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import HomePage from './home';
import { renderWithProviders } from '@/test/helpers';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/hooks/use-search', () => ({
  useCities: () => ({ data: { data: ['Berlin', 'Budapest', 'Prague', 'Vienna'] }, isLoading: false }),
}));

describe('HomePage', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  describe('rendering', () => {
    it('renders the hero heading', () => {
      renderWithProviders(<HomePage />);

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveTextContent('Travel smarter with GoBus');
    });

    it('renders the hero description', () => {
      renderWithProviders(<HomePage />);

      expect(screen.getByText(/Find and book bus trips across the country/)).toBeInTheDocument();
    });

    it('renders the search form with all fields', () => {
      renderWithProviders(<HomePage />);

      expect(screen.getByLabelText('Origin')).toBeInTheDocument();
      expect(screen.getByLabelText('Destination')).toBeInTheDocument();
      expect(screen.getByLabelText('Travel date')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
    });

    it('renders three feature cards', () => {
      renderWithProviders(<HomePage />);

      expect(screen.getByRole('heading', { name: 'Real-time tracking' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Secure booking' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Wide coverage' })).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has a search landmark with label', () => {
      renderWithProviders(<HomePage />);

      expect(screen.getByRole('search', { name: 'Search trips' })).toBeInTheDocument();
    });

    it('has a features section with accessible heading', () => {
      renderWithProviders(<HomePage />);

      expect(screen.getByRole('heading', { name: 'Features' })).toBeInTheDocument();
    });

    it('has labels for all form inputs', () => {
      renderWithProviders(<HomePage />);

      expect(screen.getByLabelText('Origin')).toHaveAttribute('id', 'search-origin');
      expect(screen.getByLabelText('Destination')).toHaveAttribute('id', 'search-destination');
      expect(screen.getByLabelText('Travel date')).toHaveAttribute('id', 'search-date');
    });

    it('uses sr-only labels in compact mode on home page', () => {
      const { container } = renderWithProviders(<HomePage />);

      const form = container.querySelector('form');
      const labels = form?.querySelectorAll('label');
      labels?.forEach((label) => {
        expect(label).toHaveClass('sr-only');
      });
    });
  });

  describe('search form submission', () => {
    it('navigates to /search with all params when all fields filled', async () => {
      const user = userEvent.setup();
      renderWithProviders(<HomePage />);

      await user.selectOptions(screen.getByLabelText('Origin'), 'Berlin');
      await user.selectOptions(screen.getByLabelText('Destination'), 'Prague');

      await user.click(screen.getByRole('button', { name: /search/i }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledTimes(1);
      });

      const navigatedUrl = mockNavigate.mock.calls[0][0] as string;
      expect(navigatedUrl).toContain('origin=Berlin');
      expect(navigatedUrl).toContain('destination=Prague');
      expect(navigatedUrl).toContain('date=');
    });

    it('shows validation error when submitting without required fields', async () => {
      const user = userEvent.setup();
      renderWithProviders(<HomePage />);

      await user.click(screen.getByRole('button', { name: /search/i }));

      await waitFor(() => {
        expect(screen.getByText('Origin is required')).toBeInTheDocument();
      });
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe('responsive design', () => {
    it('uses responsive grid classes on the search form', () => {
      renderWithProviders(<HomePage />);

      const form = screen.getByRole('search', { name: 'Search trips' });
      const grid = form.querySelector('.grid');
      expect(grid).toHaveClass('sm:grid-cols-2', 'lg:grid-cols-4');
    });

    it('uses responsive grid classes on feature cards section', () => {
      renderWithProviders(<HomePage />);

      const featuresHeading = screen.getByRole('heading', { name: 'Features' });
      const section = featuresHeading.closest('section');
      const grid = section?.querySelector('.grid');
      expect(grid).toHaveClass('sm:grid-cols-2', 'lg:grid-cols-3');
    });
  });
});
