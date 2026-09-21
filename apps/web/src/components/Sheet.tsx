import {
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { canAnimate, prefersReducedMotion } from '../lib/motion';
import { CloseIcon } from './icons';

interface SheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Sticky footer, typically the primary button. */
  footer?: ReactNode;
}

/** How far the grip has to travel (px) before letting go dismisses the sheet. */
export const DISMISS_DISTANCE = 96;
/** Or how fast (px/ms): a quick flick closes it from anywhere. */
const DISMISS_VELOCITY = 0.6;
/** Gestures shorter than this carry no usable velocity (synthetic events land at once). */
const MIN_FLICK_MS = 30;
const EXIT_MS = 200;

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Bottom sheet: springs up from the tab bar edge so its controls sit in
 * thumb reach, slides back down when dismissed, and follows a finger that
 * drags the grip. Closes on backdrop tap, Escape and a downward swipe;
 * traps focus while open and hands it back to the control that opened it.
 */
export function Sheet({ open, title, onClose, children, footer }: SheetProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  // Callers pass inline closures; keep the latest without re-running the open effect.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  // `closing` keeps the sheet mounted for its exit animation. Platforms that
  // cannot animate (jsdom) skip it and unmount at once.
  const [closing, setClosing] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    setClosing(!open && canAnimate() && !prefersReducedMotion());
  }
  const [drag, setDrag] = useState<{ y: number; settling: boolean } | null>(null);
  const gesture = useRef<{ startY: number; startAt: number; lastY: number; lastAt: number } | null>(
    null,
  );

  // Exit: slide the panel down from wherever it is and fade the backdrop.
  useEffect(() => {
    if (!closing) return;
    const panel = panelRef.current;
    const backdrop = backdropRef.current;
    if (!panel || !backdrop) return;
    const from = panel.style.transform === '' ? 'none' : panel.style.transform;
    const slide = panel.animate([{ transform: from }, { transform: 'translateY(100%)' }], {
      duration: EXIT_MS,
      easing: 'cubic-bezier(0.4, 0, 1, 1)',
      fill: 'forwards',
    });
    const fade = backdrop.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: EXIT_MS,
      fill: 'forwards',
    });
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      setClosing(false);
      setDrag(null);
    };
    void Promise.all([slide.finished, fade.finished]).then(finish, finish);
    // Backstop for browsers that never resolve `finished` (cancelled animations).
    const timer = setTimeout(finish, EXIT_MS + 100);
    return () => {
      clearTimeout(timer);
      slide.cancel();
      fade.cancel();
    };
  }, [closing]);

  // Open: lock page scroll, listen for Escape, trap Tab, move focus in.
  useEffect(() => {
    if (!open) return;
    openerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !panelRef.current.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    // Focus the first field so the keyboard opens right away on phones.
    const first = panelRef.current?.querySelector<HTMLElement>(
      'input, select, textarea, button:not([data-sheet-close])',
    );
    (first ?? panelRef.current)?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
      // Hand focus back to whatever opened the sheet, if it is still there.
      const opener = openerRef.current;
      if (opener?.isConnected) opener.focus();
    };
  }, [open]);

  const onGripDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button || closing) return;
    if ((event.target as HTMLElement).closest('button')) return; // the close button
    const now = performance.now();
    gesture.current = { startY: event.clientY, startAt: now, lastY: event.clientY, lastAt: now };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* not supported here */
    }
    setDrag({ y: 0, settling: false });
  };

  const onGripMove = (event: ReactPointerEvent<HTMLElement>) => {
    const g = gesture.current;
    if (!g) return;
    g.lastY = event.clientY;
    g.lastAt = performance.now();
    const dy = Math.max(0, event.clientY - g.startY);
    setDrag({ y: dy, settling: false });
  };

  const onGripUp = (event: ReactPointerEvent<HTMLElement>) => {
    const g = gesture.current;
    if (!g) return;
    gesture.current = null;
    const dy = Math.max(0, event.clientY - g.startY);
    const elapsed = g.lastAt - g.startAt;
    const velocity = elapsed < MIN_FLICK_MS ? 0 : (g.lastY - g.startY) / elapsed;
    if (dy >= DISMISS_DISTANCE || velocity >= DISMISS_VELOCITY) {
      onClose();
    } else {
      // Spring back to rest; the CSS transition handles the easing.
      setDrag({ y: 0, settling: true });
    }
  };

  const onGripCancel = () => {
    gesture.current = null;
    setDrag({ y: 0, settling: true });
  };

  if (!open && !closing) return null;

  const dragging = drag !== null && !drag.settling;
  const panelClass = `sheet__panel${footer ? '' : ' sheet__panel--no-footer'}`;

  return (
    <div className="sheet" data-testid="sheet" data-state={open ? 'open' : 'closing'}>
      {/* Tap-outside-to-dismiss target; the labelled close button is the accessible path. */}
      <div ref={backdropRef} className="sheet__backdrop" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        className={panelClass}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-dragging={dragging || undefined}
        data-settling={drag?.settling ? true : undefined}
        style={drag && drag.y > 0 ? { transform: `translateY(${drag.y}px)` } : undefined}
        onTransitionEnd={() => {
          if (drag?.settling) setDrag(null);
        }}
      >
        <header
          className="sheet__header"
          onPointerDown={onGripDown}
          onPointerMove={onGripMove}
          onPointerUp={onGripUp}
          onPointerCancel={onGripCancel}
        >
          <span className="sheet__grip" aria-hidden="true" />
          <h2 id={titleId} className="sheet__title">
            {title}
          </h2>
          <button
            type="button"
            className="icon-button"
            aria-label={t('common.close')}
            onClick={onClose}
            data-sheet-close
          >
            <CloseIcon />
          </button>
        </header>
        <div className="sheet__body">{children}</div>
        {footer ? <footer className="sheet__footer">{footer}</footer> : null}
      </div>
    </div>
  );
}
