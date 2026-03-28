import { describe, it, expect, beforeEach } from 'vitest';
import i18n, { i18nNamespaces, supportedLanguages } from './config';

describe('i18n config', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ro');
  });

  it('initializes with Romanian as default language', () => {
    expect(i18n.language).toBe('ro');
  });

  it('has all 10 namespaces loaded', () => {
    expect(i18nNamespaces).toHaveLength(10);
    for (const ns of i18nNamespaces) {
      expect(i18n.hasResourceBundle('ro', ns)).toBe(true);
      expect(i18n.hasResourceBundle('en', ns)).toBe(true);
    }
  });

  it('supports Romanian and English languages', () => {
    expect(supportedLanguages).toEqual(['ro', 'en']);
  });

  it('falls back to Romanian for unsupported languages', async () => {
    await i18n.changeLanguage('fr');
    // i18next resolves to the fallbackLng when supportedLngs excludes the requested language
    expect(i18n.language).toBe('ro');
    expect(i18n.t('buttons.save', { ns: 'common' })).toBe('Salvează');
  });

  it('switches to English and resolves translations', async () => {
    await i18n.changeLanguage('en');
    expect(i18n.language).toBe('en');
    expect(i18n.t('buttons.save', { ns: 'common' })).toBe('Save');
  });

  it('resolves translations from non-default namespaces', () => {
    expect(i18n.t('links.home', { ns: 'nav' })).toBe('Acasă');
    expect(i18n.t('login.title', { ns: 'auth' })).toBe('Autentificare');
  });

  it('uses localStorage key i18n_lang for detection', () => {
    const detectionOptions = i18n.options.detection;
    expect(detectionOptions?.lookupLocalStorage).toBe('i18n_lang');
  });
});
