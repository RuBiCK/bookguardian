import { isFutureDate, localDate } from '@bookguardian/shared';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface ReadDateFieldProps {
  /** Element id, so a row label can point at the control. */
  id?: string;
  /** The book's current read date (YYYY-MM-DD). */
  value: string;
  /**
   * Called with a valid day (today or earlier) the moment the user picks one.
   * May return a promise that settles once the save landed or rolled back.
   */
  onChange: (readAt: string) => unknown;
}

/**
 * Inline "finished on" picker: a native date input (wheel picker on iOS,
 * calendar elsewhere) capped at today. Every valid pick saves right away;
 * a future day stays in the box with an error and is never sent.
 */
export function ReadDateField({ id, value, onChange }: ReadDateFieldProps) {
  const { t } = useTranslation();
  const fallbackId = useId();
  const inputId = id ?? fallbackId;
  const today = localDate();
  // What the user typed wins until the saved value moves (optimistic update,
  // rollback, refetch) or the save settles — then the box follows the book
  // again. A rejected day simply stays in the box with its error.
  const [draft, setDraft] = useState<string | null>(null);
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setDraft(null);
  }
  const shown = draft ?? value;
  const invalid = shown !== '' && isFutureDate(shown, today);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    setDraft(next);
    if (!next || next === value || isFutureDate(next, today)) return;
    void Promise.resolve(onChange(next))
      .catch(() => undefined)
      .finally(() => setDraft(null));
  };

  return (
    <span className={`date-field${invalid ? ' date-field--error' : ''}`}>
      <input
        id={inputId}
        type="date"
        className="date-field__input"
        value={shown}
        max={today}
        required
        aria-label={t('books.field.readAt')}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${inputId}-error` : undefined}
        onChange={handleChange}
      />
      {invalid ? (
        <span id={`${inputId}-error`} className="field__error" role="alert">
          {t('books.readAtFuture')}
        </span>
      ) : null}
    </span>
  );
}
