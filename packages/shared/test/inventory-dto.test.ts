import { describe, expect, it } from 'vitest';
import {
  bookListQuerySchema,
  bookPageSchema,
  createBookRequestSchema,
  deleteContainerQuerySchema,
  inventoryDefaultsSchema,
  libraryWithCountsSchema,
  moveBookInputSchema,
  reorderShelvesInputSchema,
  shelfWithCountSchema,
} from '../src';

const ID = '0f3e2b8a-7d3c-4b2f-9a11-6f5e4d3c2b1a';
const OTHER = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const NOW = '2026-09-19T10:00:00.000Z';

describe('inventory DTOs', () => {
  it('bookListQuery applies defaults, trims the search term and validates filters', () => {
    expect(bookListQuerySchema.parse({})).toEqual({ limit: 50, offset: 0, sort: 'added' });
    expect(bookListQuerySchema.parse({ q: '  dune ', readStatus: 'read', sort: 'title' })).toEqual({
      limit: 50,
      offset: 0,
      q: 'dune',
      readStatus: 'read',
      sort: 'title',
    });
    expect(bookListQuerySchema.safeParse({ readStatus: 'burned' }).success).toBe(false);
    expect(bookListQuerySchema.safeParse({ libraryId: 'nope' }).success).toBe(false);
    expect(bookListQuerySchema.safeParse({ sort: 'rating' }).success).toBe(false);
    expect(bookListQuerySchema.safeParse({ category: '' }).success).toBe(false);
  });

  it('bookPage carries items plus paging metadata', () => {
    expect(bookPageSchema.safeParse({ items: [], total: 0, limit: 50, offset: 0 }).success).toBe(
      true,
    );
    expect(bookPageSchema.safeParse({ items: [], total: -1, limit: 50, offset: 0 }).success).toBe(
      false,
    );
  });

  it('createBookRequest only needs a title; shelf is optional', () => {
    expect(createBookRequestSchema.parse({ title: 'Dune' })).toEqual({ title: 'Dune' });
    expect(createBookRequestSchema.safeParse({ shelfId: ID }).success).toBe(false);
  });

  it('counted library and shelf DTOs require non-negative counts', () => {
    const library = {
      id: ID,
      ownerId: OTHER,
      name: 'L',
      location: null,
      createdAt: NOW,
      updatedAt: NOW,
    };
    expect(
      libraryWithCountsSchema.safeParse({ ...library, shelfCount: 1, bookCount: 0 }).success,
    ).toBe(true);
    expect(
      libraryWithCountsSchema.safeParse({ ...library, shelfCount: -1, bookCount: 0 }).success,
    ).toBe(false);
    const shelf = {
      id: ID,
      ownerId: OTHER,
      libraryId: OTHER,
      name: 'S',
      sortOrder: 0,
      createdAt: NOW,
      updatedAt: NOW,
    };
    expect(shelfWithCountSchema.safeParse({ ...shelf, bookCount: 3 }).success).toBe(true);
    expect(shelfWithCountSchema.safeParse(shelf).success).toBe(false);
  });

  it('move, reorder, delete and defaults payloads validate ids', () => {
    expect(moveBookInputSchema.safeParse({ shelfId: ID }).success).toBe(true);
    expect(moveBookInputSchema.safeParse({}).success).toBe(false);
    expect(
      reorderShelvesInputSchema.safeParse({ libraryId: ID, shelfIds: [ID, OTHER] }).success,
    ).toBe(true);
    expect(reorderShelvesInputSchema.safeParse({ libraryId: ID, shelfIds: [] }).success).toBe(
      false,
    );
    expect(deleteContainerQuerySchema.parse({})).toEqual({});
    expect(deleteContainerQuerySchema.safeParse({ moveBooksTo: 'x' }).success).toBe(false);
    expect(inventoryDefaultsSchema.safeParse({ libraryId: ID, shelfId: OTHER }).success).toBe(true);
  });
});
