import { describe, expect, it } from 'vitest';
import {
  bookDraftSchema,
  lookupIsbnParamSchema,
  lookupSearchQuerySchema,
  lookupSearchResponseSchema,
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

  it('bounds the search query and limit', () => {
    expect(lookupSearchQuerySchema.parse({ q: ' dune ' })).toEqual({ q: 'dune', limit: 5 });
    expect(lookupSearchQuerySchema.parse({ q: 'dune', limit: '3' })).toEqual({
      q: 'dune',
      limit: 3,
    });
    expect(lookupSearchQuerySchema.safeParse({ q: 'd' }).success).toBe(false);
    expect(lookupSearchQuerySchema.safeParse({ q: 'dune', limit: 50 }).success).toBe(false);
  });

  it('accepts a normalised draft and rejects unknown sources', () => {
    expect(bookDraftSchema.parse(draft)).toEqual(draft);
    expect(lookupSearchResponseSchema.parse({ items: [draft] }).items).toHaveLength(1);
    expect(bookDraftSchema.safeParse({ ...draft, source: 'amazon' }).success).toBe(false);
    expect(bookDraftSchema.safeParse({ ...draft, title: '' }).success).toBe(false);
  });
});
