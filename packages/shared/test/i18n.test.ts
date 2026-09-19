import { describe, expect, it } from 'vitest';
import { en, resources, SOURCE_LOCALE, SUPPORTED_LOCALES } from '../src/i18n';

function leaves(obj: Record<string, unknown>, prefix = ''): [string, string][] {
  return Object.entries(obj).flatMap(([key, value]) =>
    typeof value === 'string'
      ? [[`${prefix}${key}`, value] as [string, string]]
      : leaves(value as Record<string, unknown>, `${prefix}${key}.`),
  );
}

describe('i18n resources', () => {
  it('exposes every supported locale and the source locale', () => {
    expect(SUPPORTED_LOCALES).toContain(SOURCE_LOCALE);
    for (const locale of SUPPORTED_LOCALES) {
      expect(resources[locale]).toBeDefined();
    }
    expect(resources.en.translation).toBe(en);
  });

  it('has the five navigation labels', () => {
    expect(Object.keys(en.nav)).toEqual(['library', 'scan', 'lending', 'stats', 'settings']);
  });

  it('has no empty or untrimmed strings', () => {
    for (const [key, value] of leaves(en)) {
      expect(value.trim(), key).not.toBe('');
      expect(value, key).toBe(value.trim());
    }
  });

  it('uses only i18next-style {{placeholders}} in interpolated strings', () => {
    for (const [key, value] of leaves(en)) {
      const singles = value.match(/(?<!\{)\{(?!\{)[^}]*\}(?!\})/g);
      expect(singles, key).toBeNull();
      for (const match of value.matchAll(/\{\{\s*([^}]*?)\s*\}\}/g)) {
        expect(match[1], key).toMatch(/^[a-zA-Z_][a-zA-Z0-9_]*$/);
      }
    }
  });
});
