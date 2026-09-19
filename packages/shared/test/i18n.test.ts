import { describe, expect, it } from 'vitest';
import { resources, SUPPORTED_LOCALES } from '../src/i18n';

describe('i18n resources', () => {
  it('exposes every supported locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(resources[locale]).toBeDefined();
    }
  });

  it('has the five navigation labels', () => {
    const nav = resources.en.translation.nav;
    expect(Object.keys(nav)).toEqual(['library', 'scan', 'lending', 'stats', 'settings']);
  });
});
