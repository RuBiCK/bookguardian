import { useLibraries, useShelves } from './inventory';

/** "Library › Shelf" for a shelf id, from cached data. */
export function useShelfLabel(shelfId: string | undefined): string {
  const libraries = useLibraries();
  const shelves = useShelves();
  const shelf = shelves.data?.find((s) => s.id === shelfId);
  const library = libraries.data?.find((l) => l.id === shelf?.libraryId);
  if (!shelf) return '';
  return library ? `${library.name} › ${shelf.name}` : shelf.name;
}
