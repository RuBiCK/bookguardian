import { READ_STATUSES } from '@bookguardian/shared';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBook, useDeleteBook, useMoveBook, useSetReadStatus } from '../api/inventory';
import { BookSheet } from '../components/BookSheet';
import { ConfirmSheet } from '../components/ConfirmSheet';
import { EmptyState } from '../components/EmptyState';
import { BookIcon, PencilIcon, StarIcon, TrashIcon } from '../components/icons';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { useShelfLabel } from '../api/shelf-label';
import { ShelfPicker } from '../components/ShelfPicker';
import { formatDate } from '../lib/format';
import { showToast } from '../lib/toast';

export const Route = createFileRoute('/books/$bookId')({
  component: BookDetailScreen,
});

/** Book detail: cover, metadata, quick read-status toggle, move / edit / delete. */
function BookDetailScreen() {
  const { t, i18n } = useTranslation();
  const { bookId } = Route.useParams();
  const navigate = useNavigate();
  const book = useBook(bookId);
  const shelfLabel = useShelfLabel(book.data?.shelfId);
  const [editing, setEditing] = useState(false);
  const [moving, setMoving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [targetShelf, setTargetShelf] = useState('');

  const readStatus = useSetReadStatus({
    onError: () => showToast(t('errors.saveFailed'), 'error'),
  });
  const moveBook = useMoveBook({ onError: () => showToast(t('errors.saveFailed'), 'error') });
  const deleteBook = useDeleteBook({
    onError: () => showToast(t('errors.deleteFailed'), 'error'),
  });

  if (book.isPending) {
    return (
      <Screen title={t('common.loading')} back={{ to: '/' }}>
        <p className="muted">{t('common.loading')}</p>
      </Screen>
    );
  }
  if (!book.data) {
    return (
      <Screen title={t('errors.notFound')} back={{ to: '/' }}>
        <EmptyState title={t('books.detail.notFound')} action={<span />} />
      </Screen>
    );
  }

  const b = book.data;
  const authors = b.authors.length > 0 ? b.authors.join(', ') : t('books.unknownAuthor');
  const rows: [string, string | null][] = [
    [t('books.detail.publisher'), b.publisher],
    [t('books.detail.isbn'), b.isbn13 ?? b.isbn10],
    [t('books.detail.language'), b.language],
  ];

  return (
    <Screen
      title={b.title}
      subtitle={authors}
      back={{ to: '/shelves/$shelfId', params: { shelfId: b.shelfId } }}
      actions={
        <button
          type="button"
          className="icon-button"
          aria-label={t('common.edit')}
          onClick={() => setEditing(true)}
        >
          <PencilIcon />
        </button>
      }
    >
      <div className="detail">
        <div className="detail__cover">
          {b.coverUrl ? (
            <img src={b.coverUrl} alt="" />
          ) : (
            <span className="detail__cover-placeholder" aria-label={t('books.noCover')}>
              <BookIcon />
            </span>
          )}
        </div>

        <div className="detail__facts">
          {b.subtitle ? <p className="detail__subtitle">{b.subtitle}</p> : null}
          {b.publishedDate || b.pages ? (
            <p className="muted">
              {[
                b.publishedDate ? t('books.detail.published', { date: b.publishedDate }) : null,
                b.pages ? t('books.detail.pages', { count: b.pages }) : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          ) : null}
          {b.rating !== null ? (
            <p className="stars" aria-label={t('books.detail.rating', { rating: b.rating })}>
              {[1, 2, 3, 4, 5].map((n) => (
                <StarIcon key={n} filled={n <= b.rating!} />
              ))}
            </p>
          ) : null}
          {b.categories.length > 0 ? (
            <p className="tags">
              {b.categories.map((c) => (
                <span key={c} className="pill">
                  {c}
                </span>
              ))}
            </p>
          ) : null}
        </div>
      </div>

      <div className="segmented segmented--block" role="group" aria-label={t('readStatus.label')}>
        {READ_STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            className="segmented__option"
            aria-pressed={b.readStatus === status}
            onClick={() => readStatus.set(b, status)}
          >
            {t(`readStatus.${status}`)}
          </button>
        ))}
      </div>

      <ul className="list">
        <li className="list__row">
          <span className="list__label">{t('books.shelf')}</span>
          <span className="list__value">
            <span data-testid="book-shelf">{shelfLabel}</span>{' '}
            <button
              type="button"
              className="button button--ghost button--small"
              onClick={() => {
                setTargetShelf(b.shelfId);
                setMoving(true);
              }}
            >
              {t('common.move')}
            </button>
          </span>
        </li>
        {rows.map(([label, value]) =>
          value ? (
            <li key={label} className="list__row">
              <span className="list__label">{label}</span>
              <span className="list__value">{value}</span>
            </li>
          ) : null,
        )}
        {b.readAt ? (
          <li className="list__row">
            <span className="list__label">{t('books.field.readAt')}</span>
            <span className="list__value">{formatDate(b.readAt, i18n.language)}</span>
          </li>
        ) : null}
        <li className="list__row">
          <span className="list__label">{t('books.detail.addedLabel')}</span>
          <span className="list__value">{formatDate(b.addedAt, i18n.language)}</span>
        </li>
      </ul>

      {b.description ? (
        <section className="prose">
          <h2 className="prose__title">{t('books.detail.description')}</h2>
          <p>{b.description}</p>
        </section>
      ) : null}
      {b.notes ? (
        <section className="prose">
          <h2 className="prose__title">{t('books.detail.notes')}</h2>
          <p>{b.notes}</p>
        </section>
      ) : null}

      <button
        type="button"
        className="button button--danger-ghost button--block"
        onClick={() => setDeleting(true)}
      >
        <TrashIcon /> {t('common.delete')}
      </button>

      <BookSheet open={editing} onClose={() => setEditing(false)} book={b} />

      <Sheet
        open={moving}
        title={t('books.moveToShelf')}
        onClose={() => setMoving(false)}
        footer={
          <button
            type="button"
            className="button button--primary button--block"
            disabled={!targetShelf || targetShelf === b.shelfId}
            onClick={() => {
              moveBook.mutate({ id: b.id, shelfId: targetShelf });
              setMoving(false);
            }}
          >
            {t('common.move')}
          </button>
        }
      >
        <div className="field">
          <span className="field__label">{t('books.shelf')}</span>
          <ShelfPicker value={targetShelf} onChange={setTargetShelf} label={t('books.shelf')} />
        </div>
      </Sheet>

      <ConfirmSheet
        open={deleting}
        title={t('common.delete')}
        message={t('books.deleteConfirm', { title: b.title })}
        confirmLabel={t('common.delete')}
        onClose={() => setDeleting(false)}
        onConfirm={() => {
          deleteBook.mutate(b);
          showToast(t('books.deleted'));
          void navigate({ to: '/shelves/$shelfId', params: { shelfId: b.shelfId } });
        }}
      />
    </Screen>
  );
}
