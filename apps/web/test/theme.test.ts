import { beforeEach, describe, expect, it } from 'vitest';
import { applyTheme, readTheme } from '../src/theme/useTheme';

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it('defaults to system', () => {
    expect(readTheme()).toBe('system');
  });

  it('ignores garbage in storage', () => {
    localStorage.setItem('bookguardian.theme', 'neon');
    expect(readTheme()).toBe('system');
  });

  it('applies the theme as a data attribute on <html>', () => {
    applyTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});
