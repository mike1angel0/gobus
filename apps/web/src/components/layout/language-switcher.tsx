import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import type { SupportedLanguage } from '@/i18n/config';

/** Language display metadata for each supported locale. */
const LANGUAGE_OPTIONS: Record<SupportedLanguage, { flag: string; label: string }> = {
  ro: { flag: '\u{1F1F7}\u{1F1F4}', label: 'RO' },
  en: { flag: '\u{1F1EC}\u{1F1E7}', label: 'EN' },
};

/** Next language to switch to when toggling. */
const NEXT_LANGUAGE: Record<SupportedLanguage, SupportedLanguage> = {
  ro: 'en',
  en: 'ro',
};

/**
 * Language toggle button that switches between Romanian and English.
 *
 * Displays the current language with its flag emoji. Clicking toggles to
 * the other language. The choice is persisted to localStorage automatically
 * by i18next's language detector.
 */
export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const currentLang = (i18n.language as SupportedLanguage) || 'ro';
  const current = LANGUAGE_OPTIONS[currentLang] ?? LANGUAGE_OPTIONS.ro;
  const nextLang = NEXT_LANGUAGE[currentLang] ?? 'en';
  const next = LANGUAGE_OPTIONS[nextLang];

  const handleToggle = useCallback(() => {
    void i18n.changeLanguage(nextLang);
  }, [i18n, nextLang]);

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleToggle}
      aria-label={`Switch language to ${next.label}`}
      data-testid="language-switcher"
    >
      <span aria-hidden="true">{current.flag}</span>
      <span className="ml-1 text-xs font-medium">{current.label}</span>
    </Button>
  );
}
