import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '@/i18n/config';
import { renderWithProviders } from '@/test/helpers';
import { ErrorFallback } from './error-fallback';

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

describe('ErrorFallback', () => {
  it('renders default error message', () => {
    renderWithProviders(<ErrorFallback />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Error');
    expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument();
  });

  it('renders custom error message', () => {
    renderWithProviders(<ErrorFallback message="Custom failure" />);
    expect(screen.getByText('Custom failure')).toBeInTheDocument();
  });

  it('renders retry button when onRetry is provided', () => {
    const onRetry = vi.fn();
    renderWithProviders(<ErrorFallback onRetry={onRetry} />);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('does not render retry button when onRetry is omitted', () => {
    renderWithProviders(<ErrorFallback />);
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });

  it('calls onRetry when retry button is clicked', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    renderWithProviders(<ErrorFallback onRetry={onRetry} />);

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('has accessible alert role', () => {
    renderWithProviders(<ErrorFallback />);
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
  });

  it('hides icon from assistive technology', () => {
    const { container } = renderWithProviders(<ErrorFallback />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders Romanian translations when language is ro', async () => {
    await i18n.changeLanguage('ro');
    renderWithProviders(<ErrorFallback onRetry={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Eroare');
    expect(
      screen.getByText('Ceva nu a mers bine. Te rugăm să încerci din nou.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reîncearcă' })).toBeInTheDocument();
  });
});
