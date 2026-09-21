import { BOOK_SORTS, type BookSort, type ReadStatus } from '@bookguardian/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBooks, type BookFilter } from '../api/inventory';
import { BookGrid } from './BookGrid';
import { EmptyState } from './EmptyState';
import { SearchBar } from './SearchBar';
import { StatusChips } from './StatusChips';

/** Rating chips: exactly five stars, or at least four / three. */
const RATING_OPTIONS = [5, 4, 3] as const;

interface BookListProps {
  /**
   * Where the list is scoped: a shelf, a library, a global search, or one of
   * the Stats drill-downs (category, language, author, rating, read period).
   */
  base: Omit<BookFilter, 'readStatus' | 'minRating' | 'sort'>;
  /** Show a search box above the filters. */
  searchable?: boolean;
  /** Status chip pressed on first render (a stats tile opening "Read" books). */
  initialStatus?: ReadStatus;
  /** Offered by the empty state when nothing filters the list. */
  onAdd?: () => void;
}

/**
 * Filterable, sortable, paged cover grid shared by the shelf screen, the
 * library "Books" view and the global search. Filters are one tap each and
 * stay on one thumb-scrollable row.
 */
export function BookList({ base, searchable = false, initialStatus, onAdd }: BookListProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<ReadStatus | undefined>(initialStatus);
  const [minRating, setMinRating] = useState<number | undefined>(undefined);
  const [sort, setSort] = useState<BookSort>('added');

  const { q: baseQuery, shelfId, libraryId, ...narrowing } = base;
  const q = (searchable ? query : (baseQuery ?? '')).trim() || undefined;
  const filtering =
    q !== undefined ||
    status !== undefined ||
    minRating !== undefined ||
    Object.values(narrowing).some((value) => value !== undefined);
  const books = useBooks({
    ...narrowing,
    shelfId,
    libraryId,
    q,
    readStatus: status,
    minRating,
    sort,
  });
  const items = books.data?.pages.flatMap((p) => p.items) ?? [];
  const total = books.data?.pages[0]?.total ?? 0;

  return (
    <>
      {searchable ? (
        <SearchBar value={query} onChange={setQuery} placeholder={t('books.searchPlaceholder')} />
      ) : null}
      <StatusChips value={status} onChange={setStatus} />
      <div className="chips" role="group" aria-label={t('filters.rating')}>
        <label className="chip chip--select">
          <span className="visually-hidden">{t('filters.sort')}</span>
          <select
            className="chip__select"
            value={sort}
            onChange={(event) => setSort(event.target.value as BookSort)}
          >
            {BOOK_SORTS.map((option) => (
              <option key={option} value={option}>
                {t(`sort.${option}`)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="chip"
          aria-pressed={minRating === undefined}
          onClick={() => setMinRating(undefined)}
        >
          {t('filters.anyRating')}
        </button>
        {RATING_OPTIONS.map((stars) => (
          <button
            key={stars}
            type="button"
            className="chip"
            aria-pressed={minRating === stars}
            onClick={() => setMinRating(stars)}
          >
            {stars === 5
              ? t('filters.exactStars', { count: 5 })
              : t('filters.minStars', { count: stars })}
          </button>
        ))}
      </div>

      {books.isPending ? (
        <p className="muted">{t('common.loading')}</p>
      ) : books.isError ? (
        <EmptyState
          title={t('errors.generic')}
          body={t('errors.network')}
          action={
            <button type="button" className="button" onClick={() => void books.refetch()}>
              {t('common.retry')}
            </button>
          }
        />
      ) : items.length === 0 ? (
        <EmptyState
          title={filtering ? t('books.empty.noResults') : t('books.empty.title')}
          body={filtering ? undefined : t('books.empty.body')}
          action={
            filtering || !onAdd ? (
              <span />
            ) : (
              <button type="button" className="button button--primary" onClick={onAdd}>
                {t('books.add')}
              </button>
            )
          }
        />
      ) : (
        <>
          <BookGrid books={items} />
          <p className="muted">{t('books.showing', { shown: items.length, total })}</p>
          <p className="muted book-list__hint">{t('reading.longPressHint')}</p>
          {books.hasNextPage ? (
            <button
              type="button"
              className="button button--block"
              disabled={books.isFetchingNextPage}
              onClick={() => void books.fetchNextPage()}
            >
              {t('books.loadMore')}
            </button>
          ) : null}
        </>
      )}
    </>
  );
}
