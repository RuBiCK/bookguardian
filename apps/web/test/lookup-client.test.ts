import type { BookDraft } from '@bookguardian/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { lookupIsbn, lookupKeys, searchBooks, searchFirstMatch } from '../src/api/lookup';
import { ApiClientError } from '../src/api/client';
import { installFakeApi, type FakeApi } from './fake-api';

const draft: BookDraft = {
  isbn10: '0441013597',
  isbn13: '9780441013593',
  title: 'Dune',
  subtitle: null,
  authors: ['Frank Herbert'],
  publisher: 'Ace',
  publishedDate: '1965',
  pages: 412,
  language: 'en',
  coverUrl: 'https://covers.example.com/dune.jpg',
  categories: ['Science fiction'],
  description: null,
  source: 'open_library',
  sourceId: '/books/OL1M',
};

let api: FakeApi;
beforeEach(() => {
  api = installFakeApi();
});
afterEach(() => {
  api.restore();
});

describe('lookup client', () => {
  it('returns the draft, null for unknown ISBNs and throws on other errors', async () => {
    api.drafts = { '9780441013593': draft };
    expect(await lookupIsbn('9780441013593')).toEqual(draft);
    expect(await lookupIsbn('9780000000002')).toBeNull();
    api.lookupDown = true;
    await expect(lookupIsbn('9780441013593')).rejects.toBeInstanceOf(ApiClientError);
    expect(lookupKeys.isbn('x')).toEqual(['lookup', 'isbn', 'x']);
    expect(lookupKeys.search('q', 5)).toEqual(['lookup', 'search', 'q', 5]);
  });

  it('searches with a limit and stops at the first query with results', async () => {
    api.searchResults = [draft, { ...draft, title: 'Dune Messiah', sourceId: '/books/OL2M' }];
    expect(await searchBooks('messiah', 5)).toHaveLength(1);
    expect(await searchBooks('dune', 1)).toHaveLength(1);

    const hit = await searchFirstMatch(['nothing here', 'frank herbert', 'dune']);
    expect(hit.query).toBe('frank herbert');
    expect(hit.items).toHaveLength(2);
    const searches = api.calls.filter((c) => c.path.startsWith('/api/lookup/search'));
    expect(searches).toHaveLength(4);
    expect(searches[2]?.path).toContain('q=nothing+here');

    expect(await searchFirstMatch(['zzz'])).toEqual({ query: 'zzz', items: [] });
    expect(await searchFirstMatch([])).toEqual({ query: '', items: [] });
  });
});
