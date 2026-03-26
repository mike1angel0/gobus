import { render, screen } from '@testing-library/react';
import PlaceholderPage from './placeholder';

describe('PlaceholderPage', () => {
  it('renders coming soon heading', () => {
    render(<PlaceholderPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Coming Soon' })).toBeInTheDocument();
  });

  it('renders under construction message', () => {
    render(<PlaceholderPage />);
    expect(screen.getByText('This page is under construction.')).toBeInTheDocument();
  });

  it('uses semantic heading for accessibility', () => {
    render(<PlaceholderPage />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Coming Soon');
  });
});
