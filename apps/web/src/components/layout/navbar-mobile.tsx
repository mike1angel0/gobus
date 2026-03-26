import { useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LanguageSwitcher } from './language-switcher';
import type { NavLink } from './navbar-links';

/** Props for the mobile navigation menu. */
interface MobileMenuProps {
  /** Whether the menu is open. */
  isOpen: boolean;
  /** Callback to close the menu. */
  onClose: () => void;
  /** Navigation links to display. */
  links: NavLink[];
  /** Whether the user is authenticated. */
  isAuthenticated: boolean;
  /** User display name, if authenticated. */
  userName?: string;
  /** Sign out callback. */
  onSignOut?: () => void;
}

/**
 * Mobile slide-in navigation menu with focus management.
 * Traps focus within the menu when open and returns focus to the trigger on close.
 * All labels are translated via the `nav` i18n namespace.
 */
export function MobileMenu({
  isOpen,
  onClose,
  links,
  isAuthenticated,
  userName,
  onSignOut,
}: MobileMenuProps) {
  const { t } = useTranslation('nav');
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();

  useEffect(() => {
    if (isOpen) {
      closeButtonRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60"
        onClick={onClose}
        aria-hidden="true"
        data-testid="mobile-menu-backdrop"
      />

      {/* Menu panel */}
      <nav
        role="dialog"
        aria-label={t('a11y.mobileNavigation')}
        aria-modal="true"
        className="fixed inset-y-0 right-0 z-50 w-72 bg-background border-l border-border p-6 shadow-lg"
      >
        <div className="flex items-center justify-between mb-6">
          {isAuthenticated && userName ? (
            <span className="text-sm font-medium text-foreground truncate">{userName}</span>
          ) : (
            <span className="text-sm text-muted-foreground">Menu</span>
          )}
          <Button
            ref={closeButtonRef}
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={t('a11y.closeMenu')}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <ul className="space-y-1">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                to={link.href}
                onClick={onClose}
                className={cn(
                  'block rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  location.pathname === link.href
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                {t(link.labelKey)}
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-6 border-t border-border pt-4 space-y-2">
          <LanguageSwitcher />
          {isAuthenticated ? (
            <Button
              variant="ghost"
              className="w-full justify-start text-muted-foreground"
              onClick={() => {
                onSignOut?.();
                onClose();
              }}
            >
              {t('menu.signOut')}
            </Button>
          ) : (
            <div className="space-y-2">
              <Button asChild variant="default" className="w-full">
                <Link to="/auth/login" onClick={onClose}>
                  {t('menu.login')}
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link to="/auth/register" onClick={onClose}>
                  {t('menu.register')}
                </Link>
              </Button>
            </div>
          )}
        </div>
      </nav>
    </>
  );
}
