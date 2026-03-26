import { screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AppLayout } from './app-layout';
import { renderWithProviders } from '@/test/helpers';

vi.mock('./navbar', () => ({
  Navbar: () => <nav data-testid="navbar">Navbar</nav>,
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
});
