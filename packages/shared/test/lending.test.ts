import { describe, expect, it } from 'vitest';
import {
  borrowerListResponseSchema,
  daysOut,
  isActiveLending,
  isOverdue,
  lendingListQuerySchema,
  lendingWithBookSchema,
} from '../src';

const uuid = '0f3e2b8a-7d3c-4b2f-9a11-6f5e4d3c2b1a';

describe('lending rules', () => {
  it('a lending is active until it is returned', () => {
    expect(isActiveLending({ returnedAt: null })).toBe(true);
    expect(isActiveLending({ returnedAt: '2026-09-01T00:00:00.000Z' })).toBe(false);
  });

  it('overdue means active with a due day strictly before today', () => {
    const today = '2026-09-20';
    expect(isOverdue({ dueAt: '2026-09-19', returnedAt: null }, today)).toBe(true);
    // The due day itself is still fine.
    expect(isOverdue({ dueAt: '2026-09-20', returnedAt: null }, today)).toBe(false);
    expect(isOverdue({ dueAt: '2026-09-21', returnedAt: null }, today)).toBe(false);
    // No due date → never overdue; returned → never overdue, however late it came back.
    expect(isOverdue({ dueAt: null, returnedAt: null }, today)).toBe(false);
    expect(isOverdue({ dueAt: '2020-01-01', returnedAt: '2026-09-01T00:00:00Z' }, today)).toBe(
      false,
    );
    // Defaults to the local calendar day.
    expect(isOverdue({ dueAt: '2000-01-01', returnedAt: null })).toBe(true);
    expect(isOverdue({ dueAt: '2999-01-01', returnedAt: null })).toBe(false);
  });

  it('counts whole days out, until the return or now, never negative', () => {
    const now = new Date('2026-09-20T12:00:00.000Z');
    expect(daysOut({ lentAt: '2026-09-20T09:00:00.000Z', returnedAt: null }, now)).toBe(0);
    expect(daysOut({ lentAt: '2026-09-19T13:00:00.000Z', returnedAt: null }, now)).toBe(0);
    expect(daysOut({ lentAt: '2026-09-19T11:00:00.000Z', returnedAt: null }, now)).toBe(1);
    expect(daysOut({ lentAt: '2026-09-01T12:00:00.000Z', returnedAt: null }, now)).toBe(19);
    expect(
      daysOut({ lentAt: '2026-09-01T12:00:00.000Z', returnedAt: '2026-09-05T12:00:00.000Z' }, now),
    ).toBe(4);
    // A lending stamped in the future (clock skew) is simply "0 days".
    expect(daysOut({ lentAt: '2026-09-25T00:00:00.000Z', returnedAt: null }, now)).toBe(0);
    expect(daysOut({ lentAt: '2000-01-01T00:00:00.000Z', returnedAt: null })).toBeGreaterThan(0);
  });
});

describe('lending DTOs', () => {
  it('parses the list query flags from strings', () => {
    expect(lendingListQuerySchema.parse({})).toEqual({});
    expect(
      lendingListQuerySchema.parse({ active: 'false', overdue: 'true', bookId: uuid }),
    ).toEqual({ active: false, overdue: true, bookId: uuid });
    expect(lendingListQuerySchema.safeParse({ active: 'yes' }).success).toBe(false);
    expect(lendingListQuerySchema.safeParse({ bookId: 'nope' }).success).toBe(false);
  });

  it('a listed lending carries its book summary and the overdue flag', () => {
    const ts = '2026-09-20T10:00:00.000Z';
    const item = {
      id: uuid,
      ownerId: uuid,
      bookId: uuid,
      borrowerName: 'Ana',
      borrowerContact: null,
      lentAt: ts,
      dueAt: null,
      returnedAt: null,
      createdAt: ts,
      updatedAt: ts,
      overdue: false,
      book: {
        id: uuid,
        title: 'Dune',
        authors: [],
        coverAssetId: null,
        coverUrl: null,
        shelfId: uuid,
      },
    };
    expect(lendingWithBookSchema.parse(item)).toEqual(item);
    expect(lendingWithBookSchema.safeParse({ ...item, book: undefined }).success).toBe(false);
    expect(lendingWithBookSchema.safeParse({ ...item, overdue: 'no' }).success).toBe(false);
    expect(
      borrowerListResponseSchema.parse({ items: [{ name: 'Ana', contact: null, lastLentAt: ts }] })
        .items,
    ).toHaveLength(1);
  });
});
