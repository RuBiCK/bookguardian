import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useActiveLendings, useReturnLending } from '../api/lending';
import { EmptyState } from '../components/EmptyState';
import { BookCover } from '../components/BookCover';
import { LendingIcon } from '../components/icons';
import { LendingMeta } from '../components/LendingPanel';
import { Screen } from '../components/Screen';
import { groupByBorrower } from '../lib/lending';
import { showToast } from '../lib/toast';

export const Route = createFileRoute('/lending')({
  component: LendingScreen,
});

/** Lending tab: every book that is out, by borrower, with a one-tap "Returned". */
function LendingScreen() {
  const { t } = useTranslation();
  const lendings = useActiveLendings();
  const giveBack = useReturnLending({
    onError: () => showToast(t('errors.saveFailed'), 'error'),
  });

  const items = lendings.data ?? [];
  const groups = groupByBorrower(items);
  const overdue = items.filter((l) => l.overdue).length;

  return (
    <Screen title={t('lending.title')}>
      {lendings.isPending ? (
        <p className="muted">{t('common.loading')}</p>
      ) : lendings.isError ? (
        <EmptyState
          title={t('errors.generic')}
          body={t('errors.network')}
          action={
            <button type="button" className="button" onClick={() => void lendings.refetch()}>
              {t('common.retry')}
            </button>
          }
        />
      ) : items.length === 0 ? (
        <EmptyState
          title={t('lending.empty.title')}
          body={t('lending.empty.body')}
          icon={<LendingIcon />}
          action={
            <Link to="/" className="button button--primary">
              {t('nav.library')}
            </Link>
          }
        />
      ) : (
        <>
          <p className="muted lending__summary" data-testid="lending-summary">
            {t('lending.summary', { count: items.length })}
            {overdue > 0 ? (
              <>
                {' · '}
                <span className="lending__overdue-count">
                  {t('lending.overdueCount', { count: overdue })}
                </span>
              </>
            ) : null}
          </p>
          {groups.map((group) => (
            <section
              key={group.name.toLocaleLowerCase()}
              className="borrower"
              aria-labelledby={`borrower-${group.name.toLocaleLowerCase()}`}
              data-testid="borrower-group"
            >
              <h2 id={`borrower-${group.name.toLocaleLowerCase()}`} className="borrower__name">
                {group.name}
                {group.contact ? (
                  <span className="borrower__contact muted">{group.contact}</span>
                ) : null}
              </h2>
              <ul className="cards">
                {group.items.map((lending) => (
                  <li
                    key={lending.id}
                    className={`card lending-row${lending.overdue ? ' lending-row--overdue' : ''}`}
                    data-testid="lending-row"
                  >
                    <Link
                      to="/books/$bookId"
                      params={{ bookId: lending.bookId }}
                      className="lending-row__book"
                      aria-label={t('lending.openBook', { title: lending.book.title })}
                    >
                      <span className="lending-row__cover">
                        <BookCover book={lending.book} sizes="40px" compact />
                      </span>
                      <span className="card__body">
                        <span className="card__title">{lending.book.title}</span>
                        <span className="card__meta">
                          <LendingMeta lending={lending} />
                        </span>
                      </span>
                    </Link>
                    <button
                      type="button"
                      className="button button--small"
                      onClick={() => {
                        giveBack.mutate(lending);
                        showToast(t('lending.returnedToast', { title: lending.book.title }));
                      }}
                    >
                      {t('lending.markReturned')}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </Screen>
  );
}
