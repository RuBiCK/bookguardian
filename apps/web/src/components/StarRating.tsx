import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { StarIcon } from './icons';

const STARS = [1, 2, 3, 4, 5] as const;

interface StarRatingProps {
  /** 0 = not rated. */
  value: number;
  onChange: (value: number) => void;
  /** Larger, thumb-sized stars for the book page. */
  size?: 'md' | 'lg';
}

/**
 * Five-star control. Tap a star to rate, drag across the row to slide the
 * rating, tap the current star again to clear. Each star is a real button so
 * keyboard and screen-reader users get the same five choices.
 */
export function StarRating({ value, onChange, size = 'md' }: StarRatingProps) {
  const { t } = useTranslation();
  const rowRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ start: number; moved: boolean } | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  const shown = preview ?? value;

  /**
   * Which star sits under an x coordinate: the last star whose left edge the
   * finger has passed (so dragging past the row clamps to 1 / 5). Falls back
   * to the pressed star when nothing is laid out (jsdom).
   */
  const starAt = (event: ReactPointerEvent<HTMLElement>): number => {
    const stars = [...(rowRef.current?.querySelectorAll<HTMLElement>('[data-star]') ?? [])];
    const edges = stars.map((star) => star.getBoundingClientRect().left);
    if (edges.some((left) => left > 0)) {
      const passed = edges.filter((left) => event.clientX >= left).length;
      return Math.min(5, Math.max(1, passed));
    }
    const pressed = (event.target as HTMLElement).closest<HTMLElement>('[data-star]');
    return pressed ? Number(pressed.dataset.star) : shown;
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button) return; // primary button / finger only
    const star = starAt(event);
    drag.current = { start: star, moved: false };
    setPreview(star);
    // Keep receiving moves after the finger leaves the row (jsdom has no capture).
    try {
      rowRef.current?.setPointerCapture(event.pointerId);
    } catch {
      /* not supported here */
    }
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (!drag.current) return;
    const star = starAt(event);
    if (star !== drag.current.start) drag.current.moved = true;
    setPreview(star);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    if (!drag.current) return;
    const star = starAt(event);
    const { start, moved } = drag.current;
    drag.current = null;
    setPreview(null);
    // A plain tap on the star that is already selected clears the rating.
    onChange(!moved && start === value && star === value ? 0 : star);
  };

  const onPointerCancel = () => {
    drag.current = null;
    setPreview(null);
  };

  return (
    <div
      ref={rowRef}
      className={`rating rating--${size}`}
      role="group"
      aria-label={t('reading.rating')}
      data-testid="star-rating"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      {STARS.map((n) => (
        <button
          key={n}
          type="button"
          className={`rating__star${n <= shown ? ' rating__star--on' : ''}`}
          data-star={n}
          aria-label={t('reading.stars', { count: n })}
          aria-pressed={n <= value}
          // Pointer events drive touch and mouse; keyboard activation still lands here.
          onClick={(event) => {
            if (event.detail === 0) onChange(n === value ? 0 : n);
          }}
        >
          <StarIcon filled={n <= shown} />
        </button>
      ))}
      <span className="rating__value muted" aria-live="polite">
        {value === 0 ? t('reading.unrated') : t('reading.stars', { count: value })}
      </span>
    </div>
  );
}
