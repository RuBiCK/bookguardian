import { daysOut, type Book, type LendingWithBook } from '@bookguardian/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { activeLendingOf, useBookLendings, useReturnLending } from '../api/lending';
import { formatDate } from '../lib/format';
import { showToast } from '../lib/toast';
import { LendingIcon } from './icons';
import { LendSheet } from './LendSheet';
import { Skeleton } from './Skeleton';

interface LendingPanelProps {
  book: Book;
}

/** "12 days out" / "Out today", plus the due day or the overdue badge. */
export function LendingMeta({ lending }: { lending: LendingWithBook }) {
  const { t, i18n } = useTranslation();
  const days = daysOut(lending);
  return (
    <span className="lending__meta">
      <span>{days === 0 ? t('lending.outToday') : t('lending.daysOut', { count: days })}</span>
      {lending.overdue ? (
        <span className="pill pill--danger">{t('lending.overdue')}</span>
      ) : lending.dueAt ? (
        <span>{t('lending.due', { date: formatDate(lending.dueAt, i18n.language) })}</span>
      ) : null}
    </span>
  );
}

/**
 * The book page's lending section: who has the book right now (with a
 * one-tap "Returned"), or a "Lend" button, followed by the lending history.
 */
export function LendingPanel({ book }: LendingPanelProps) {
  const { t, i18n } = useTranslation();
  const lendings = useBookLendings(book.id);
  const [lending, setLending] = useState(false);
  const giveBack = useReturnLending({
    onError: () => showToast(t('errors.saveFailed'), 'error'),
  });

  const current = activeLendingOf(lendings.data);
  const past = lendings.data?.filter((l) => l.returnedAt !== null) ?? [];

  return (
    <section className="lending" aria-label={t('lending.title')} data-testid="lending-panel">
      <h2 className="lending__title">{t('lending.title')}</h2>

      {lendings.isPending ? (
        <Skeleton variant="block" height={44} />
      ) : current ? (
        <div className="lending__current">
          <span className="lending__icon" aria-hidden="true">
            <LendingIcon />
          </span>
          <div className="lending__body">
            <span className="lending__who">
              {t('lending.lentTo', { name: current.borrowerName })}
            </span>
            {current.borrowerContact ? (
              <span className="lending__contact muted">{current.borrowerContact}</span>
            ) : null}
            <span className="muted">
              {t('lending.since', { date: formatDate(current.lentAt, i18n.language) })}
            </span>
            <LendingMeta lending={current} />
          </div>
          <button
            type="button"
            className="button button--small"
            onClick={() => {
              giveBack.mutate(current);
              showToast(t('lending.returnedToast', { title: book.title }));
            }}
          >
            {t('lending.markReturned')}
          </button>
        </div>
      ) : (
        <button type="button" className="button button--block" onClick={() => setLending(true)}>
          <LendingIcon /> {t('lending.lend')}
        </button>
      )}

      {past.length > 0 ? (
        <>
          <h3 className="lending__subtitle">{t('lending.history')}</h3>
          <ul className="list" data-testid="lending-history">
            {past.map((l) => (
              <li key={l.id} className="list__row">
                <span className="list__label">{l.borrowerName}</span>
                <span className="list__value">
                  {formatDate(l.lentAt, i18n.language)} → {formatDate(l.returnedAt!, i18n.language)}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <LendSheet open={lending} book={book} onClose={() => setLending(false)} />
    </section>
  );
}
