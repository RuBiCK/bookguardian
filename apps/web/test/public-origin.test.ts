/**
 * The landing page's canonical / Open Graph / Twitter URLs are absolute, so
 * they carry a host — and a host nobody configured must not be ours (BOOK-22).
 * A fork that never sets PUBLIC_ORIGIN has to emit relative URLs, not tags
 * advertising the maintainer's deployment. The positive case (a configured
 * origin still produces the right absolute tags, which the existing deploy
 * depends on) is asserted here too.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { applyPublicOrigin, publicOriginPlugin, resolvePublicOrigin } from '../public-origin';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (name: string) => readFileSync(resolve(webRoot, name), 'utf8');
const indexHtml = read('index.html');

/** The tags whose value is a URL, i.e. the ones that would carry a host. */
const URL_TAGS = [
  /<link rel="canonical" href="([^"]*)"/,
  /<meta property="og:url" content="([^"]*)"/,
  /<meta property="og:image" content="([^"]*)"/,
  /<meta name="twitter:image" content="([^"]*)"/,
];

function urlTagValues(html: string): string[] {
  return URL_TAGS.map((pattern) => {
    const match = pattern.exec(html);
    expect(match, `index.html should contain ${String(pattern)}`).not.toBeNull();
    return match![1]!;
  });
}

/** What `vite build` emits: the real plugin, run over the real index.html. */
function buildIndexHtml(configured: string | undefined): string {
  const transform = publicOriginPlugin(configured).transformIndexHtml;
  expect(typeof transform).toBe('function');
  return (transform as (html: string) => string)(indexHtml);
}

describe('PUBLIC_ORIGIN', () => {
  it('leaves no hardcoded host in the HTML source', () => {
    for (const value of urlTagValues(indexHtml)) {
      expect(value).toMatch(/^%PUBLIC_ORIGIN%\//);
    }
    expect(indexHtml).not.toMatch(/https?:\/\//);
  });

  it('is read from the environment with no fallback host', () => {
    // The config is not imported (it pulls esbuild into jsdom); assert the wiring.
    const config = read('vite.config.ts');
    expect(config).toContain('publicOriginPlugin(process.env.PUBLIC_ORIGIN ?? env.PUBLIC_ORIGIN)');
    expect(config).not.toMatch(/https?:\/\/[^'"\s]*bookguardian/);
  });

  it('resolves to an empty origin when nothing is configured', () => {
    expect(resolvePublicOrigin(undefined)).toBe('');
    expect(resolvePublicOrigin('')).toBe('');
    expect(resolvePublicOrigin('   ')).toBe('');
  });

  it('normalises a configured origin (trimmed, no trailing slash)', () => {
    expect(resolvePublicOrigin(' https://books.example.com// ')).toBe('https://books.example.com');
    expect(resolvePublicOrigin('https://books.example.com')).toBe('https://books.example.com');
  });

  it('emits no absolute URL, and no host at all, when unset', () => {
    for (const unset of [undefined, '', '  ']) {
      const html = buildIndexHtml(unset);

      expect(html).not.toContain('%PUBLIC_ORIGIN%');
      expect(html).not.toMatch(/https?:\/\//);
      expect(html).not.toContain('marcote.net');
      expect(urlTagValues(html)).toEqual(['/', '/', '/og.png', '/og.png']);
    }
  });

  it('emits the configured absolute URLs when the deployment sets it', () => {
    const html = buildIndexHtml('https://books.example.com/');

    expect(html).not.toContain('%PUBLIC_ORIGIN%');
    expect(urlTagValues(html)).toEqual([
      'https://books.example.com/',
      'https://books.example.com/',
      'https://books.example.com/og.png',
      'https://books.example.com/og.png',
    ]);
  });

  it('substitutes every placeholder occurrence', () => {
    const html = '<a href="%PUBLIC_ORIGIN%/a"><b>%PUBLIC_ORIGIN%/b</b>';
    expect(applyPublicOrigin(html, 'https://x.test')).toBe(
      '<a href="https://x.test/a"><b>https://x.test/b</b>',
    );
    expect(applyPublicOrigin(html, '')).toBe('<a href="/a"><b>/b</b>');
  });
});
