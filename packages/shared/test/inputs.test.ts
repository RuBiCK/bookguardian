import { describe, expect, it } from 'vitest';
import {
  createLendingInputSchema,
  createLibraryInputSchema,
  createShelfInputSchema,
  returnLendingInputSchema,
  updateBookInputSchema,
  updateLibraryInputSchema,
  updateShelfInputSchema,
} from '../src';

const uuid = '0f3e2b8a-7d3c-4b2f-9a11-6f5e4d3c2b1a';

describe('create/update input schemas', () => {
  it('library: name required and trimmed, location optional', () => {
    expect(createLibraryInputSchema.parse({ name: '  Home  ' })).toEqual({ name: 'Home' });
    expect(createLibraryInputSchema.safeParse({ name: '   ' }).success).toBe(false);
    expect(createLibraryInputSchema.safeParse({ name: 'x'.repeat(121) }).success).toBe(false);
    expect(updateLibraryInputSchema.parse({})).toEqual({});
    expect(updateLibraryInputSchema.parse({ location: null })).toEqual({ location: null });
  });

  it('shelf: needs a library id, sort order optional and non-negative', () => {
    expect(createShelfInputSchema.parse({ libraryId: uuid, name: 'A' })).toEqual({
      libraryId: uuid,
      name: 'A',
    });
    expect(createShelfInputSchema.safeParse({ name: 'A' }).success).toBe(false);
    expect(
      createShelfInputSchema.safeParse({ libraryId: uuid, name: 'A', sortOrder: -1 }).success,
    ).toBe(false);
    expect(
      createShelfInputSchema.safeParse({ libraryId: uuid, name: 'A', sortOrder: 1.5 }).success,
    ).toBe(false);
    // The library a shelf belongs to cannot be changed through an update.
    expect('libraryId' in updateShelfInputSchema.shape).toBe(false);
  });

  it('book update: everything optional but still validated', () => {
    expect(updateBookInputSchema.parse({})).toEqual({});
    expect(updateBookInputSchema.safeParse({ rating: 5.5 }).success).toBe(false);
    expect(updateBookInputSchema.safeParse({ coverUrl: 'not a url' }).success).toBe(false);
    expect(updateBookInputSchema.safeParse({ readAt: '2020-13-01' }).success).toBe(false);
    expect(updateBookInputSchema.safeParse({ isbn10: '123456789X' }).success).toBe(true);
    expect(updateBookInputSchema.safeParse({ authors: [''] }).success).toBe(false);
  });

  it('lending: book + borrower required, dates validated, return optional', () => {
    expect(createLendingInputSchema.parse({ bookId: uuid, borrowerName: 'Ana' })).toEqual({
      bookId: uuid,
      borrowerName: 'Ana',
    });
    expect(createLendingInputSchema.safeParse({ bookId: uuid }).success).toBe(false);
    expect(
      createLendingInputSchema.safeParse({ bookId: uuid, borrowerName: 'Ana', dueAt: 'tomorrow' })
        .success,
    ).toBe(false);
    expect(
      createLendingInputSchema.safeParse({
        bookId: uuid,
        borrowerName: 'Ana',
        lentAt: '2026-09-19T08:00:00Z',
      }).success,
    ).toBe(true);
    expect(returnLendingInputSchema.parse({})).toEqual({});
    expect(returnLendingInputSchema.safeParse({ returnedAt: 'now' }).success).toBe(false);
  });
});
