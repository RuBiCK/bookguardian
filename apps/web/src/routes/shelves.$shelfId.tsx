import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLibraries, useShelves } from '../api/inventory';
import { BookList } from '../components/BookList';
import { BookSheet } from '../components/BookSheet';
import { EmptyState } from '../components/EmptyState';
import { Fab } from '../components/Fab';
import { Screen } from '../components/Screen';

export const Route = createFileRoute('/shelves/$shelfId')({
  component: ShelfScreen,
});

/** One shelf: cover-first grid with search, status / rating filters and sorting. */
function ShelfScreen() {
  const { t } = useTranslation();
  const { shelfId } = Route.useParams();
  const shelves = useShelves();
  const libraries = useLibraries();
  const shelf = shelves.data?.find((s) => s.id === shelfId);
  const library = libraries.data?.find((l) => l.id === shelf?.libraryId);
  const [adding, setAdding] = useState(false);

  if (shelves.isPending) {
    return (
      <Screen title={t('common.loading')} back={{ to: '/' }}>
        <p className="muted">{t('common.loading')}</p>
      </Screen>
    );
  }
  if (!shelf) {
    return (
      <Screen title={t('errors.notFound')} back={{ to: '/' }}>
        <EmptyState title={t('errors.notFound')} action={<span />} />
      </Screen>
    );
  }

  return (
    <Screen
      title={shelf.name}
      subtitle={library?.name}
      back={{ to: '/libraries/$libraryId', params: { libraryId: shelf.libraryId } }}
    >
      <BookList base={{ shelfId }} searchable onAdd={() => setAdding(true)} />
      <Fab label={t('books.add')} onClick={() => setAdding(true)} />
      <BookSheet open={adding} onClose={() => setAdding(false)} initialShelfId={shelfId} />
    </Screen>
  );
}
