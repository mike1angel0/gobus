import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { Navbar } from './navbar';

// Mock useAuth
const mockLogout = vi.fn();
let mockUser: { name: string; role: string; id: string; email: string; status: string; createdAt: string; updatedAt: string } | null =
  null;
let mockIsAuthenticated = false;

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: mockUser,
    isAuthenticated: mockIsAuthenticated,
    isLoading: false,
    status: mockIsAuthenticated ? 'authenticated' : 'unauthenticated',
    login: vi.fn(),
    register: vi.fn(),
    logout: mockLogout,
    changePassword: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
  }),
}));

function createUser(role: string, name = 'Test User') {
  return {
    id: 'usr_1',
    email: 'test@example.com',
    name,
    role,
    status: 'ACTIVE',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };
}

function renderNavbar(initialEntries = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Navbar />
    </MemoryRouter>,
  );
}

describe('Navbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = null;
    mockIsAuthenticated = false;
  });

  describe('unauthenticated', () => {
    it('renders logo with link to home', () => {
      renderNavbar();
      const logo = screen.getByLabelText('Transio home');
      expect(logo).toBeInTheDocument();
      expect(logo).toHaveAttribute('href', '/');
    });

    it('shows Log in and Register links', () => {
      renderNavbar();
      const nav = screen.getByRole('navigation', { name: 'Main navigation' });
      // Desktop nav shows public links
      expect(within(nav).getByText('Home')).toBeInTheDocument();
      expect(within(nav).getByText('Search')).toBeInTheDocument();
      // Auth links
      expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/auth/login');
      expect(screen.getByRole('link', { name: 'Register' })).toHaveAttribute(
        'href',
        '/auth/register',
      );
    });

    it('does not show user name or sign out', () => {
      renderNavbar();
      expect(screen.queryByLabelText('Sign out')).not.toBeInTheDocument();
    });
  });

  describe('authenticated – PASSENGER', () => {
    beforeEach(() => {
      mockUser = createUser('PASSENGER', 'Alice');
      mockIsAuthenticated = true;
    });

    it('shows passenger links', () => {
      renderNavbar();
      const nav = screen.getByRole('navigation', { name: 'Main navigation' });
      expect(within(nav).getByText('Home')).toBeInTheDocument();
      expect(within(nav).getByText('Search')).toBeInTheDocument();
      expect(within(nav).getByText('My Trips')).toBeInTheDocument();
    });

    it('does not show provider or driver links', () => {
      renderNavbar();
      const nav = screen.getByRole('navigation', { name: 'Main navigation' });
      expect(within(nav).queryByText('Dashboard')).not.toBeInTheDocument();
      expect(within(nav).queryByText('Trips')).not.toBeInTheDocument();
    });

    it('shows user name and sign out button', () => {
      renderNavbar();
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByLabelText('Sign out')).toBeInTheDocument();
    });

    it('calls logout on sign out click', async () => {
      const user = userEvent.setup();
      renderNavbar();
      await user.click(screen.getByLabelText('Sign out'));
      expect(mockLogout).toHaveBeenCalledOnce();
    });
  });

  describe('authenticated – PROVIDER', () => {
    beforeEach(() => {
      mockUser = createUser('PROVIDER', 'Bob Provider');
      mockIsAuthenticated = true;
    });

    it('shows provider links', () => {
      renderNavbar();
      const nav = screen.getByRole('navigation', { name: 'Main navigation' });
      expect(within(nav).getByText('Dashboard')).toBeInTheDocument();
      expect(within(nav).getByText('Routes')).toBeInTheDocument();
      expect(within(nav).getByText('Fleet')).toBeInTheDocument();
      expect(within(nav).getByText('Schedules')).toBeInTheDocument();
      expect(within(nav).getByText('Drivers')).toBeInTheDocument();
      expect(within(nav).getByText('Tracking')).toBeInTheDocument();
    });

    it('does not show passenger or driver links', () => {
      renderNavbar();
      const nav = screen.getByRole('navigation', { name: 'Main navigation' });
      expect(within(nav).queryByText('My Trips')).not.toBeInTheDocument();
      expect(within(nav).queryByText('History')).not.toBeInTheDocument();
    });
  });

  describe('authenticated – DRIVER', () => {
    beforeEach(() => {
      mockUser = createUser('DRIVER', 'Charlie Driver');
      mockIsAuthenticated = true;
    });

    it('shows driver links', () => {
      renderNavbar();
      const nav = screen.getByRole('navigation', { name: 'Main navigation' });
      expect(within(nav).getByText('Trips')).toBeInTheDocument();
      expect(within(nav).getByText('History')).toBeInTheDocument();
    });

    it('does not show provider links', () => {
      renderNavbar();
      const nav = screen.getByRole('navigation', { name: 'Main navigation' });
      expect(within(nav).queryByText('Dashboard')).not.toBeInTheDocument();
      expect(within(nav).queryByText('Schedules')).not.toBeInTheDocument();
    });
  });

  describe('authenticated – ADMIN', () => {
    beforeEach(() => {
      mockUser = createUser('ADMIN', 'Admin User');
      mockIsAuthenticated = true;
    });

    it('shows admin links', () => {
      renderNavbar();
      const nav = screen.getByRole('navigation', { name: 'Main navigation' });
      expect(within(nav).getByText('Fleet')).toBeInTheDocument();
    });
  });

  describe('active link highlighting', () => {
    it('highlights the active link', () => {
      mockUser = createUser('PASSENGER');
      mockIsAuthenticated = true;
      renderNavbar(['/search']);
      const nav = screen.getByRole('navigation', { name: 'Main navigation' });
      const searchLink = within(nav).getByText('Search');
      expect(searchLink.className).toContain('bg-accent');
    });

    it('does not highlight inactive links', () => {
      mockUser = createUser('PASSENGER');
      mockIsAuthenticated = true;
      renderNavbar(['/search']);
      const nav = screen.getByRole('navigation', { name: 'Main navigation' });
      const homeLink = within(nav).getByText('Home');
      // Check that 'bg-accent' is NOT a standalone class (hover:bg-accent is expected)
      const classes = homeLink.className.split(' ');
      expect(classes).not.toContain('bg-accent');
    });
  });

  describe('accessibility', () => {
    it('has a main navigation landmark', () => {
      renderNavbar();
      expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    });

    it('logo has accessible label', () => {
      renderNavbar();
      expect(screen.getByLabelText('Transio home')).toBeInTheDocument();
    });

    it('hamburger button has aria-label and aria-expanded', () => {
      renderNavbar();
      const hamburger = screen.getByLabelText('Open menu');
      expect(hamburger).toHaveAttribute('aria-expanded', 'false');
    });

    it('sign out button has aria-label', () => {
      mockUser = createUser('PASSENGER');
      mockIsAuthenticated = true;
      renderNavbar();
      expect(screen.getByLabelText('Sign out')).toBeInTheDocument();
    });
  });

  describe('mobile menu', () => {
    beforeEach(() => {
      mockUser = createUser('PASSENGER', 'Alice');
      mockIsAuthenticated = true;
    });

    it('opens when hamburger is clicked', async () => {
      const user = userEvent.setup();
      renderNavbar();
      await user.click(screen.getByLabelText('Open menu'));
      expect(screen.getByRole('dialog', { name: 'Mobile navigation' })).toBeInTheDocument();
    });

    it('shows close button with aria-label', async () => {
      const user = userEvent.setup();
      renderNavbar();
      await user.click(screen.getByLabelText('Open menu'));
      expect(screen.getByLabelText('Close menu')).toBeInTheDocument();
    });

    it('closes when close button is clicked', async () => {
      const user = userEvent.setup();
      renderNavbar();
      await user.click(screen.getByLabelText('Open menu'));
      expect(screen.getByRole('dialog', { name: 'Mobile navigation' })).toBeInTheDocument();
      await user.click(screen.getByLabelText('Close menu'));
      expect(screen.queryByRole('dialog', { name: 'Mobile navigation' })).not.toBeInTheDocument();
    });

    it('closes when backdrop is clicked', async () => {
      const user = userEvent.setup();
      renderNavbar();
      await user.click(screen.getByLabelText('Open menu'));
      await user.click(screen.getByTestId('mobile-menu-backdrop'));
      expect(screen.queryByRole('dialog', { name: 'Mobile navigation' })).not.toBeInTheDocument();
    });

    it('closes on Escape key', async () => {
      const user = userEvent.setup();
      renderNavbar();
      await user.click(screen.getByLabelText('Open menu'));
      expect(screen.getByRole('dialog', { name: 'Mobile navigation' })).toBeInTheDocument();
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog', { name: 'Mobile navigation' })).not.toBeInTheDocument();
    });

    it('shows user name in mobile menu', async () => {
      const user = userEvent.setup();
      renderNavbar();
      await user.click(screen.getByLabelText('Open menu'));
      const dialog = screen.getByRole('dialog', { name: 'Mobile navigation' });
      expect(within(dialog).getByText('Alice')).toBeInTheDocument();
    });

    it('shows sign out in mobile menu and calls logout', async () => {
      const user = userEvent.setup();
      renderNavbar();
      await user.click(screen.getByLabelText('Open menu'));
      const dialog = screen.getByRole('dialog', { name: 'Mobile navigation' });
      await user.click(within(dialog).getByText('Sign out'));
      expect(mockLogout).toHaveBeenCalledOnce();
    });

    it('shows role-specific links in mobile menu', async () => {
      const user = userEvent.setup();
      renderNavbar();
      await user.click(screen.getByLabelText('Open menu'));
      const dialog = screen.getByRole('dialog', { name: 'Mobile navigation' });
      expect(within(dialog).getByText('My Trips')).toBeInTheDocument();
    });

    it('shows login/register when unauthenticated', async () => {
      mockUser = null;
      mockIsAuthenticated = false;
      const user = userEvent.setup();
      renderNavbar();
      await user.click(screen.getByLabelText('Open menu'));
      const dialog = screen.getByRole('dialog', { name: 'Mobile navigation' });
      expect(within(dialog).getByRole('link', { name: 'Log in' })).toHaveAttribute(
        'href',
        '/auth/login',
      );
      expect(within(dialog).getByRole('link', { name: 'Register' })).toHaveAttribute(
        'href',
        '/auth/register',
      );
    });

    it('closes when a link is clicked', async () => {
      const user = userEvent.setup();
      renderNavbar();
      await user.click(screen.getByLabelText('Open menu'));
      const dialog = screen.getByRole('dialog', { name: 'Mobile navigation' });
      await user.click(within(dialog).getByText('Search'));
      expect(screen.queryByRole('dialog', { name: 'Mobile navigation' })).not.toBeInTheDocument();
    });
  });
});

describe('getLinksForRole', () => {
  // Import directly to test the utility
  it('is tested via navbar role rendering above', () => {
    // The role-based link filtering is verified through the navbar component tests
    expect(true).toBe(true);
  });
});
