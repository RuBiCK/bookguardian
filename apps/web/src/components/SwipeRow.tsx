import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { haptic } from '../lib/motion';

export interface SwipeAction {
  key: string;
  label: string;
  icon: ReactNode;
  tone?: 'accent' | 'success' | 'neutral';
  onSelect: () => void;
}

interface SwipeRowProps {
  actions: SwipeAction[];
  /** Whether the action tray is showing; the parent keeps one row open at a time. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
  testId?: string;
}

/** Width of one action button (matches `.swipe__action`). */
export const ACTION_WIDTH = 76;
/** Sideways travel before a press counts as a swipe rather than a tap. */
const SWIPE_SLOP_PX = 10;
/** Movement samples closer together than this carry no usable velocity. */
const MIN_SAMPLE_MS = 8;
/** How long after a swipe its synthetic click is still ignored. */
const SWIPE_CLICK_GRACE_MS = 150;

/**
 * Push the row to the left to uncover its actions; let go past halfway (or
 * flick) and the tray stays open, tap anywhere on the row to close it. A
 * swipe never triggers a link tap, and a vertical scroll never starts a
 * swipe — `touch-action: pan-y` on the content leaves scrolling to the
 * browser. Screen readers reach the same actions through the row's own
 * "more" button, so nothing hides behind the gesture.
 */
export function SwipeRow({
  actions,
  open,
  onOpenChange,
  children,
  className,
  testId,
}: SwipeRowProps) {
  const trayWidth = actions.length * ACTION_WIDTH;
  const [offset, setOffset] = useState(open ? -trayWidth : 0);
  const [dragging, setDragging] = useState(false);
  const gesture = useRef<{
    id: number;
    startX: number;
    startY: number;
    base: number;
    lastX: number;
    lastAt: number;
    velocity: number;
    swiping: boolean;
  } | null>(null);
  const swiped = useRef(false);

  // Follow the parent: another row opening closes this one.
  useEffect(() => {
    setOffset(open ? -trayWidth : 0);
  }, [open, trayWidth]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button || event.pointerType === 'mouse') return; // finger / pen only
    gesture.current = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      base: offset,
      lastX: event.clientX,
      lastAt: performance.now(),
      velocity: 0,
      swiping: false,
    };
    swiped.current = false;
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (g?.id !== event.pointerId) return;
    const dx = event.clientX - g.startX;
    const dy = event.clientY - g.startY;
    if (!g.swiping) {
      if (Math.abs(dx) < SWIPE_SLOP_PX) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        gesture.current = null; // the finger is scrolling
        return;
      }
      g.swiping = true;
      setDragging(true);
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        /* not supported here */
      }
    }
    const now = performance.now();
    if (now - g.lastAt >= MIN_SAMPLE_MS) {
      g.velocity = (event.clientX - g.lastX) / (now - g.lastAt);
      g.lastX = event.clientX;
      g.lastAt = now;
    }
    // Resist past the tray so the row feels attached to the edge.
    const raw = g.base + dx;
    const next = raw < -trayWidth ? -trayWidth + (raw + trayWidth) * 0.25 : Math.min(0, raw);
    setOffset(next);
  };

  const settle = (event: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (g?.id !== event.pointerId) return;
    gesture.current = null;
    if (!g.swiping) return;
    // Swallow only the click this same gesture may synthesise (it arrives at
    // once); a tap a moment later is a real tap on whatever is under it.
    swiped.current = true;
    setTimeout(() => {
      swiped.current = false;
    }, SWIPE_CLICK_GRACE_MS);
    setDragging(false);
    const flickOpen = g.velocity < -0.5;
    const flickClose = g.velocity > 0.5;
    const shouldOpen = flickOpen || (!flickClose && offset < -trayWidth / 2);
    if (shouldOpen !== open) haptic();
    setOffset(shouldOpen ? -trayWidth : 0);
    onOpenChange(shouldOpen);
  };

  const onClickCapture = (event: React.MouseEvent) => {
    // A swipe must not also activate what the finger was on.
    if (swiped.current) {
      event.preventDefault();
      event.stopPropagation();
      swiped.current = false;
      return;
    }
    // Any tap on an open row just closes it.
    if (open) {
      event.preventDefault();
      event.stopPropagation();
      onOpenChange(false);
    }
  };

  const classes = ['swipe', className].filter(Boolean).join(' ');
  return (
    <div
      className={classes}
      data-testid={testId}
      data-open={open || undefined}
      data-dragging={dragging || undefined}
    >
      <div className="swipe__actions" aria-hidden={!open}>
        {actions.map((action) => (
          <button
            key={action.key}
            type="button"
            className={`swipe__action swipe__action--${action.tone ?? 'neutral'}`}
            tabIndex={open ? 0 : -1}
            onClick={() => {
              haptic();
              onOpenChange(false);
              action.onSelect();
            }}
          >
            {action.icon}
            <span>{action.label}</span>
          </button>
        ))}
      </div>
      <div
        className="swipe__content"
        style={offset !== 0 ? { transform: `translateX(${offset}px)` } : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={settle}
        onPointerCancel={settle}
        onClickCapture={onClickCapture}
      >
        {children}
      </div>
    </div>
  );
}
