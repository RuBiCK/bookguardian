import type { Book } from '@bookguardian/shared';
import { Link } from '@tanstack/react-router';
import { useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { markOpened, useIsLastOpened } from '../lib/last-opened';
import { haptic } from '../lib/motion';
import { useBookActions } from './useBookActions';
import { BookCover } from './BookCover';
import { StarIcon } from './icons';

/** Grid tiles are a third of the screen on phones, a quarter from 480px up. */
const TILE_SIZES = '(min-width: 480px) 25vw, 33vw';

/** How long a finger has to rest on a cover before quick actions open. */
export const LONG_PRESS_MS = 450;
const LONG_PRESS_SLOP_PX = 10;

interface BookCardProps {
  book: Book;
  /** The book is currently lent out (badge on the cover). */
  lent?: boolean;
  onLongPress?: (book: Book) => void;
}

/**
 * Cover-first tile; `BookCover` draws a title/author card while there is no
 * image. The last-opened book's cover carries the shared view-transition
 * name, so it morphs into the book page hero and back.
 */
export function BookCard({ book, lent = false, onLongPress }: BookCardProps) {
  const { t } = useTranslation();
  const authors = book.authors.length > 0 ? book.authors.join(', ') : t('books.unknownAuthor');
  const press = useRef<{ timer: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null);
  const fired = useRef(false);
  const shared = useIsLastOpened(book.id);

  const cancel = () => {
    if (press.current) clearTimeout(press.current.timer);
    press.current = null;
  };
  const start = (event: ReactPointerEvent) => {
    if (!onLongPress || event.button) return; // primary button / finger only
    cancel();
    fired.current = false;
    press.current = {
      x: event.clientX,
      y: event.clientY,
      timer: setTimeout(() => {
        press.current = null;
        fired.current = true;
        haptic();
        onLongPress(book);
      }, LONG_PRESS_MS),
    };
  };
  const move = (event: ReactPointerEvent) => {
    if (!press.current) return;
    if (
      Math.abs(event.clientX - press.current.x) > LONG_PRESS_SLOP_PX ||
      Math.abs(event.clientY - press.current.y) > LONG_PRESS_SLOP_PX
    ) {
      cancel(); // the finger is scrolling, not pressing
    }
  };

  return (
    <Link
      to="/books/$bookId"
      params={{ bookId: book.id }}
      className="book-card"
      data-testid="book-card"
      aria-label={`${book.title} — ${authors}`}
      viewTransition
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onPointerLeave={cancel}
      onClick={(event) => {
        // The tap that ended a long press must not also open the book.
        if (fired.current) {
          event.preventDefault();
          fired.current = false;
          return;
        }
        markOpened(book.id);
      }}
      onContextMenu={(event) => {
        // Right-click on desktop, and the callout iOS would show, both become quick actions.
        if (!onLongPress) return;
        event.preventDefault();
        cancel();
        onLongPress(book);
      }}
    >
      <span
        className="book-card__cover"
        style={shared ? { viewTransitionName: 'book-cover' } : undefined}
      >
        <BookCover book={book} sizes={TILE_SIZES} />
        {book.readStatus !== 'to_read' ? (
          <span className={`book-card__badge book-card__badge--${book.readStatus}`}>
            {t(`readStatus.${book.readStatus}`)}
          </span>
        ) : null}
        {lent ? (
          <span className="book-card__badge book-card__badge--lent">{t('lending.lent')}</span>
        ) : null}
        {book.rating ? (
          <span
            className="book-card__rating"
            aria-label={t('reading.stars', { count: book.rating })}
          >
            <StarIcon filled /> {book.rating}
          </span>
        ) : null}
      </span>
      <span className="book-card__title">{book.title}</span>
      <span className="book-card__author">{authors}</span>
    </Link>
  );
}

interface BookGridProps {
  books: Book[];
}

/** Cover grid; a long press (or right-click) on any cover opens the quick actions sheet. */
export function BookGrid({ books }: BookGridProps) {
  const actions = useBookActions();
  return (
    <ul className="book-grid" data-testid="book-grid">
      {books.map((book, i) => (
        <li key={book.id} style={{ '--i': i } as CSSProperties}>
          <BookCard
            book={book}
            lent={actions.lent.has(book.id)}
            onLongPress={(b) => actions.open('quick', b)}
          />
        </li>
      ))}
    </ul>
  );
}
