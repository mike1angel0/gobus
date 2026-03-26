import { screen } from '@testing-library/react';
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

describe('HomePage', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  describe('rendering', () => {
    it('renders the hero heading', () => {
      renderWithProviders(<HomePage />);

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveTextContent('Travel smarter with Transio');
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

      expect(screen.getByLabelText('Origin')).toHaveAttribute('id', 'origin');
      expect(screen.getByLabelText('Destination')).toHaveAttribute('id', 'destination');
      expect(screen.getByLabelText('Travel date')).toHaveAttribute('id', 'travel-date');
    });

    it('enforces maxLength on origin and destination inputs', () => {
      renderWithProviders(<HomePage />);

      expect(screen.getByLabelText('Origin')).toHaveAttribute('maxLength', '200');
      expect(screen.getByLabelText('Destination')).toHaveAttribute('maxLength', '200');
    });
  });

  describe('search form submission', () => {
    it('navigates to /search with all params when all fields filled', async () => {
      const user = userEvent.setup();
      renderWithProviders(<HomePage />);

      await user.type(screen.getByLabelText('Origin'), 'Bucharest');
      await user.type(screen.getByLabelText('Destination'), 'Cluj');
      await user.type(screen.getByLabelText('Travel date'), '2026-04-01');
      await user.click(screen.getByRole('button', { name: /search/i }));

      expect(mockNavigate).toHaveBeenCalledWith(
        '/search?origin=Bucharest&destination=Cluj&date=2026-04-01',
      );
    });

    it('navigates to /search with partial params when some fields empty', async () => {
      const user = userEvent.setup();
      renderWithProviders(<HomePage />);

      await user.type(screen.getByLabelText('Origin'), 'Bucharest');
      await user.click(screen.getByRole('button', { name: /search/i }));

      expect(mockNavigate).toHaveBeenCalledWith('/search?origin=Bucharest');
    });

    it('navigates to /search with empty params when no fields filled', async () => {
      const user = userEvent.setup();
      renderWithProviders(<HomePage />);

      await user.click(screen.getByRole('button', { name: /search/i }));

      expect(mockNavigate).toHaveBeenCalledWith('/search?');
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
