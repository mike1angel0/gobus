import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { Navbar } from './navbar';

// Mock useAuth
const mockLogout = vi.fn();
let mockUser: {
  name: string;
  role: string;
  id: string;
  email: string;
  status: string;
  createdAt: string;
  updatedAt: string;
} | null = null;
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
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={initialEntries}>
        <Navbar />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('Navbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = null;
    mockIsAuthenticated = false;
    void i18n.changeLanguage('en');
  });

  describe('unauthenticated', () => {
    it('renders logo with link to home', () => {
      renderNavbar();
      const logo = screen.getByLabelText('GoBus home');
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
      expect(screen.queryByLabelText('Log out')).not.toBeInTheDocument();
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

    it('shows universal profile link', () => {
      renderNavbar();
      const nav = screen.getByRole('navigation', { name: 'Main navigation' });
      expect(within(nav).getByText('Profile')).toBeInTheDocument();
      expect(within(nav).getByText('Profile').closest('a')).toHaveAttribute('href', '/profile');
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
      expect(screen.getByLabelText('Log out')).toBeInTheDocument();
    });

    it('calls logout on sign out click', async () => {
      const user = userEvent.setup();
      renderNavbar();
      await user.click(screen.getByLabelText('Log out'));
      expect(mockLogout).toHaveBeenCalledOnce();
    });
  });

  describe('authenticated – PROVIDER', () => {
    beforeEach(() => {
      mockUser = createUser('PROVIDER', 'Bob Provider');
      mockIsAuthenticated = true;
    });

    it('shows provider links including profile', () => {
      renderNavbar();
      const nav = screen.getByRole('navigation', { name: 'Main navigation' });
      expect(within(nav).getByText('Dashboard')).toBeInTheDocument();
      expect(within(nav).getByText('Routes')).toBeInTheDocument();
      expect(within(nav).getByText('Fleet')).toBeInTheDocument();
      expect(within(nav).getByText('Schedules')).toBeInTheDocument();
      expect(within(nav).getByText('Drivers')).toBeInTheDocument();
      expect(within(nav).getByText('Tracking')).toBeInTheDocument();
    });

    it('shows provider profile link with correct href', () => {
      renderNavbar();
      const nav = screen.getByRole('navigation', { name: 'Main navigation' });
      const profileLinks = within(nav).getAllByText('Profile');
      const providerProfileLink = profileLinks.find(
        (el) => el.closest('a')?.getAttribute('href') === '/provider/profile',
      );
      expect(providerProfileLink).toBeTruthy();
    });

    it('shows universal profile link', () => {
      renderNavbar();
      const nav = screen.getByRole('navigation', { name: 'Main navigation' });
      const profileLinks = within(nav).getAllByText('Profile');
      const universalProfileLink = profileLinks.find(
        (el) => el.closest('a')?.getAttribute('href') === '/profile',
      );
      expect(universalProfileLink).toBeTruthy();
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

    it('shows universal profile link', () => {
      renderNavbar();
      const nav = screen.getByRole('navigation', { name: 'Main navigation' });
      expect(within(nav).getByText('Profile')).toBeInTheDocument();
      expect(within(nav).getByText('Profile').closest('a')).toHaveAttribute('href', '/profile');
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

    it('shows all admin links', () => {
      renderNavbar();
      const nav = screen.getByRole('navigation', { name: 'Main navigation' });
      expect(within(nav).getByText('Dashboard')).toBeInTheDocument();
      expect(within(nav).getByText('Users')).toBeInTheDocument();
      expect(within(nav).getByText('Fleet')).toBeInTheDocument();
      expect(within(nav).getByText('Audit Logs')).toBeInTheDocument();
    });

    it('shows admin links with correct hrefs', () => {
      renderNavbar();
      const nav = screen.getByRole('navigation', { name: 'Main navigation' });
      expect(within(nav).getByText('Dashboard').closest('a')).toHaveAttribute('href', '/admin');
      expect(within(nav).getByText('Users').closest('a')).toHaveAttribute('href', '/admin/users');
      expect(within(nav).getByText('Fleet').closest('a')).toHaveAttribute('href', '/admin/fleet');
      expect(within(nav).getByText('Audit Logs').closest('a')).toHaveAttribute(
        'href',
        '/admin/audit-logs',
      );
    });

    it('shows universal profile link', () => {
      renderNavbar();
      const nav = screen.getByRole('navigation', { name: 'Main navigation' });
      expect(within(nav).getByText('Profile')).toBeInTheDocument();
      expect(within(nav).getByText('Profile').closest('a')).toHaveAttribute('href', '/profile');
    });

    it('does not show passenger or provider-specific links', () => {
      renderNavbar();
      const nav = screen.getByRole('navigation', { name: 'Main navigation' });
      expect(within(nav).queryByText('My Trips')).not.toBeInTheDocument();
      expect(within(nav).queryByText('Routes')).not.toBeInTheDocument();
      expect(within(nav).queryByText('Schedules')).not.toBeInTheDocument();
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
      expect(screen.getByLabelText('GoBus home')).toBeInTheDocument();
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
      expect(screen.getByLabelText('Log out')).toBeInTheDocument();
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

  describe('i18n', () => {
    it('renders navigation labels in Romanian when language is ro', () => {
      void i18n.changeLanguage('ro');
      mockUser = createUser('PASSENGER', 'Alice');
      mockIsAuthenticated = true;
      renderNavbar();
      const nav = screen.getByRole('navigation', { name: 'Navigare principală' });
      expect(within(nav).getByText('Acasă')).toBeInTheDocument();
      expect(within(nav).getByText('Caută')).toBeInTheDocument();
      expect(within(nav).getByText('Călătoriile mele')).toBeInTheDocument();
    });
  });
});

describe('getLinksForRole', () => {
  it('returns universal links (empty roles) for all roles', async () => {
    const { getLinksForRole } = await import('./navbar-links');
    const roles = ['PASSENGER', 'PROVIDER', 'DRIVER', 'ADMIN'] as const;
    for (const role of roles) {
      const links = getLinksForRole(role);
      const profileLink = links.find((l) => l.href === '/profile');
      expect(profileLink).toBeTruthy();
      expect(profileLink!.labelKey).toBe('links.profile');
    }
  });

  it('returns admin-specific links only for ADMIN', async () => {
    const { getLinksForRole } = await import('./navbar-links');
    const adminLinks = getLinksForRole('ADMIN');
    expect(adminLinks.some((l) => l.href === '/admin')).toBe(true);
    expect(adminLinks.some((l) => l.href === '/admin/users')).toBe(true);
    expect(adminLinks.some((l) => l.href === '/admin/audit-logs')).toBe(true);

    const passengerLinks = getLinksForRole('PASSENGER');
    expect(passengerLinks.some((l) => l.href === '/admin')).toBe(false);
    expect(passengerLinks.some((l) => l.href === '/admin/users')).toBe(false);
  });

  it('returns provider-specific links only for PROVIDER', async () => {
    const { getLinksForRole } = await import('./navbar-links');
    const providerLinks = getLinksForRole('PROVIDER');
    expect(providerLinks.some((l) => l.href === '/provider/profile')).toBe(true);
    expect(providerLinks.some((l) => l.href === '/provider')).toBe(true);

    const driverLinks = getLinksForRole('DRIVER');
    expect(driverLinks.some((l) => l.href === '/provider/profile')).toBe(false);
  });
});
