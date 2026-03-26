import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/helpers';
import { PageError } from './error-state';

describe('PageError', () => {
  it('renders translated default title and message', () => {
    renderWithProviders(<PageError onRetry={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Something went wrong');
    expect(screen.getByText('An unexpected error occurred')).toBeInTheDocument();
  });

  it('renders custom title and message', () => {
    renderWithProviders(
      <PageError
        title="Failed to load fleet"
        message="We couldn't load your buses."
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Failed to load fleet');
    expect(screen.getByText("We couldn't load your buses.")).toBeInTheDocument();
  });

  it('renders translated retry button', () => {
    renderWithProviders(<PageError onRetry={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('calls onRetry when retry button is clicked', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    renderWithProviders(<PageError onRetry={onRetry} />);

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('has accessible alert role', () => {
    renderWithProviders(<PageError onRetry={vi.fn()} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('hides icon from assistive technology', () => {
    const { container } = renderWithProviders(<PageError onRetry={vi.fn()} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });
});
