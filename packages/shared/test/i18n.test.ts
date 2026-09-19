import { describe, expect, it } from 'vitest';
import { en, es, resolveLocale, resources, SOURCE_LOCALE, SUPPORTED_LOCALES } from '../src/i18n';

function leaves(obj: Record<string, unknown>, prefix = ''): [string, string][] {
  return Object.entries(obj).flatMap(([key, value]) =>
    typeof value === 'string'
      ? [[`${prefix}${key}`, value] as [string, string]]
      : leaves(value as Record<string, unknown>, `${prefix}${key}.`),
  );
}

const placeholders = (value: string) =>
  [...value.matchAll(/\{\{\s*([^}]*?)\s*\}\}/g)].map((m) => m[1]).sort();

describe('i18n resources', () => {
  it('exposes every supported locale and the source locale', () => {
    expect(SUPPORTED_LOCALES).toContain(SOURCE_LOCALE);
    for (const locale of SUPPORTED_LOCALES) {
      expect(resources[locale]).toBeDefined();
    }
    expect(resources.en.translation).toBe(en);
    expect(resources.es.translation).toBe(es);
  });

  it('has the five navigation labels', () => {
    expect(Object.keys(en.nav)).toEqual(['library', 'scan', 'lending', 'stats', 'settings']);
  });

  it.each(SUPPORTED_LOCALES)('%s has no empty or untrimmed strings', (locale) => {
    for (const [key, value] of leaves(resources[locale].translation)) {
      expect(value.trim(), key).not.toBe('');
      expect(value, key).toBe(value.trim());
    }
  });

  it.each(SUPPORTED_LOCALES)('%s uses only i18next-style {{placeholders}}', (locale) => {
    for (const [key, value] of leaves(resources[locale].translation)) {
      const singles = value.match(/(?<!\{)\{(?!\{)[^}]*\}(?!\})/g);
      expect(singles, key).toBeNull();
      for (const match of value.matchAll(/\{\{\s*([^}]*?)\s*\}\}/g)) {
        expect(match[1], key).toMatch(/^[a-zA-Z_][a-zA-Z0-9_]*$/);
      }
    }
  });

  it('every locale carries exactly the source keys, with the same placeholders', () => {
    const source = new Map(leaves(en));
    for (const locale of SUPPORTED_LOCALES) {
      if (locale === SOURCE_LOCALE) continue;
      const translated = new Map(leaves(resources[locale].translation));
      expect([...translated.keys()].sort(), locale).toEqual([...source.keys()].sort());
      for (const [key, value] of source) {
        expect(placeholders(translated.get(key)!), `${locale}:${key}`).toEqual(placeholders(value));
      }
    }
  });
});

describe('resolveLocale', () => {
  it('matches exact tags, then the language part, else falls back to English', () => {
    expect(resolveLocale(['es'])).toBe('es');
    expect(resolveLocale(['es-MX', 'en'])).toBe('es');
    expect(resolveLocale(['ES-es'])).toBe('es');
    expect(resolveLocale(['fr-FR', 'es-ES'])).toBe('es');
    expect(resolveLocale(['fr-FR', 'de'])).toBe('en');
    expect(resolveLocale([])).toBe('en');
    expect(resolveLocale(['en-GB', 'es'])).toBe('en');
  });
});
