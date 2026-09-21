import type { LookupSearchResult } from '@bookguardian/shared';
import { useTranslation } from 'react-i18next';
import { BookCover } from './BookCover';
import { EmptyState } from './EmptyState';
import { SearchIcon } from './icons';
import { Sheet } from './Sheet';

/** Where an online search stands; `idle` means the sheet is closed. */
export type SearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; items: LookupSearchResult[] }
  | { status: 'error' };

interface SearchResultsSheetProps {
  state: SearchState;
  onPick: (result: LookupSearchResult) => void;
  /** Dismiss and keep whatever the user typed. */
  onClose: () => void;
  onRetry: () => void;
}

/**
 * The matches for what was typed in the add-book form, as a bottom sheet:
 * cover, title, authors, edition line, ISBN and where it came from. A tap
 * fills the form; the footer keeps the typed data when nothing fits.
 */
export function SearchResultsSheet({ state, onPick, onClose, onRetry }: SearchResultsSheetProps) {
  const { t } = useTranslation();
  return (
    <Sheet
      open={state.status !== 'idle'}
      onClose={onClose}
      title={t('books.search.title')}
      footer={
        <button
          type="button"
          className="button button--block"
          onClick={onClose}
          data-testid="keep-typed"
        >
          {t('books.search.keepTyped')}
        </button>
      }
    >
      {state.status === 'loading' ? (
        <ul className="results" aria-busy="true" data-testid="results-loading">
          <li className="visually-hidden" role="status">
            {t('books.search.searching')}
          </li>
          {[0, 1, 2].map((i) => (
            <li key={i} className="results__skeleton" aria-hidden="true">
              <span className="skeleton skeleton--cover" />
              <span className="skeleton skeleton--line" />
              <span className="skeleton skeleton--line skeleton--short" />
            </li>
          ))}
        </ul>
      ) : state.status === 'error' ? (
        <EmptyState
          title={t('books.search.error.title')}
          body={t('books.search.error.body')}
          action={
            <button type="button" className="button button--primary" onClick={onRetry}>
              {t('common.retry')}
            </button>
          }
        />
      ) : state.status === 'done' && state.items.length === 0 ? (
        <EmptyState
          title={t('books.search.empty.title')}
          body={t('books.search.empty.body')}
          icon={<SearchIcon />}
          action={<span />}
        />
      ) : state.status === 'done' ? (
        <ul className="results" data-testid="results">
          {state.items.map((result) => (
            <li key={result.resultId}>
              <ResultRow result={result} onPick={() => onPick(result)} />
            </li>
          ))}
        </ul>
      ) : null}
    </Sheet>
  );
}

function ResultRow({ result, onPick }: { result: LookupSearchResult; onPick: () => void }) {
  const { t } = useTranslation();
  const authors = result.authors.length > 0 ? result.authors.join(', ') : t('books.unknownAuthor');
  const edition = [result.publisher, result.publishedDate].filter(Boolean).join(' · ');
  return (
    <button
      type="button"
      className="candidates__item result"
      onClick={onPick}
      aria-label={t('books.search.pick', { title: result.title })}
      data-testid="result"
    >
      <span className="result__cover">
        <BookCover book={result} src={result.coverUrl} compact />
      </span>
      <span className="result__body">
        <span className="result__title">
          {result.title}
          {result.subtitle ? <span className="result__subtitle"> — {result.subtitle}</span> : null}
        </span>
        <span className="result__authors">{authors}</span>
        {edition ? <span className="result__meta">{edition}</span> : null}
        <span className="result__meta result__ids">
          {result.isbn13 ? <span>{t('books.search.isbn', { isbn: result.isbn13 })}</span> : null}
          <span className="pill pill--source">{t(`scan.result.source.${result.source}`)}</span>
        </span>
      </span>
    </button>
  );
}
