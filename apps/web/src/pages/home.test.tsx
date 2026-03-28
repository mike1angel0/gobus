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
      expect(heading).toHaveTextContent(/GoBus/);
    });

    it('renders the search form with all fields', () => {
      renderWithProviders(<HomePage />);

      expect(screen.getByRole('search')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /caută|search/i })).toBeInTheDocument();
    });

    it('renders three feature cards', () => {
      renderWithProviders(<HomePage />);

      const headings = screen.getAllByRole('heading', { level: 3 });
      expect(headings).toHaveLength(3);
    });
  });

  describe('accessibility', () => {
    it('has a search landmark', () => {
      renderWithProviders(<HomePage />);

      expect(screen.getByRole('search')).toBeInTheDocument();
    });

    it('has a features section with accessible heading', () => {
      renderWithProviders(<HomePage />);

      const headings = screen.getAllByRole('heading', { level: 2 });
      expect(headings.length).toBeGreaterThanOrEqual(1);
    });

    it('has labels for all form inputs', () => {
      renderWithProviders(<HomePage />);

      expect(document.getElementById('search-origin')).toBeInTheDocument();
      expect(document.getElementById('search-destination')).toBeInTheDocument();
      expect(document.getElementById('search-date')).toBeInTheDocument();
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

      await user.selectOptions(document.getElementById('search-origin')!, 'Berlin');
      await user.selectOptions(document.getElementById('search-destination')!, 'Prague');

      await user.click(screen.getByRole('button', { name: /caută|search/i }));

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

      await user.click(screen.getByRole('button', { name: /caută|search/i }));

      await waitFor(() => {
        const alerts = screen.getAllByRole('alert');
        expect(alerts.length).toBeGreaterThanOrEqual(1);
      });
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe('responsive design', () => {
    it('uses responsive grid classes on the search form', () => {
      renderWithProviders(<HomePage />);

      const form = screen.getByRole('search');
      const grid = form.querySelector('.grid');
      expect(grid).toHaveClass('sm:grid-cols-2', 'lg:grid-cols-4');
    });

    it('uses responsive grid classes on feature cards section', () => {
      const { container } = renderWithProviders(<HomePage />);

      const sections = container.querySelectorAll('section');
      const featuresSection = sections[1];
      const grid = featuresSection?.querySelector('.grid');
      expect(grid).toHaveClass('sm:grid-cols-2', 'lg:grid-cols-3');
    });
  });
});
