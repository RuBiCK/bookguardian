import { describe, expect, it } from 'vitest';
import {
  bookSchema,
  createBookInputSchema,
  createLibraryShareInputSchema,
  healthResponseSchema,
  lendingSchema,
  librarySchema,
  normaliseRating,
  shelfSchema,
  userSchema,
} from '../src';

const now = '2026-09-19T08:00:00.000Z';
const uuid = '0f3e2b8a-7d3c-4b2f-9a11-6f5e4d3c2b1a';

describe('shared schemas', () => {
  it('accepts a well-formed user', () => {
    expect(
      userSchema.safeParse({
        id: uuid,
        displayName: 'Local user',
        email: null,
        createdAt: now,
        updatedAt: now,
      }).success,
    ).toBe(true);
  });

  it('accepts a library with an owner', () => {
    const parsed = librarySchema.safeParse({
      id: uuid,
      ownerId: uuid,
      name: 'My Library',
      location: null,
      createdAt: now,
      updatedAt: now,
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects a shelf with a negative sort order', () => {
    const parsed = shelfSchema.safeParse({
      id: uuid,
      ownerId: uuid,
      libraryId: uuid,
      name: 'Default',
      sortOrder: -1,
      createdAt: now,
      updatedAt: now,
    });
    expect(parsed.success).toBe(false);
  });

  it('validates ISBNs, ratings and read status on books', () => {
    const base = {
      id: uuid,
      ownerId: uuid,
      shelfId: uuid,
      isbn10: '0306406152',
      isbn13: '9780306406157',
      title: 'Dune',
      subtitle: null,
      authors: ['Frank Herbert'],
      publisher: null,
      publishedDate: '1965',
      pages: 412,
      language: 'en',
      coverUrl: null,
      categories: ['Science fiction'],
      description: null,
      notes: null,
      rating: 5,
      readStatus: 'read',
      readAt: '2020-01-15',
      addedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    expect(bookSchema.safeParse(base).success).toBe(true);
    expect(bookSchema.safeParse({ ...base, isbn13: '123' }).success).toBe(false);
    expect(bookSchema.safeParse({ ...base, rating: 6 }).success).toBe(false);
    expect(bookSchema.safeParse({ ...base, readStatus: 'done' }).success).toBe(false);
    expect(bookSchema.safeParse({ ...base, readAt: '2020-1-2' }).success).toBe(false);
    expect(bookSchema.safeParse({ ...base, readAt: null }).success).toBe(true);
  });

  it('normalises a 0-star rating to "unrated" and leaves undefined untouched', () => {
    expect(normaliseRating(0)).toBeNull();
    expect(normaliseRating(null)).toBeNull();
    expect(normaliseRating(undefined)).toBeUndefined();
    expect(normaliseRating(3)).toBe(3);
  });

  it('only requires a title to create a book', () => {
    expect(createBookInputSchema.safeParse({ title: 'Untitled' }).success).toBe(true);
    expect(createBookInputSchema.safeParse({}).success).toBe(false);
  });

  it('accepts an open lending', () => {
    expect(
      lendingSchema.safeParse({
        id: uuid,
        ownerId: uuid,
        bookId: uuid,
        borrowerName: 'Ana',
        borrowerContact: null,
        lentAt: now,
        dueAt: null,
        returnedAt: null,
        createdAt: now,
        updatedAt: now,
      }).success,
    ).toBe(true);
  });

  it('defaults library share role to viewer-only values', () => {
    expect(
      createLibraryShareInputSchema.safeParse({ libraryId: uuid, granteeId: uuid, role: 'editor' })
        .success,
    ).toBe(false);
  });

  it('describes the health endpoint response', () => {
    expect(
      healthResponseSchema.safeParse({
        status: 'ok',
        version: '0.1.0',
        uptimeSeconds: 1,
        database: { driver: 'sqlite', reachable: true },
      }).success,
    ).toBe(true);
  });
});
