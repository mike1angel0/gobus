import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import { NotFound } from './not-found';

describe('NotFound', () => {
  it('renders 404 heading', () => {
    renderWithProviders(<NotFound />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Page not found');
  });

  it('renders descriptive message', () => {
    renderWithProviders(<NotFound />);
    expect(
      screen.getByText('The page you are looking for does not exist or has been moved.'),
    ).toBeInTheDocument();
  });

  it('renders a link to home page', () => {
    renderWithProviders(<NotFound />);
    const link = screen.getByRole('link', { name: 'Go home' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/');
  });

  it('has accessible alert role', () => {
    renderWithProviders(<NotFound />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('hides icon from assistive technology', () => {
    const { container } = renderWithProviders(<NotFound />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });
});
