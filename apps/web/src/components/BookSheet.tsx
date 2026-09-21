import {
  LOOKUP_MAX_RESULTS,
  type Book,
  type BookDraft,
  type LookupSearchResult,
} from '@bookguardian/shared';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFallbackCover } from '../api/covers';
import { useCreateBook, useDefaults, useUpdateBook } from '../api/inventory';
import { searchBooks } from '../api/lookup';
import {
  bookToForm,
  draftToForm,
  EMPTY_BOOK_FORM,
  formToInput,
  mergeDraftIntoForm,
  SEARCHABLE_FIELDS,
  searchFieldsOf,
  type BookFormErrors,
  type BookFormField,
  type BookFormValues,
  type OnlineSuggestions,
} from '../lib/book-form';
import { showToast } from '../lib/toast';
import { SearchIcon } from './icons';
import { SearchResultsSheet, type SearchState } from './SearchResultsSheet';
import { Sheet } from './Sheet';
import { useShelfLabel } from '../api/shelf-label';
import { ShelfPicker } from './ShelfPicker';

/** Chips show the online value in one line; the field itself holds the whole thing. */
const CHIP_MAX = 48;
const clip = (value: string) =>
  value.length > CHIP_MAX ? `${value.slice(0, CHIP_MAX - 1).trimEnd()}…` : value;

interface BookSheetProps {
  open: boolean;
  onClose: () => void;
  /** Editing an existing book; omit to add a new one. */
  book?: Book;
  /** Pre-fill a new book from a catalogue result (scan / cover search) or a partial guess. */
  draft?: Partial<BookDraft>;
  /** Where a new book should land when the sheet opens from inside a shelf/library. */
  initialShelfId?: string;
  /** Called right after the (optimistic) save, before the server confirms. */
  onSaved?: () => void;
  /** A scan's cover photo: becomes the new book's cover if the catalogue has none. */
  fallbackPhoto?: File | null;
}

/**
 * Add / edit a book from a bottom sheet. Only the title is required; the
 * shelf is pre-selected (last used, or the one you are looking at) so the
 * happy path is: tap +, type a title, tap Save.
 *
 * When adding by hand, "Search online" takes whatever is typed (title,
 * authors, ISBN, publisher, year — any one is enough) to the catalogues and
 * a picked result fills the empty fields; typed fields are kept and get a
 * "Use online value" chip when the result disagrees.
 */
export function BookSheet({
  open,
  onClose,
  book,
  draft,
  initialShelfId,
  onSaved,
  fallbackPhoto,
}: BookSheetProps) {
  const { t } = useTranslation();
  const formId = useId();
  const defaults = useDefaults();
  const [values, setValues] = useState<BookFormValues>(EMPTY_BOOK_FORM);
  const [errors, setErrors] = useState<BookFormErrors>({});
  const [showMore, setShowMore] = useState(false);
  const [shelfId, setShelfId] = useState('');
  const [pickingShelf, setPickingShelf] = useState(false);
  const shelfLabel = useShelfLabel(shelfId);
  // Online search: its state, the request in flight, what was picked and what it disagreed on.
  const [search, setSearch] = useState<SearchState>({ status: 'idle' });
  const inflight = useRef<AbortController | null>(null);
  const [picked, setPicked] = useState<LookupSearchResult | null>(null);
  const [suggestions, setSuggestions] = useState<OnlineSuggestions>({});

  const cancelSearch = useCallback(() => {
    inflight.current?.abort();
    inflight.current = null;
  }, []);

  // Reset the form each time the sheet opens.
  useEffect(() => {
    if (!open) return;
    setValues(book ? bookToForm(book) : draft ? draftToForm(draft) : EMPTY_BOOK_FORM);
    setErrors({});
    setShowMore(Boolean(book ?? draft));
    setPickingShelf(false);
    setShelfId(book?.shelfId ?? initialShelfId ?? '');
    setSearch({ status: 'idle' });
    setPicked(null);
    setSuggestions({});
    return cancelSearch; // leaving the sheet drops a search still running
  }, [open, book, draft, initialShelfId, cancelSearch]);

  // Fall back to the server's "most recently used" shelf once it is known —
  // only when nothing pre-selected one, so this never races the reset above.
  const preselected = book?.shelfId ?? initialShelfId;
  useEffect(() => {
    if (open && !shelfId && !preselected && defaults.data) setShelfId(defaults.data.shelfId);
  }, [open, shelfId, preselected, defaults.data]);

  const failed = useCallback(() => showToast(t('errors.saveFailed'), 'error'), [t]);
  // The sheet closes (and its props reset) before the server answers, so
  // remember which photo went with this save.
  const keepPhoto = useFallbackCover();
  const savedPhoto = useRef<File | null>(null);
  const create = useCreateBook({
    onSuccess: (created) => keepPhoto(created, savedPhoto.current),
    onError: failed,
  });
  const update = useUpdateBook({ onError: failed });
  const saving = create.isPending || update.isPending;

  const set = (field: BookFormField) => (value: string) => {
    cancelSearch(); // the query just changed under a running search
    setValues((v) => ({ ...v, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const searchFields = book ? {} : searchFieldsOf(values);
  const canSearch = Object.keys(searchFields).length > 0;

  const runSearch = () => {
    if (!canSearch) return;
    cancelSearch();
    const controller = new AbortController();
    inflight.current = controller;
    setSearch({ status: 'loading' });
    searchBooks(searchFields, LOOKUP_MAX_RESULTS, controller.signal).then(
      (items) => {
        if (controller.signal.aborted) return;
        setSearch({ status: 'done', items });
      },
      () => {
        if (controller.signal.aborted) return;
        setSearch({ status: 'error' });
      },
    );
  };

  const closeSearch = () => {
    cancelSearch();
    setSearch({ status: 'idle' });
  };

  const pick = (result: LookupSearchResult) => {
    const merged = mergeDraftIntoForm(values, result);
    setValues(merged.values);
    setSuggestions(merged.suggestions);
    setPicked(result);
    setErrors({});
    setShowMore(true); // the filled-in details (and their chips) should be in view
    closeSearch();
  };

  const takeSuggestion = (field: BookFormField) => {
    const value = suggestions[field];
    if (value === undefined) return;
    setValues((v) => ({ ...v, [field]: value }));
    setSuggestions((current) => ({ ...current, [field]: undefined }));
  };

  // Enter from a searchable field searches (Save stays a deliberate tap in the footer).
  const onSearchKey = (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || !canSearch) return;
    event.preventDefault();
    runSearch();
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const result = formToInput(values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    if (!shelfId) return; // defaults still loading — the button is disabled in that state
    // Optimistic: the cache already reflects the change, so close right away.
    if (book) {
      update.mutate({ id: book.id, input: { ...result.input, shelfId } });
    } else {
      savedPhoto.current = fallbackPhoto ?? null;
      create.mutate({ ...result.input, shelfId });
      showToast(t('books.added', { shelf: shelfLabel }));
    }
    onSaved?.();
    onClose();
  };

  const field = (
    name: BookFormField,
    options: {
      placeholder?: string;
      type?: string;
      inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
      multiline?: boolean;
      autoComplete?: string;
      hint?: string;
    } = {},
  ) => {
    const id = `${formId}-${name}`;
    const error = errors[name];
    const label = t(`books.field.${name}`);
    const searchable = !book && (SEARCHABLE_FIELDS as readonly string[]).includes(name);
    const suggestion = suggestions[name];
    const props = {
      id,
      name,
      className: 'field__input',
      value: values[name],
      placeholder: options.placeholder,
      'aria-invalid': error ? true : undefined,
      'aria-describedby': error ? `${id}-error` : undefined,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        set(name)(e.target.value),
      onKeyDown: searchable ? onSearchKey : undefined,
      enterKeyHint: searchable ? ('search' as const) : undefined,
    };
    return (
      <div className={`field${error ? ' field--error' : ''}`}>
        <label className="field__label" htmlFor={id}>
          {label}
        </label>
        {options.multiline ? (
          <textarea rows={3} {...props} />
        ) : (
          <input
            type={options.type ?? 'text'}
            inputMode={options.inputMode}
            autoComplete={options.autoComplete ?? 'off'}
            {...props}
          />
        )}
        {error ? (
          <p id={`${id}-error`} className="field__error">
            {errorMessage(name, error)}
          </p>
        ) : options.hint ? (
          <p className="field__hint">{options.hint}</p>
        ) : null}
        {suggestion !== undefined ? (
          <button
            type="button"
            className="field__suggestion"
            onClick={() => takeSuggestion(name)}
            aria-label={t('books.search.useOnlineLabel', { field: label, value: suggestion })}
            data-testid={`suggestion-${name}`}
          >
            <span>{t('books.search.useOnline', { value: clip(suggestion) })}</span>
          </button>
        ) : null}
      </div>
    );
  };

  const errorMessage = (name: BookFormField, kind: 'required' | 'invalid') => {
    if (name === 'title') return t('books.titleRequired');
    if (name === 'isbn') return t('books.isbnInvalid');
    if (name === 'coverUrl') return t('books.coverUrlInvalid');
    return kind === 'required' ? t('books.titleRequired') : t('errors.validation');
  };

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={book ? t('books.edit') : t('books.add')}
        footer={
          <button
            type="submit"
            form={formId}
            className="button button--primary button--block"
            disabled={saving || !shelfId}
          >
            {saving ? t('common.saving') : t('common.save')}
          </button>
        }
      >
        <form id={formId} className="form" onSubmit={submit} noValidate>
          {field('title', { placeholder: t('books.field.titlePlaceholder') })}
          {field('authors', { placeholder: t('books.field.authorsPlaceholder') })}

          {!book ? (
            <>
              <button
                type="button"
                className="button button--block"
                disabled={!canSearch}
                onClick={runSearch}
                data-testid="search-online"
              >
                <SearchIcon />
                {t('books.search.action')}
              </button>
              {picked ? (
                <p className="form__note" data-testid="filled-from">
                  {t('books.search.filledFrom', {
                    source: t(`scan.result.source.${picked.source}`),
                  })}
                </p>
              ) : null}
            </>
          ) : null}

          <div className="field">
            <span className="field__label">{t('books.shelf')}</span>
            {pickingShelf ? (
              <ShelfPicker value={shelfId} onChange={setShelfId} label={t('books.shelf')} />
            ) : (
              <div className="field__static">
                <span data-testid="shelf-label">{shelfLabel || t('common.loading')}</span>
                <button
                  type="button"
                  className="button button--ghost button--small"
                  onClick={() => setPickingShelf(true)}
                >
                  {t('books.changeShelf')}
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            className="button button--ghost button--small form__toggle"
            aria-expanded={showMore}
            onClick={() => setShowMore((v) => !v)}
          >
            {showMore ? t('books.less') : t('books.more')}
          </button>

          {showMore ? (
            <>
              {field('isbn', {
                placeholder: t('books.field.isbnPlaceholder'),
                inputMode: 'numeric',
              })}
              {field('subtitle')}
              {field('publisher')}
              <div className="form__row">
                {field('year', { inputMode: 'numeric' })}
                {field('pages', { inputMode: 'numeric' })}
              </div>
              {field('language', { placeholder: t('books.field.languagePlaceholder') })}
              {field('categories', { placeholder: t('books.field.categoriesPlaceholder') })}
              {field('coverUrl', {
                type: 'url',
                inputMode: 'url',
                placeholder: 'https://…',
                hint: t('books.field.coverUrlHint'),
              })}
              {field('description', { multiline: true })}
              {field('notes', { multiline: true })}
            </>
          ) : null}
        </form>
      </Sheet>
      {/* Stacked above the form; a fixed panel must not sit inside the animated one. */}
      {open && !book ? (
        <SearchResultsSheet
          state={search}
          onPick={pick}
          onClose={closeSearch}
          onRetry={runSearch}
        />
      ) : null}
    </>
  );
}
