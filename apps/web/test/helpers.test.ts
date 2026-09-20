import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  bookToForm,
  draftToForm,
  draftToInput,
  EMPTY_BOOK_FORM,
  formToInput,
} from '../src/lib/book-form';
import { emptyToNull, formatDate, joinList, parseIsbn, splitList } from '../src/lib/format';
import { clearToasts, dismissToast, showToast, useToasts } from '../src/lib/toast';

describe('catalogue drafts', () => {
  const draft = {
    isbn10: '0441013597',
    isbn13: '9780441013593',
    title: 'Dune',
    subtitle: 'Book one',
    authors: ['Frank Herbert'],
    publisher: 'Ace',
    publishedDate: '1965',
    pages: 412,
    language: 'en',
    coverUrl: 'https://c/x.jpg',
    categories: ['Sci-Fi', 'Classics'],
    description: 'Desert.',
    source: 'open_library' as const,
    sourceId: null,
  };

  it('pre-fills the form from a full draft and from partial guesses', () => {
    expect(draftToForm(draft)).toEqual({
      title: 'Dune',
      authors: 'Frank Herbert',
      isbn: '9780441013593',
      subtitle: 'Book one',
      publisher: 'Ace',
      year: '1965',
      pages: '412',
      language: 'en',
      categories: 'Sci-Fi, Classics',
      // Never pre-filled: the API fetches its own copy of the provider cover by ISBN.
      coverUrl: '',
      description: 'Desert.',
      notes: '',
    });
    expect(draftToForm({ isbn10: '0441013597' })).toEqual({
      ...EMPTY_BOOK_FORM,
      isbn: '0441013597',
    });
    expect(draftToForm({ title: 'Guess' })).toEqual({ ...EMPTY_BOOK_FORM, title: 'Guess' });
    expect(draftToForm({ ...draft, subtitle: null, pages: null, coverUrl: null })).toMatchObject({
      subtitle: '',
      pages: '',
      coverUrl: '',
    });
  });

  it('turns a draft straight into a create payload', () => {
    expect(draftToInput(draft)).toEqual({
      title: 'Dune',
      subtitle: 'Book one',
      authors: ['Frank Herbert'],
      isbn10: '0441013597',
      isbn13: '9780441013593',
      publisher: 'Ace',
      publishedDate: '1965',
      pages: 412,
      language: 'en',
      categories: ['Sci-Fi', 'Classics'],
      description: 'Desert.',
    });
  });
});

describe('format helpers', () => {
  it('splits comma lists, trimming and de-duplicating', () => {
    expect(splitList(' a, b ,,a, c')).toEqual(['a', 'b', 'c']);
    expect(splitList('')).toEqual([]);
    expect(joinList(['a', 'b'])).toBe('a, b');
  });

  it('parses ISBN-10 / ISBN-13 with separators and flags junk', () => {
    expect(parseIsbn('')).toBeNull();
    expect(parseIsbn('0-441-01359-7')).toEqual({ isbn10: '0441013597', isbn13: '9780441013593' });
    expect(parseIsbn('080442 957x')).toEqual({ isbn10: '080442957X', isbn13: '9780804429573' });
    expect(parseIsbn('978 0 441 01359 3')).toEqual({
      isbn10: '0441013597',
      isbn13: '9780441013593',
    });
    expect(parseIsbn('979-12-3456-789-6')).toEqual({ isbn10: null, isbn13: '9791234567896' });
    expect(parseIsbn('12345')).toBe('invalid');
    expect(parseIsbn('9770441013593')).toBe('invalid');
    expect(parseIsbn('0441013598')).toBe('invalid'); // bad check digit
  });

  it('nulls empty strings and formats dates', () => {
    expect(emptyToNull('  ')).toBeNull();
    expect(emptyToNull(' x ')).toBe('x');
    expect(formatDate('2026-09-19', 'en-US')).toBe('Sep 19, 2026');
    expect(formatDate('2026-09-19T10:00:00.000Z', 'en-US')).toMatch(/Sep 19, 2026/);
    expect(formatDate('not a date')).toBe('not a date');
  });
});

describe('book form', () => {
  it('requires a title and reports field-level problems', () => {
    const result = formToInput({
      ...EMPTY_BOOK_FORM,
      isbn: '12',
      pages: '1.5',
      coverUrl: 'ftp://x',
    });
    expect(result).toEqual({
      ok: false,
      errors: { title: 'required', isbn: 'invalid', pages: 'invalid', coverUrl: 'invalid' },
    });
  });

  it('maps schema issues onto form fields', () => {
    const tooLong = formToInput({ ...EMPTY_BOOK_FORM, title: 'x', year: 'y'.repeat(41) });
    expect(tooLong).toEqual({ ok: false, errors: { year: 'invalid' } });
    const badLanguage = formToInput({ ...EMPTY_BOOK_FORM, title: 'x', language: 'l'.repeat(17) });
    expect(badLanguage).toEqual({ ok: false, errors: { language: 'invalid' } });
  });

  it('produces a full payload so edits can clear fields', () => {
    const result = formToInput({
      ...EMPTY_BOOK_FORM,
      title: '  Dune ',
      authors: 'Frank Herbert',
      isbn: '0441013597',
      pages: '412',
    });
    expect(result).toEqual({
      ok: true,
      input: {
        title: 'Dune',
        authors: ['Frank Herbert'],
        isbn10: '0441013597',
        isbn13: '9780441013593',
        subtitle: null,
        publisher: null,
        publishedDate: null,
        pages: 412,
        language: null,
        categories: [],
        description: null,
        notes: null,
      },
    });
  });

  it('only sends a cover URL when one was typed (it asks the API to fetch it)', () => {
    const typed = formToInput({ ...EMPTY_BOOK_FORM, title: 'x', coverUrl: 'https://c/x.jpg' });
    expect(typed.ok && typed.input.coverUrl).toBe('https://c/x.jpg');
    const bad = formToInput({ ...EMPTY_BOOK_FORM, title: 'x', coverUrl: 'ftp://c/x.jpg' });
    expect(bad).toEqual({ ok: false, errors: { coverUrl: 'invalid' } });
  });

  it('round-trips a book through the form', () => {
    const now = '2026-09-19T10:00:00.000Z';
    const form = bookToForm({
      id: '0f3e2b8a-7d3c-4b2f-9a11-6f5e4d3c2b1a',
      ownerId: '0f3e2b8a-7d3c-4b2f-9a11-6f5e4d3c2b1a',
      shelfId: '0f3e2b8a-7d3c-4b2f-9a11-6f5e4d3c2b1a',
      isbn10: '0441013597',
      isbn13: null,
      title: 'Dune',
      subtitle: null,
      authors: ['Frank Herbert', 'Brian Herbert'],
      publisher: 'Ace',
      publishedDate: '1965',
      pages: 412,
      language: 'en',
      coverAssetId: 'a'.repeat(64),
      coverOverride: true,
      coverUrl: `/api/covers/${'a'.repeat(64)}.webp`,
      coverPending: false,
      categories: ['Sci-Fi'],
      description: null,
      notes: 'n',
      rating: 5,
      readStatus: 'read',
      readAt: '2020-01-01',
      addedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    expect(form).toMatchObject({
      title: 'Dune',
      authors: 'Frank Herbert, Brian Herbert',
      isbn: '0441013597',
      pages: '412',
      categories: 'Sci-Fi',
      // The served cover path is never offered back as editable text.
      coverUrl: '',
      notes: 'n',
      subtitle: '',
    });
    const back = formToInput(form);
    expect(back.ok && back.input).toMatchObject({
      isbn10: '0441013597',
      authors: ['Frank Herbert', 'Brian Herbert'],
      pages: 412,
    });
  });
});

describe('toasts', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    clearToasts();
    vi.useRealTimers();
  });

  it('shows, auto-dismisses and can be dismissed early', () => {
    const { result } = renderHook(() => useToasts());
    let id = 0;
    act(() => {
      id = showToast('hello');
      showToast('oops', 'error', 10_000);
    });
    expect(result.current.map((t) => [t.message, t.tone])).toEqual([
      ['hello', 'info'],
      ['oops', 'error'],
    ]);
    act(() => dismissToast(id));
    act(() => dismissToast(id)); // no-op for an unknown id
    expect(result.current.map((t) => t.message)).toEqual(['oops']);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(result.current).toEqual([]);
    act(() => clearToasts()); // no-op when empty
    expect(result.current).toEqual([]);
  });

  it('replaces a repeated message instead of stacking it, restarting the timer', () => {
    const { result } = renderHook(() => useToasts());
    act(() => {
      showToast('Added to My Library › Default');
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    act(() => {
      showToast('Added to My Library › Default');
      showToast('Added to My Library › Default', 'error'); // different tone = different toast
    });
    expect(result.current.map((t) => t.tone)).toEqual(['info', 'error']);

    // The first toast's original 3 s deadline passes without dismissing the replacement.
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(result.current.map((t) => t.tone)).toEqual(['info', 'error']);
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(result.current).toEqual([]);

    // clearToasts cancels pending timers so nothing fires later.
    act(() => {
      showToast('later');
      clearToasts();
      vi.advanceTimersByTime(5000);
    });
    expect(result.current).toEqual([]);
  });
});
