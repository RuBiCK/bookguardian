import { describe, expect, it } from 'vitest';
import i18next, { initI18n } from '../src/i18n';

describe('i18n', () => {
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
});
