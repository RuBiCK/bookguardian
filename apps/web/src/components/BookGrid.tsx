import type { Book } from '@bookguardian/shared';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { BookIcon } from './icons';

interface BookCardProps {
  book: Book;
}

/** Cover-first tile; falls back to a title/author card when there is no cover. */
export function BookCard({ book }: BookCardProps) {
  const { t } = useTranslation();
  const authors = book.authors.length > 0 ? book.authors.join(', ') : t('books.unknownAuthor');
  return (
    <Link
      to="/books/$bookId"
      params={{ bookId: book.id }}
      className="book-card"
      data-testid="book-card"
      aria-label={`${book.title} — ${authors}`}
    >
      <span className="book-card__cover">
        {book.coverUrl ? (
          <img src={book.coverUrl} alt="" loading="lazy" />
        ) : (
          <span className="book-card__placeholder" aria-hidden="true">
            <BookIcon />
            <span className="book-card__placeholder-title">{book.title}</span>
          </span>
        )}
        {book.readStatus !== 'to_read' ? (
          <span className={`book-card__badge book-card__badge--${book.readStatus}`}>
            {t(`readStatus.${book.readStatus}`)}
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

export function BookGrid({ books }: BookGridProps) {
  return (
    <ul className="book-grid" data-testid="book-grid">
      {books.map((book) => (
        <li key={book.id}>
          <BookCard book={book} />
        </li>
      ))}
    </ul>
  );
}
