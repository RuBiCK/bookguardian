import { READ_STATUSES, applyReadingRules, todayIso, type Book } from '@bookguardian/shared';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { ReadingActions } from '../api/inventory';
import { StarRating } from './StarRating';

interface ReadingPanelProps {
  book: Book;
  actions: ReadingActions;
  /** Tighter layout for the quick-actions sheet. */
  compact?: boolean;
  /** Told when a date edit is refused (finished before started). */
  onInvalidDates?: () => void;
}

/**
 * "Your reading": star rating, status and the dates that go with it. Dates
 * only appear once they apply (started for reading/read, finished for read),
 * and are already filled in by the reading rules when the status changes.
 */
export function ReadingPanel({
  book,
  actions,
  compact = false,
  onInvalidDates,
}: ReadingPanelProps) {
  const { t } = useTranslation();
  const id = useId();
  const today = todayIso();

  const changeDate = (patch: { startedAt?: string | null; readAt?: string | null }) => {
    const result = applyReadingRules(book, patch, today);
    if (!result.ok) {
      onInvalidDates?.();
      return;
    }
    actions.setDates(book, patch);
  };

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

      {book.readStatus === 'to_read' ? null : (
        <div className="reading__dates">
          <div className="field field--inline">
            <label className="field__label" htmlFor={`${id}-started`}>
              {t('reading.startedAt')}
            </label>
            <input
              id={`${id}-started`}
              type="date"
              className="field__input"
              value={book.startedAt ?? ''}
              max={book.readAt ?? today}
              onChange={(event) => changeDate({ startedAt: event.target.value || null })}
            />
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
                min={book.startedAt ?? undefined}
                max={today}
                onChange={(event) => changeDate({ readAt: event.target.value || null })}
              />
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
