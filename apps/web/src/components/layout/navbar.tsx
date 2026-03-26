import { useState, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getLinksForRole, PUBLIC_NAV_LINKS } from './navbar-links';
import { MobileMenu } from './navbar-mobile';

/**
 * Application navbar with responsive design and role-based navigation.
 *
 * - Desktop: horizontal nav bar with logo, links, user info, and sign out.
 * - Mobile: hamburger button that opens a slide-in menu.
 * - Shows Login/Register links when unauthenticated.
 * - Shows role-appropriate navigation links when authenticated.
 */
export function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
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
        <Link to="/" className="text-lg font-bold text-foreground" aria-label="Transio home">
          Transio
        </Link>

        {/* Desktop nav */}
        <nav aria-label="Main navigation" className="hidden md:flex md:items-center md:gap-1">
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
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop right section */}
        <div className="hidden md:flex md:items-center md:gap-2">
          {isAuthenticated && user ? (
            <>
              <span className="text-sm text-muted-foreground">{user.name}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/auth/login">Log in</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/auth/register">Register</Link>
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
          aria-label="Open menu"
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
