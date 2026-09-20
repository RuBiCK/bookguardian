import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBook, useDeleteBook, useMoveBook, useSetReadStatus } from '../../api/inventory';
import { BookCover } from '../../components/BookCover';
import { BookSheet } from '../../components/BookSheet';
import { ConfirmSheet } from '../../components/ConfirmSheet';
import { CoverSheet } from '../../components/CoverSheet';
import { EmptyState } from '../../components/EmptyState';
import { PencilIcon, TrashIcon } from '../../components/icons';
import { LendingPanel } from '../../components/LendingPanel';
import { ReadingPanel } from '../../components/ReadingPanel';
import { Screen } from '../../components/Screen';
import { Sheet } from '../../components/Sheet';
import { useShelfLabel } from '../../api/shelf-label';
import { ShelfPicker } from '../../components/ShelfPicker';
import { formatDate } from '../../lib/format';
import { showToast } from '../../lib/toast';

export const Route = createFileRoute('/_app/books/$bookId')({
  component: BookDetailScreen,
});

/**
 * The book page: large cover, title and authors, metadata chips, your
 * rating / status / dates, lending, description, location, notes, and the
 * move / edit / delete actions.
 */
function BookDetailScreen() {
  const { t, i18n } = useTranslation();
  const { bookId } = Route.useParams();
  const navigate = useNavigate();
  const book = useBook(bookId);
  const shelfLabel = useShelfLabel(book.data?.shelfId);
  const [editing, setEditing] = useState(false);
  const [changingCover, setChangingCover] = useState(false);
  const [moving, setMoving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [targetShelf, setTargetShelf] = useState('');

  const reading = useSetReadStatus({
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
  const chips = [
    b.publishedDate,
    b.pages ? t('books.detail.pages', { count: b.pages }) : null,
    b.language,
    ...b.categories,
  ].filter((chip): chip is string => Boolean(chip));
  const rows: [string, string | null][] = [
    [t('books.detail.publisher'), b.publisher],
    [t('books.detail.isbn'), b.isbn13 ?? b.isbn10],
    [t('books.detail.addedLabel'), formatDate(b.addedAt, i18n.language)],
  ];

  return (
    <Screen
      title={b.title}
      back={{ to: '/shelves/$shelfId', params: { shelfId: b.shelfId } }}
      hero={
        <div className="hero">
          <button
            type="button"
            className="hero__cover"
            aria-label={t('books.cover.change')}
            onClick={() => setChangingCover(true)}
          >
            <BookCover book={b} sizes="168px" />
          </button>
          {b.coverPending ? (
            <p className="muted hero__cover-status" role="status">
              {t('books.cover.pending')}
            </p>
          ) : null}
          <h1 className="hero__title">{b.title}</h1>
          {b.subtitle ? <p className="hero__subtitle">{b.subtitle}</p> : null}
          <p className="hero__authors">{authors}</p>
          {chips.length > 0 ? (
            <p className="tags tags--center">
              {chips.map((chip) => (
                <span key={chip} className="pill">
                  {chip}
                </span>
              ))}
            </p>
          ) : null}
        </div>
      }
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
      <ReadingPanel book={b} actions={reading} />
      <LendingPanel book={b} />

      {b.description ? (
        <section className="prose">
          <h2 className="prose__title">{t('books.detail.description')}</h2>
          <p>{b.description}</p>
        </section>
      ) : null}

      <ul className="list">
        <li className="list__row">
          <span className="list__label">{t('books.detail.location')}</span>
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
      </ul>

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
      <CoverSheet open={changingCover} book={b} onClose={() => setChangingCover(false)} />

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
