import { describe, expect, it } from 'vitest';
import {
  bookDraftSchema,
  lookupIsbnParamSchema,
  lookupSearchQuerySchema,
  lookupSearchResponseSchema,
  lookupSearchResultSchema,
  yearOf,
} from '../src';

const draft = {
  isbn10: '0441013597',
  isbn13: '9780441013593',
  title: 'Dune',
  subtitle: null,
  authors: ['Frank Herbert'],
  publisher: 'Ace',
  publishedDate: '1965',
  pages: 412,
  language: 'en',
  coverUrl: 'https://covers.openlibrary.org/b/id/1-L.jpg',
  categories: ['Science fiction'],
  description: null,
  source: 'open_library',
  sourceId: '/books/OL1M',
};

describe('lookup DTOs', () => {
  it('normalises the ISBN path param to ISBN-13', () => {
    expect(lookupIsbnParamSchema.parse({ isbn: '0-441-01359-7' })).toEqual({
      isbn: '9780441013593',
    });
    expect(lookupIsbnParamSchema.parse({ isbn: ' 9780441013593 ' })).toEqual({
      isbn: '9780441013593',
    });
    expect(lookupIsbnParamSchema.safeParse({ isbn: '0441013598' }).success).toBe(false);
    expect(lookupIsbnParamSchema.safeParse({ isbn: '12' }).success).toBe(false);
  });

  it('bounds the free-text query and limit', () => {
    expect(lookupSearchQuerySchema.parse({ q: ' dune ' })).toEqual({ q: 'dune', limit: 5 });
    expect(lookupSearchQuerySchema.parse({ q: 'dune', limit: '3' })).toEqual({
      q: 'dune',
      limit: 3,
    });
    expect(lookupSearchQuerySchema.safeParse({ q: 'd' }).success).toBe(false);
    expect(lookupSearchQuerySchema.safeParse({ q: 'dune', limit: 50 }).success).toBe(false);
  });

  it('accepts structured fields, blank ones counting as absent', () => {
    expect(
      lookupSearchQuerySchema.parse({
        title: ' Dune ',
        author: 'Frank Herbert',
        isbn: '0-441-01359-7',
        publisher: 'Ace',
        year: '1965',
        q: '',
      }),
    ).toEqual({
      title: 'Dune',
      author: 'Frank Herbert',
      isbn: '9780441013593',
      publisher: 'Ace',
      year: 1965,
      limit: 5,
    });
    expect(lookupSearchQuerySchema.parse({ author: 'Herbert', title: '   ' })).toEqual({
      author: 'Herbert',
      limit: 5,
    });
    // At least one searchable field, and the ISBN must be a real one.
    expect(lookupSearchQuerySchema.safeParse({}).success).toBe(false);
    expect(lookupSearchQuerySchema.safeParse({ title: '', q: ' ' }).success).toBe(false);
    expect(lookupSearchQuerySchema.safeParse({ limit: 3 }).success).toBe(false);
    expect(lookupSearchQuerySchema.safeParse({ isbn: '1234567890123' }).success).toBe(false);
    expect(lookupSearchQuerySchema.safeParse({ year: '65' }).success).toBe(false);
    expect(lookupSearchQuerySchema.safeParse({ year: 'soon' }).success).toBe(false);
  });

  it('extracts a four-digit year from a free-form date field', () => {
    expect(yearOf('1965')).toBe(1965);
    expect(yearOf('August 1, 1978')).toBe(1978);
    expect(yearOf('2005-08-02')).toBe(2005);
    expect(yearOf('65')).toBeUndefined();
    expect(yearOf('')).toBeUndefined();
    expect(yearOf(null)).toBeUndefined();
  });

  it('accepts a normalised draft and rejects unknown sources', () => {
    expect(bookDraftSchema.parse(draft)).toEqual(draft);
    const result = { ...draft, resultId: 'open_library:/books/OL1M' };
    expect(lookupSearchResultSchema.parse(result)).toEqual(result);
    expect(lookupSearchResponseSchema.parse({ items: [result] }).items).toHaveLength(1);
    // Search hits always carry their id.
    expect(lookupSearchResponseSchema.safeParse({ items: [draft] }).success).toBe(false);
    expect(bookDraftSchema.safeParse({ ...draft, source: 'amazon' }).success).toBe(false);
    expect(bookDraftSchema.safeParse({ ...draft, title: '' }).success).toBe(false);
  });
});
