import type { LibraryWithCounts, ShelfWithCount } from '@bookguardian/shared';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useCreateShelf,
  useDeleteLibrary,
  useDeleteShelf,
  useLibraries,
  useReorderShelves,
  useShelves,
  useUpdateLibrary,
  useUpdateShelf,
} from '../../api/inventory';
import { BookList } from '../../components/BookList';
import { BookSheet } from '../../components/BookSheet';
import { ConfirmSheet } from '../../components/ConfirmSheet';
import { EmptyState } from '../../components/EmptyState';
import { Fab } from '../../components/Fab';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronRightIcon,
  PencilIcon,
  PlusIcon,
  ShelfIcon,
  TrashIcon,
} from '../../components/icons';
import { NameSheet } from '../../components/NameSheet';
import { Screen } from '../../components/Screen';
import { showToast } from '../../lib/toast';

export const Route = createFileRoute('/_app/libraries/$libraryId')({
  component: LibraryDetailScreen,
});

type ShelfSheet = { kind: 'add' } | { kind: 'edit'; shelf: ShelfWithCount } | null;
type LibraryView = 'shelves' | 'books';

/**
 * One library: its shelves with counts, plus inline management (rename,
 * reorder, delete). The "Books" view lists every book in the library with
 * the same filters and sorting as a shelf.
 */
function LibraryDetailScreen() {
  const { t } = useTranslation();
  const { libraryId } = Route.useParams();
  const navigate = useNavigate();
  const libraries = useLibraries();
  const shelves = useShelves(libraryId);
  const library = libraries.data?.find((l) => l.id === libraryId);

  const [view, setView] = useState<LibraryView>('shelves');
  const [managing, setManaging] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingLibrary, setEditingLibrary] = useState(false);
  const [deletingLibrary, setDeletingLibrary] = useState(false);
  const [shelfSheet, setShelfSheet] = useState<ShelfSheet>(null);
  const [deletingShelf, setDeletingShelf] = useState<ShelfWithCount | null>(null);

  const saveFailed = () => showToast(t('errors.saveFailed'), 'error');
  const deleteFailed = () => showToast(t('errors.deleteFailed'), 'error');
  const updateLibrary = useUpdateLibrary({ onError: saveFailed });
  const deleteLibrary = useDeleteLibrary({ onError: deleteFailed });
  const createShelf = useCreateShelf({ onError: saveFailed });
  const updateShelf = useUpdateShelf({ onError: saveFailed });
  const reorderShelves = useReorderShelves({ onError: saveFailed });
  const deleteShelf = useDeleteShelf({ onError: deleteFailed });

  if (libraries.isPending || shelves.isPending) {
    return (
      <Screen title={t('common.loading')} back={{ to: '/' }}>
        <p className="muted">{t('common.loading')}</p>
      </Screen>
    );
  }
  if (!library) {
    return (
      <Screen title={t('errors.notFound')} back={{ to: '/' }}>
        <EmptyState title={t('errors.notFound')} action={<span />} />
      </Screen>
    );
  }

  const list = shelves.data ?? [];
  const move = (index: number, delta: number) => {
    const ids = list.map((s) => s.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    reorderShelves.mutate({ libraryId, shelfIds: ids });
  };

  return (
    <Screen
      title={library.name}
      subtitle={library.location ?? undefined}
      back={{ to: '/' }}
      actions={
        view === 'shelves' ? (
          <button
            type="button"
            className="button button--ghost button--small"
            aria-pressed={managing}
            onClick={() => setManaging((v) => !v)}
          >
            {managing ? t('common.done') : t('common.manage')}
          </button>
        ) : undefined
      }
    >
      <div className="segmented segmented--block" role="group" aria-label={t('library.title')}>
        {(['shelves', 'books'] as const).map((option) => (
          <button
            key={option}
            type="button"
            className="segmented__option"
            aria-pressed={view === option}
            onClick={() => setView(option)}
          >
            {t(`library.view.${option}`)}
          </button>
        ))}
      </div>

      {view === 'books' ? (
        <BookList base={{ libraryId }} searchable onAdd={() => setAdding(true)} />
      ) : null}

      {view === 'books' ? null : managing ? (
        <div className="button-row manage-bar">
          <button type="button" className="button" onClick={() => setEditingLibrary(true)}>
            <PencilIcon /> {t('library.editLibrary')}
          </button>
          <button
            type="button"
            className="button button--danger-ghost"
            onClick={() => setDeletingLibrary(true)}
          >
            <TrashIcon /> {t('common.delete')}
          </button>
        </div>
      ) : null}

      {view === 'books' ? null : list.length === 0 ? (
        <EmptyState
          title={t('library.shelvesEmpty.title')}
          body={t('library.shelvesEmpty.body')}
          icon={<ShelfIcon />}
          action={
            <button
              type="button"
              className="button button--primary"
              onClick={() => setShelfSheet({ kind: 'add' })}
            >
              {t('library.addShelf')}
            </button>
          }
        />
      ) : (
        <ul className="cards" data-testid="shelf-list">
          {list.map((shelf, index) => (
            <li key={shelf.id}>
              {managing ? (
                <ShelfManageRow
                  shelf={shelf}
                  first={index === 0}
                  last={index === list.length - 1}
                  onUp={() => move(index, -1)}
                  onDown={() => move(index, +1)}
                  onEdit={() => setShelfSheet({ kind: 'edit', shelf })}
                  onDelete={() => setDeletingShelf(shelf)}
                />
              ) : (
                <Link
                  to="/shelves/$shelfId"
                  params={{ shelfId: shelf.id }}
                  className="card card--row"
                >
                  <span className="card__icon">
                    <ShelfIcon />
                  </span>
                  <span className="card__body">
                    <span className="card__title">{shelf.name}</span>
                    <span className="card__meta">
                      {t('count.books', { count: shelf.bookCount })}
                    </span>
                  </span>
                  <ChevronRightIcon className="card__chevron" />
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}

      {view === 'shelves' && managing ? (
        <>
          <p className="muted">{t('library.reorderHint')}</p>
          <button
            type="button"
            className="button button--block"
            onClick={() => setShelfSheet({ kind: 'add' })}
          >
            <PlusIcon /> {t('library.addShelf')}
          </button>
        </>
      ) : null}

      <Fab label={t('books.add')} onClick={() => setAdding(true)} />
      <BookSheet open={adding} onClose={() => setAdding(false)} initialShelfId={list[0]?.id} />

      <NameSheet
        open={editingLibrary}
        title={t('library.editLibrary')}
        nameLabel={t('library.name')}
        namePlaceholder={t('library.namePlaceholder')}
        withLocation
        initial={{ name: library.name, location: library.location ?? '' }}
        onClose={() => setEditingLibrary(false)}
        onSubmit={({ name, location }) =>
          updateLibrary.mutate({ id: libraryId, input: { name, location: location || null } })
        }
      />
      <LibraryDeleteSheet
        open={deletingLibrary}
        library={library}
        shelfIds={list.map((s) => s.id)}
        canDelete={(libraries.data?.length ?? 0) > 1}
        onClose={() => setDeletingLibrary(false)}
        onConfirm={(moveBooksTo) => {
          deleteLibrary.mutate({ id: libraryId, moveBooksTo });
          void navigate({ to: '/' });
        }}
      />

      <NameSheet
        open={shelfSheet !== null}
        title={shelfSheet?.kind === 'edit' ? t('library.editShelf') : t('library.addShelf')}
        nameLabel={t('library.shelfName')}
        namePlaceholder={t('library.shelfNamePlaceholder')}
        initial={shelfSheet?.kind === 'edit' ? { name: shelfSheet.shelf.name } : undefined}
        onClose={() => setShelfSheet(null)}
        onSubmit={({ name }) => {
          if (shelfSheet?.kind === 'edit') {
            updateShelf.mutate({ id: shelfSheet.shelf.id, input: { name } });
          } else {
            createShelf.mutate({ libraryId, name });
          }
        }}
      />
      <ConfirmSheet
        open={deletingShelf !== null}
        title={t('library.editShelf')}
        message={t('library.deleteShelfConfirm', { name: deletingShelf?.name ?? '' })}
        confirmLabel={t('common.delete')}
        blockedReason={list.length <= 1 ? t('library.cannotDeleteLastShelf') : undefined}
        moveBooks={
          deletingShelf && deletingShelf.bookCount > 0
            ? {
                count: deletingShelf.bookCount,
                exclude: [deletingShelf.id],
                hint: t('library.moveBooksTo'),
              }
            : undefined
        }
        onClose={() => setDeletingShelf(null)}
        onConfirm={(moveBooksTo) => {
          if (deletingShelf) deleteShelf.mutate({ id: deletingShelf.id, moveBooksTo });
        }}
      />
    </Screen>
  );
}

interface ShelfManageRowProps {
  shelf: ShelfWithCount;
  first: boolean;
  last: boolean;
  onUp: () => void;
  onDown: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function ShelfManageRow({
  shelf,
  first,
  last,
  onUp,
  onDown,
  onEdit,
  onDelete,
}: ShelfManageRowProps) {
  const { t } = useTranslation();
  return (
    <div className="card card--row card--manage" data-testid="shelf-row">
      <span className="card__body">
        <span className="card__title">{shelf.name}</span>
        <span className="card__meta">{t('count.books', { count: shelf.bookCount })}</span>
      </span>
      <span className="card__actions">
        <button
          type="button"
          className="icon-button"
          aria-label={`${t('common.moveUp')}: ${shelf.name}`}
          disabled={first}
          onClick={onUp}
        >
          <ArrowUpIcon />
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label={`${t('common.moveDown')}: ${shelf.name}`}
          disabled={last}
          onClick={onDown}
        >
          <ArrowDownIcon />
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label={`${t('common.edit')}: ${shelf.name}`}
          onClick={onEdit}
        >
          <PencilIcon />
        </button>
        <button
          type="button"
          className="icon-button icon-button--danger"
          aria-label={`${t('common.delete')}: ${shelf.name}`}
          onClick={onDelete}
        >
          <TrashIcon />
        </button>
      </span>
    </div>
  );
}

interface LibraryDeleteSheetProps {
  open: boolean;
  library: LibraryWithCounts;
  shelfIds: string[];
  canDelete: boolean;
  onClose: () => void;
  onConfirm: (moveBooksTo?: string) => void;
}

function LibraryDeleteSheet({
  open,
  library,
  shelfIds,
  canDelete,
  onClose,
  onConfirm,
}: LibraryDeleteSheetProps) {
  const { t } = useTranslation();
  return (
    <ConfirmSheet
      open={open}
      title={t('library.editLibrary')}
      message={t('library.deleteConfirm', { name: library.name })}
      confirmLabel={t('common.delete')}
      blockedReason={canDelete ? undefined : t('library.cannotDeleteLast')}
      moveBooks={
        library.bookCount > 0
          ? { count: library.bookCount, exclude: shelfIds, hint: t('library.moveBooksTo') }
          : undefined
      }
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}
