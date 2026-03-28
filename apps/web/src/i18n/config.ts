/**
 * i18next configuration for GoBus.
 *
 * - Supports Romanian (ro, default) and English (en).
 * - Translations are split per domain namespace and lazy-loaded.
 * - Language is detected from localStorage (`i18n_lang`), then browser, then falls back to `ro`.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Eagerly import all translation JSON files so Vite bundles them.
// Lazy-loading via i18next-http-backend would require a separate server;
// instead we use dynamic imports resolved at build time.
import roCommon from './locales/ro/common.json';
import roNav from './locales/ro/nav.json';
import roAuth from './locales/ro/auth.json';
import roSearch from './locales/ro/search.json';
import roBooking from './locales/ro/booking.json';
import roProvider from './locales/ro/provider.json';
import roDriver from './locales/ro/driver.json';
import roAdmin from './locales/ro/admin.json';
import roTracking from './locales/ro/tracking.json';

import enCommon from './locales/en/common.json';
import enNav from './locales/en/nav.json';
import enAuth from './locales/en/auth.json';
import enSearch from './locales/en/search.json';
import enBooking from './locales/en/booking.json';
import enProvider from './locales/en/provider.json';
import enDriver from './locales/en/driver.json';
import enAdmin from './locales/en/admin.json';
import enTracking from './locales/en/tracking.json';

/** All supported namespaces. */
export const i18nNamespaces = [
  'common',
  'nav',
  'auth',
  'search',
  'booking',
  'provider',
  'driver',
  'admin',
  'tracking',
] as const;

/** Supported language codes. */
export const supportedLanguages = ['ro', 'en'] as const;

/** Union type of all translation namespace names. */
export type I18nNamespace = (typeof i18nNamespaces)[number];

/** Union type of supported language codes ('ro' | 'en'). */
export type SupportedLanguage = (typeof supportedLanguages)[number];

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ro: {
        common: roCommon,
        nav: roNav,
        auth: roAuth,
        search: roSearch,
        booking: roBooking,
        provider: roProvider,
        driver: roDriver,
        admin: roAdmin,
        tracking: roTracking,
      },
      en: {
        common: enCommon,
        nav: enNav,
        auth: enAuth,
        search: enSearch,
        booking: enBooking,
        provider: enProvider,
        driver: enDriver,
        admin: enAdmin,
        tracking: enTracking,
      },
    },
    fallbackLng: 'ro',
    supportedLngs: ['ro', 'en'],
    defaultNS: 'common',
    ns: [...i18nNamespaces],
    interpolation: {
      escapeValue: false, // React already escapes
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'i18n_lang',
      caches: ['localStorage'],
    },
  });

/** The initialized i18next instance. Import to access `t()` or pass to `I18nextProvider`. */
export default i18n;
