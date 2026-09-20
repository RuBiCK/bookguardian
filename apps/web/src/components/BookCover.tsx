import type { Book } from '@bookguardian/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { coverSrc } from '../api/covers';
import { placeholderColor, PLACEHOLDER_TEXT } from '../lib/cover-placeholder';

export interface BookCoverProps {
  /** The book (or catalogue draft) whose cover to show. */
  book: Pick<Book, 'title' | 'authors'> & Partial<Pick<Book, 'coverAssetId' | 'coverPending'>>;
  /** An external image (catalogue drafts) instead of a stored asset. */
  src?: string | null;
  /** Roughly how wide the cover renders, so the browser picks thumb or full. */
  sizes?: string;
  className?: string;
}

/**
 * The one cover element used everywhere: grid tiles, the book page hero,
 * the scan result and lending rows. A stored cover loads lazily with a
 * skeleton and `srcset` (200 px thumb / 600 px full); without one — or while
 * the API is still looking — it draws a 2:3 card coloured from the title,
 * with the title and author on it, legible in light and dark mode alike.
 */
export function BookCover({ book, src, sizes = '33vw', className }: BookCoverProps) {
  const { t } = useTranslation();
  const stored = book.coverAssetId ?? null;
  const full = src ?? (stored ? coverSrc(stored) : null);
  const thumb = stored && !src ? coverSrc(stored, 'thumb') : null;
  // Remember which URL settled, so a new image (cover arrived, cover changed) starts over.
  const [loaded, setLoaded] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const state = full === failed ? 'failed' : full === loaded ? 'loaded' : 'loading';

  const authors = book.authors.length > 0 ? book.authors.join(', ') : t('books.unknownAuthor');
  const showImage = full !== null && state !== 'failed';
  const classes = ['cover', className].filter(Boolean).join(' ');

  return (
    <span
      className={classes}
      data-testid="book-cover"
      data-state={showImage ? state : book.coverPending ? 'pending' : 'placeholder'}
    >
      {showImage ? (
        <img
          className="cover__image"
          src={thumb ?? full}
          srcSet={thumb ? `${thumb} 133w, ${full} 400w` : undefined}
          sizes={thumb ? sizes : undefined}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={() => setLoaded(full)}
          onError={() => setFailed(full)}
        />
      ) : (
        <span
          className="cover__placeholder"
          style={{ background: placeholderColor(book.title), color: PLACEHOLDER_TEXT }}
          aria-hidden="true"
        >
          <span className="cover__placeholder-title">{book.title}</span>
          <span className="cover__placeholder-author">{authors}</span>
        </span>
      )}
    </span>
  );
}
