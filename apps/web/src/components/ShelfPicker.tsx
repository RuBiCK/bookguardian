import { useTranslation } from 'react-i18next';
import { useLibraries, useShelves } from '../api/inventory';

interface ShelfPickerProps {
  value: string;
  onChange: (shelfId: string) => void;
  /** Rendered as the accessible label of the select. */
  label: string;
  /** Shelves to leave out (e.g. the one being deleted). */
  exclude?: readonly string[];
  id?: string;
}

/**
 * Native select grouped by library — the fastest one-thumb picker on a phone.
 * Options read "Library › Shelf" so the choice is unambiguous even when two
 * libraries have a "Default" shelf.
 */
export function ShelfPicker({ value, onChange, label, exclude = [], id }: ShelfPickerProps) {
  const { t } = useTranslation();
  const libraries = useLibraries();
  const shelves = useShelves();
  const options = (libraries.data ?? []).map((library) => ({
    library,
    shelves: (shelves.data ?? []).filter(
      (s) => s.libraryId === library.id && !exclude.includes(s.id),
    ),
  }));

  return (
    <select
      id={id}
      className="field__input"
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={libraries.isPending || shelves.isPending}
    >
      {options.length === 0 ? <option value="">{t('common.loading')}</option> : null}
      {options.map(({ library, shelves }) => (
        <optgroup key={library.id} label={library.name}>
          {shelves.map((shelf) => (
            <option key={shelf.id} value={shelf.id}>
              {library.name} › {shelf.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
