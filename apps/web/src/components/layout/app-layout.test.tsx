import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import i18n from '@/i18n/config';
import { AppLayout } from './app-layout';
import { renderWithProviders } from '@/test/helpers';
import { checkA11y } from '@/test/a11y';

vi.mock('./navbar', () => ({
  Navbar: () => (
    <header>
      <nav aria-label="Main navigation" data-testid="navbar">
        Navbar
      </nav>
    </header>
  ),
}));

vi.mock('@/components/ui/toaster', () => ({
  Toaster: () => <div data-testid="toaster">Toaster</div>,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    Outlet: () => <div data-testid="outlet">Page content</div>,
  };
});

describe('AppLayout', () => {
  beforeEach(() => {
    void i18n.changeLanguage('en');
  });

  it('renders Navbar, main content area, and Toaster', () => {
    renderWithProviders(<AppLayout />, { withAuth: true });

    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.getByTestId('outlet')).toBeInTheDocument();
    expect(screen.getByTestId('toaster')).toBeInTheDocument();
  });

  it('wraps page content in a main element', () => {
    renderWithProviders(<AppLayout />, { withAuth: true });

    const main = screen.getByRole('main');
    expect(main).toBeInTheDocument();
    expect(main).toContainElement(screen.getByTestId('outlet'));
  });

  it('uses a flex column layout for full-height pages', () => {
    const { container } = renderWithProviders(<AppLayout />, { withAuth: true });

    const wrapper = container.firstElementChild;
    expect(wrapper).toHaveClass('flex', 'min-h-screen', 'flex-col');
  });

  it('renders skip-to-content link as first child', () => {
    renderWithProviders(<AppLayout />, { withAuth: true });

    const skipLink = screen.getByText('Skip to content');
    expect(skipLink).toBeInTheDocument();
    expect(skipLink).toHaveAttribute('href', '#main-content');
    expect(skipLink.tagName).toBe('A');
  });

  it('skip-to-content link is visually hidden by default', () => {
    renderWithProviders(<AppLayout />, { withAuth: true });

    const skipLink = screen.getByText('Skip to content');
    expect(skipLink).toHaveClass('sr-only');
  });

  it('skip-to-content link becomes visible on focus', () => {
    renderWithProviders(<AppLayout />, { withAuth: true });

    const skipLink = screen.getByText('Skip to content');
    expect(skipLink).toHaveClass('focus:not-sr-only');
  });

  it('main element has id for skip link target', () => {
    renderWithProviders(<AppLayout />, { withAuth: true });

    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'main-content');
  });

  it('skip link is the first focusable element', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppLayout />, { withAuth: true });

    await user.tab();
    const skipLink = screen.getByText('Skip to content');
    expect(skipLink).toHaveFocus();
  });

  it('passes axe-core accessibility audit', async () => {
    const { container } = renderWithProviders(<AppLayout />, { withAuth: true });
    await checkA11y(container);
  });
});
