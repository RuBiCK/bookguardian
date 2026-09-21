import type { Book } from '@bookguardian/shared';
import { Link } from '@tanstack/react-router';
import { useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { markOpened, useIsLastOpened } from '../lib/last-opened';
import { transitionName, useListTransitionActive } from '../lib/motion';
import { useBookActions } from './useBookActions';
import { BookCover } from './BookCover';
import { CheckIcon, LendingIcon, MoreIcon, MoveIcon, StarIcon, UndoIcon } from './icons';
import { SwipeRow } from './SwipeRow';

interface BookRowProps {
  book: Book;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * One line per book: cover, title, author and badges. Swipe left for lend /
 * mark read / move; the "more" button opens the same actions as a sheet for
 * keyboard and screen-reader users.
 */
export function BookRow({ book, open, onOpenChange }: BookRowProps) {
  const { t } = useTranslation();
  const actions = useBookActions();
  const shared = useIsLastOpened(book.id);
  const authors = book.authors.length > 0 ? book.authors.join(', ') : t('books.unknownAuthor');
  const lent = actions.lent.has(book.id);
  const read = book.readStatus === 'read';

  return (
    <SwipeRow
      open={open}
      onOpenChange={onOpenChange}
      testId="book-row"
      actions={[
        {
          key: 'lend',
          label: lent ? t('quick.return') : t('quick.lend'),
          icon: lent ? <UndoIcon /> : <LendingIcon />,
          tone: 'accent',
          onSelect: () => actions.lendOrReturn(book),
        },
        {
          key: 'read',
          label: read ? t('quick.markUnread') : t('quick.markRead'),
          icon: read ? <UndoIcon /> : <CheckIcon />,
          tone: 'success',
          onSelect: () => actions.toggleRead(book),
        },
        {
          key: 'move',
          label: t('quick.move'),
          icon: <MoveIcon />,
          tone: 'neutral',
          onSelect: () => actions.open('move', book),
        },
      ]}
    >
      <div className="book-row">
        <Link
          to="/books/$bookId"
          params={{ bookId: book.id }}
          className="book-row__link"
          aria-label={`${book.title} — ${authors}`}
          viewTransition
          onClick={() => markOpened(book.id)}
        >
          <span
            className="book-row__cover"
            style={shared ? { viewTransitionName: 'book-cover' } : undefined}
          >
            <BookCover book={book} sizes="40px" compact />
          </span>
          <span className="book-row__body">
            <span className="book-row__title">{book.title}</span>
            <span className="book-row__meta">
              <span className="book-row__author">{authors}</span>
              {book.readStatus !== 'to_read' ? (
                <span className={`book-row__badge book-row__badge--${book.readStatus}`}>
                  {t(`readStatus.${book.readStatus}`)}
                </span>
              ) : null}
              {lent ? (
                <span className="book-row__badge book-row__badge--lent">{t('lending.lent')}</span>
              ) : null}
              {book.rating ? (
                <span
                  className="book-row__stars"
                  aria-label={t('reading.stars', { count: book.rating })}
                >
                  <StarIcon filled /> {book.rating}
                </span>
              ) : null}
            </span>
          </span>
        </Link>
        <button
          type="button"
          className="icon-button"
          aria-label={`${t('quick.more')}: ${book.title}`}
          onClick={() => actions.open('quick', book)}
        >
          <MoreIcon />
        </button>
      </div>
    </SwipeRow>
  );
}

interface BookRowsProps {
  books: Book[];
}

/** The list view of a shelf; one row's actions open at a time. */
export function BookRows({ books }: BookRowsProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const naming = useListTransitionActive();
  return (
    <ul className="book-rows" data-testid="book-rows">
      {books.map((book, i) => (
        <li
          key={book.id}
          style={
            {
              '--i': i,
              viewTransitionName: naming ? transitionName('row', book.id) : undefined,
            } as CSSProperties
          }
        >
          <BookRow
            book={book}
            open={openId === book.id}
            onOpenChange={(open) => setOpenId(open ? book.id : openId === book.id ? null : openId)}
          />
        </li>
      ))}
    </ul>
  );
}
