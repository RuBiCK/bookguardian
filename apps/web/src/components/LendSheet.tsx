import { localDate, type Book } from '@bookguardian/shared';
import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBorrowers, useLendBook } from '../api/lending';
import { ApiClientError } from '../api/client';
import { emptyToNull } from '../lib/format';
import { suggestBorrowers } from '../lib/lending';
import { showToast } from '../lib/toast';
import { Sheet } from './Sheet';

interface LendSheetProps {
  open: boolean;
  book: Book;
  onClose: () => void;
}

/**
 * "Lend this book" bottom sheet: a name (with one-tap suggestions from
 * previous borrowers), an optional contact / note and an optional due date.
 * Lending is optimistic, so the sheet closes as soon as the user taps Lend.
 */
export function LendSheet({ open, book, onClose }: LendSheetProps) {
  const { t } = useTranslation();
  const formId = useId();
  const borrowers = useBorrowers();
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName('');
    setContact('');
    setDueAt('');
    setTouched(false);
  }, [open]);

  const lend = useLendBook({
    onError: (error) =>
      showToast(
        error instanceof ApiClientError && error.code === 'already_lent'
          ? t('lending.alreadyLent')
          : t('errors.saveFailed'),
        'error',
      ),
  });

  const valid = name.trim().length > 0;
  const showError = touched && !valid;
  const suggestions = suggestBorrowers(borrowers.data ?? [], name);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!valid) return;
    lend.mutate({
      book,
      input: {
        bookId: book.id,
        borrowerName: name.trim(),
        borrowerContact: emptyToNull(contact),
        dueAt: dueAt || null,
      },
    });
    showToast(t('lending.lentToast', { name: name.trim() }));
    onClose();
  };

  return (
    <Sheet
      open={open}
      title={t('lending.lendTitle', { title: book.title })}
      onClose={onClose}
      footer={
        <button
          type="submit"
          form={formId}
          className="button button--primary button--block"
          disabled={!valid}
        >
          {t('lending.lend')}
        </button>
      }
    >
      <form id={formId} className="form" noValidate onSubmit={submit}>
        <div className={`field${showError ? ' field--error' : ''}`}>
          <label className="field__label" htmlFor={`${formId}-name`}>
            {t('lending.field.borrower')}
          </label>
          <input
            id={`${formId}-name`}
            className="field__input"
            value={name}
            placeholder={t('lending.field.borrowerPlaceholder')}
            autoComplete="off"
            autoCapitalize="words"
            enterKeyHint="done"
            aria-invalid={showError || undefined}
            aria-describedby={showError ? `${formId}-name-error` : undefined}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setTouched(true)}
          />
          {showError ? (
            <p id={`${formId}-name-error`} className="field__error">
              {t('lending.borrowerRequired')}
            </p>
          ) : null}
          {suggestions.length > 0 ? (
            <div
              className="chips chips--wrap"
              role="group"
              aria-label={t('lending.recentBorrowers')}
            >
              {suggestions.map((b) => (
                <button
                  key={b.name}
                  type="button"
                  className="chip"
                  onClick={() => {
                    setName(b.name);
                    if (!contact && b.contact) setContact(b.contact);
                  }}
                >
                  {b.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="field">
          <label className="field__label" htmlFor={`${formId}-contact`}>
            {t('lending.field.contact')}{' '}
            <span className="field__hint">({t('common.optional')})</span>
          </label>
          <input
            id={`${formId}-contact`}
            className="field__input"
            value={contact}
            placeholder={t('lending.field.contactPlaceholder')}
            autoComplete="off"
            onChange={(e) => setContact(e.target.value)}
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor={`${formId}-due`}>
            {t('lending.field.dueAt')} <span className="field__hint">({t('common.optional')})</span>
          </label>
          <input
            id={`${formId}-due`}
            type="date"
            className="field__input"
            value={dueAt}
            min={localDate()}
            onChange={(e) => setDueAt(e.target.value)}
          />
        </div>
      </form>
    </Sheet>
  );
}
