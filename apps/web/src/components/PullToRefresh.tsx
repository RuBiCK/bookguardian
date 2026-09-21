import { useEffect, useRef, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { haptic, prefersReducedMotion } from '../lib/motion';
import { ArrowDownIcon, RefreshIcon } from './icons';

type State = 'idle' | 'pulling' | 'ready' | 'refreshing';

/** Pull this far (after damping) to arm a refresh. */
export const REFRESH_THRESHOLD = 64;
/** How far the page may travel before the pull stops following the finger. */
const MAX_PULL = 110;
/** Finger movement is halved so the page feels weighted. */
const DAMPING = 0.5;

interface PullToRefreshProps {
  /** What to refresh; the spinner stays until it settles. */
  onRefresh: () => Promise<unknown>;
  /** The scrolling content, moved down with the finger. */
  contentRef: RefObject<HTMLElement | null>;
}

/**
 * Native-feeling pull to refresh for the app shell: only from the very top
 * of the page, only with a finger (touch events), never while a sheet has
 * locked scrolling. The page follows the pull with damping; past the
 * threshold the arrow flips, and letting go refetches every active query.
 */
export function PullToRefresh({ onRefresh, contentRef }: PullToRefreshProps) {
  const { t } = useTranslation();
  const [state, setState] = useState<State>('idle');
  const pull = useRef<{ startY: number; distance: number; active: boolean } | null>(null);
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  });

  useEffect(() => {
    const content = () => contentRef.current;
    const setOffset = (px: number, animate: boolean) => {
      const el = content();
      if (!el) return;
      el.dataset.pulling = animate ? 'false' : 'true';
      el.style.transform = px > 0 ? `translateY(${px}px)` : '';
    };

    const onStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      if (window.scrollY > 0 || document.body.style.overflow === 'hidden') return;
      if (pull.current?.active) return;
      pull.current = { startY: event.touches[0]!.clientY, distance: 0, active: false };
    };

    const onMove = (event: TouchEvent) => {
      const p = pull.current;
      if (!p || state === 'refreshing') return;
      const dy = event.touches[0]!.clientY - p.startY;
      if (dy <= 0 && !p.active) {
        pull.current = null; // scrolling the other way
        return;
      }
      if (window.scrollY > 0) return;
      p.active = true;
      p.distance = Math.min(MAX_PULL, Math.max(0, dy) * DAMPING);
      // Keep the browser from rubber-banding underneath us.
      if (event.cancelable) event.preventDefault();
      const reduced = prefersReducedMotion();
      setOffset(reduced ? 0 : p.distance, false);
      const next: State = p.distance >= REFRESH_THRESHOLD ? 'ready' : 'pulling';
      setState((prev) => {
        if (prev !== 'ready' && next === 'ready') haptic();
        return next;
      });
    };

    const onEnd = () => {
      const p = pull.current;
      pull.current = null;
      if (!p?.active) return;
      if (p.distance >= REFRESH_THRESHOLD) {
        setState('refreshing');
        setOffset(prefersReducedMotion() ? 0 : REFRESH_THRESHOLD, true);
        const finish = () => {
          setOffset(0, true);
          setState('idle');
        };
        Promise.resolve(onRefreshRef.current()).then(finish, finish);
      } else {
        setOffset(0, true);
        setState('idle');
      }
    };

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onEnd);
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);
    };
  }, [contentRef, state]);

  const label =
    state === 'refreshing'
      ? t('refresh.refreshing')
      : state === 'ready'
        ? t('refresh.release')
        : t('refresh.pull');

  return (
    <div
      className="ptr"
      data-state={state}
      data-testid="pull-to-refresh"
      role={state === 'idle' ? undefined : 'status'}
      aria-hidden={state === 'idle' || undefined}
      aria-live="polite"
      aria-label={state === 'idle' ? undefined : label}
    >
      {state === 'refreshing' ? <RefreshIcon /> : <ArrowDownIcon />}
    </div>
  );
}
