import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { en } from '@bookguardian/shared/i18n';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InstallBanner, INSTALL_DISMISSED_KEY } from '../src/components/InstallBanner';
import {
  isIosSafari,
  isStandalone,
  listenForInstallPrompt,
  resetInstallPrompt,
  useInstallPrompt,
} from '../src/lib/install';
import { renderApp } from './render';

const IOS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const IOS_CHROME_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/118.0 Mobile/15E148 Safari/604.1';

function firePrompt(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const event = new Event('beforeinstallprompt', { cancelable: true });
  const prompt = vi.fn(() => Promise.resolve());
  Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome }) });
  act(() => {
    window.dispatchEvent(event);
  });
  return { event, prompt };
}

function Probe() {
  const { platform, install } = useInstallPrompt();
  return (
    <button type="button" data-platform={platform} onClick={() => void install()}>
      {platform}
    </button>
  );
}

let listening = false;
beforeEach(() => {
  resetInstallPrompt();
  localStorage.clear();
  if (!listening) {
    listenForInstallPrompt();
    listening = true;
  }
});
afterEach(() => {
  vi.restoreAllMocks();
  delete (window as { matchMedia?: unknown }).matchMedia;
});

describe('install prompt', () => {
  it('detects iOS Safari (not Chrome on iOS) and standalone mode', () => {
    expect(isIosSafari(IOS_UA)).toBe(true);
    expect(isIosSafari(IOS_CHROME_UA)).toBe(false);
    expect(isIosSafari('Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile Safari/537.36')).toBe(
      false,
    );
    expect(isStandalone()).toBe(false);
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (q: string) => ({ matches: q === '(display-mode: standalone)' }),
    });
    expect(isStandalone()).toBe(true);
  });

  it('captures beforeinstallprompt, replays it from the hook, and remembers the install', async () => {
    render(<Probe />);
    expect(screen.getByRole('button')).toHaveAttribute('data-platform', 'unavailable');
    const { event, prompt } = firePrompt('accepted');
    expect(event.defaultPrevented).toBe(true);
    expect(screen.getByRole('button')).toHaveAttribute('data-platform', 'prompt');

    await userEvent.setup().click(screen.getByRole('button'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button')).toHaveAttribute('data-platform', 'installed');
  });

  it('keeps offering after a dismissed prompt only when the browser fires it again', async () => {
    render(<Probe />);
    firePrompt('dismissed');
    await userEvent.setup().click(screen.getByRole('button'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole('button')).toHaveAttribute('data-platform', 'unavailable');
    firePrompt('dismissed');
    expect(screen.getByRole('button')).toHaveAttribute('data-platform', 'prompt');
    act(() => void window.dispatchEvent(new Event('appinstalled')));
    expect(screen.getByRole('button')).toHaveAttribute('data-platform', 'installed');
  });
});

describe('InstallBanner', () => {
  it('stays hidden until the app is installable, then can be dismissed for good', async () => {
    const { rerender } = render(<InstallBanner />);
    expect(screen.queryByTestId('install-banner')).not.toBeInTheDocument();
    firePrompt();
    rerender(<InstallBanner />);
    const banner = screen.getByTestId('install-banner');
    expect(banner).toHaveTextContent(en.install.title);
    expect(screen.getByRole('button', { name: en.install.button })).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('button', { name: en.install.dismiss }));
    expect(screen.queryByTestId('install-banner')).not.toBeInTheDocument();
    expect(localStorage.getItem(INSTALL_DISMISSED_KEY)).toBe('1');
  });

  it('shows the Share instructions on iOS Safari instead of a button', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(IOS_UA);
    render(<InstallBanner />);
    expect(screen.getByTestId('install-banner')).toHaveTextContent(en.install.ios);
    expect(screen.queryByRole('button', { name: en.install.button })).not.toBeInTheDocument();
  });
});

describe('Settings · install row', () => {
  it('offers the install button when the browser can prompt, and explains otherwise', async () => {
    await renderApp('/settings');
    const row = await screen.findByTestId('install-row');
    expect(row).toHaveTextContent(en.install.unavailable);
    firePrompt();
    expect(await screen.findByRole('button', { name: en.install.button })).toBeInTheDocument();
  });
});
