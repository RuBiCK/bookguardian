import { afterEach, describe, expect, it, vi } from 'vitest';
import i18next, { detectLocale, initI18n } from '../src/i18n';

describe('i18n', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('initialises once with English as source and fallback', () => {
    const first = initI18n();
    const second = initI18n();
    expect(second).toBe(first);
    expect(i18next.isInitialized).toBe(true);
    expect(i18next.language).toBe('en');
    expect(i18next.t('nav.library')).toBe('Library');
  });

  it('interpolates without HTML escaping', () => {
    expect(i18next.t('settings.version', { version: '1.0.0' })).toBe('Version 1.0.0');
    expect(i18next.t('settings.apiStatus.online', { driver: '<sqlite>' })).toBe(
      'Online (<sqlite>)',
    );
  });

  it('ships Spanish and switches to it at runtime', async () => {
    await i18next.changeLanguage('es');
    expect(i18next.t('nav.library')).toBe('Biblioteca');
    expect(i18next.t('books.field.readAt')).toBe('Leído el');
    expect(i18next.t('count.books', { count: 2 })).toBe('2 libros');
    await i18next.changeLanguage('en');
  });

  it('detects the locale from the browser language list', () => {
    vi.stubGlobal('navigator', { languages: ['es-ES', 'en'], language: 'es-ES' });
    expect(detectLocale()).toBe('es');
    vi.stubGlobal('navigator', { languages: undefined, language: 'es' });
    expect(detectLocale()).toBe('es');
    vi.stubGlobal('navigator', { languages: ['fr'], language: 'fr' });
    expect(detectLocale()).toBe('en');
    vi.stubGlobal('navigator', undefined);
    expect(detectLocale()).toBe('en');
  });
});
