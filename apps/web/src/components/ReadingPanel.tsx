import { READ_STATUSES, type Book } from '@bookguardian/shared';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { ReadingActions } from '../api/inventory';
import { ReadDateField } from './ReadDateField';
import { StarRating } from './StarRating';

interface ReadingPanelProps {
  book: Book;
  actions: ReadingActions;
  /** Tighter layout for the quick-actions sheet. */
  compact?: boolean;
}

/**
 * "Your reading": star rating, status and the read date. The date only
 * appears once the book is read, already stamped with today by the shared
 * rule and editable from there (never a future day).
 */
export function ReadingPanel({ book, actions, compact = false }: ReadingPanelProps) {
  const { t } = useTranslation();
  const readAtId = useId();

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
              if (book.readStatus !== status) actions.set(book, status);
            }}
          >
            {t(`readStatus.${status}`)}
          </button>
        ))}
      </div>

      {book.readStatus === 'read' ? (
        <div className="reading__date">
          <label className="field__label" htmlFor={readAtId}>
            {t('books.field.readAt')}
          </label>
          <ReadDateField
            id={readAtId}
            value={book.readAt ?? ''}
            onChange={(readAt) => actions.setReadAt(book, readAt)}
          />
        </div>
      ) : null}
    </section>
  );
}
