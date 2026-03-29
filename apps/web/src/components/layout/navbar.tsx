import { useState, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getLinksForRole, PUBLIC_NAV_LINKS } from './navbar-links';
import { LanguageSwitcher } from './language-switcher';
import { MobileMenu } from './navbar-mobile';

/**
 * Application navbar with responsive design and role-based navigation.
 *
 * - Desktop: horizontal nav bar with logo, links, user info, and sign out.
 * - Mobile: hamburger button that opens a slide-in menu.
 * - Shows Login/Register links when unauthenticated.
 * - Shows role-appropriate navigation links when authenticated.
 * - All labels are translated via the `nav` i18n namespace.
 */
export function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const { t } = useTranslation('nav');
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = isAuthenticated && user ? getLinksForRole(user.role) : PUBLIC_NAV_LINKS;

  const handleSignOut = useCallback(() => {
    void logout();
  }, [logout]);

  const toggleMobile = useCallback(() => {
    setMobileOpen((prev) => !prev);
  }, []);

  const closeMobile = useCallback(() => {
    setMobileOpen(false);
  }, []);

  return (
    <header className="sticky top-0 z-30 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 text-lg font-bold text-foreground" aria-label="GoBus home">
          <svg width="28" height="28" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <rect width="48" height="48" rx="12" fill="#10B981"/>
            <rect x="11" y="7" width="26" height="25" rx="5" ry="5" fill="#fff"/>
            <rect x="14" y="11" width="20" height="10" rx="3" ry="3" fill="#059669"/>
            <circle cx="17" cy="36" r="3" fill="#fff"/>
            <circle cx="31" cy="36" r="3" fill="#fff"/>
          </svg>
          <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700 }}>
            Go<span className="text-accent">Bus</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav
          aria-label={t('a11y.mainNavigation')}
          className="hidden md:flex md:items-center md:gap-1"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className={cn(
                'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                location.pathname === link.href
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              {t(link.labelKey)}
            </Link>
          ))}
        </nav>

        {/* Desktop right section */}
        <div className="hidden md:flex md:items-center md:gap-2">
          <LanguageSwitcher />
          {isAuthenticated && user ? (
            <>
              <span className="text-sm text-muted-foreground">{user.name}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                aria-label={t('menu.logout')}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/auth/login">{t('menu.login')}</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/auth/register">{t('menu.register')}</Link>
              </Button>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={toggleMobile}
          aria-label={t('a11y.openMenu')}
          aria-expanded={mobileOpen}
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      {/* Mobile menu */}
      <MobileMenu
        isOpen={mobileOpen}
        onClose={closeMobile}
        links={links}
        isAuthenticated={isAuthenticated}
        userName={user?.name}
        onSignOut={handleSignOut}
      />
    </header>
  );
}
