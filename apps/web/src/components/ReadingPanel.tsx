import { READ_STATUSES, todayIso, type Book } from '@bookguardian/shared';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { ReadingActions } from '../api/inventory';
import { StarRating } from './StarRating';

interface ReadingPanelProps {
  book: Book;
  actions: ReadingActions;
  /** Tighter layout for the quick-actions sheet. */
  compact?: boolean;
}

/**
 * "Your reading": star rating, status and the finished date. The date only
 * appears once the book is read, already filled in with today by the
 * reading rules and editable from there.
 */
export function ReadingPanel({ book, actions, compact = false }: ReadingPanelProps) {
  const { t } = useTranslation();
  const id = useId();

  return (
    <section
      className={`reading${compact ? ' reading--compact' : ''}`}
      aria-label={t('reading.title')}
    >
      {compact ? null : <h2 className="reading__title">{t('reading.title')}</h2>}

      <StarRating
        value={book.rating ?? 0}
        onChange={(rating) => actions.setRating(book, rating)}
        size={compact ? 'md' : 'lg'}
      />

      <div className="segmented segmented--block" role="group" aria-label={t('readStatus.label')}>
        {READ_STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            className="segmented__option"
            aria-pressed={book.readStatus === status}
            onClick={() => {
              if (book.readStatus !== status) actions.setStatus(book, status);
            }}
          >
            {t(`readStatus.${status}`)}
          </button>
        ))}
      </div>

      {book.readStatus === 'read' ? (
        <div className="field field--inline">
          <label className="field__label" htmlFor={`${id}-read`}>
            {t('reading.readAt')}
          </label>
          <input
            id={`${id}-read`}
            type="date"
            className="field__input"
            value={book.readAt ?? ''}
            max={todayIso()}
            onChange={(event) => actions.setReadAt(book, event.target.value || null)}
          />
        </div>
      ) : null}
    </section>
  );
}
