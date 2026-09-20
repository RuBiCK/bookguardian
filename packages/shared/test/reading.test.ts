import { describe, expect, it } from 'vitest';
import { applyReadingRules, normaliseRating, todayIso, UNREAD, type ReadingFields } from '../src';

const TODAY = '2026-09-19';
const READING: ReadingFields = { readStatus: 'reading', readAt: null };
const READ: ReadingFields = { readStatus: 'read', readAt: '2026-09-10' };

describe('applyReadingRules', () => {
  it('stamps today when a book is marked read without a date', () => {
    expect(applyReadingRules(UNREAD, { readStatus: 'read' }, TODAY)).toEqual({
      ok: true,
      value: { readStatus: 'read', readAt: TODAY },
    });
    // A new book created straight as "read" gets the same default.
    expect(applyReadingRules(null, { readStatus: 'read' }, TODAY)).toEqual({
      ok: true,
      value: { readStatus: 'read', readAt: TODAY },
    });
  });

  it('keeps an explicit finished date', () => {
    expect(applyReadingRules(READING, { readStatus: 'read', readAt: '2026-09-15' }, TODAY)).toEqual(
      { ok: true, value: { readStatus: 'read', readAt: '2026-09-15' } },
    );
  });

  it('clears the finished date when moving away from read', () => {
    expect(applyReadingRules(READ, { readStatus: 'reading' }, TODAY)).toEqual({
      ok: true,
      value: READING,
    });
    expect(applyReadingRules(READ, { readStatus: 'to_read' }, TODAY)).toEqual({
      ok: true,
      value: UNREAD,
    });
  });

  it('does not re-stamp the date when the status is unchanged', () => {
    const cleared: ReadingFields = { readStatus: 'read', readAt: null };
    // Editing an unrelated field (empty patch) leaves a cleared finished date alone.
    expect(applyReadingRules(cleared, {}, TODAY)).toEqual({ ok: true, value: cleared });
    // Explicitly clearing the finished date of a read book is allowed.
    expect(applyReadingRules(READ, { readAt: null }, TODAY)).toEqual({
      ok: true,
      value: { ...READ, readAt: null },
    });
    // Editing the date of a read book keeps the new value.
    expect(applyReadingRules(READ, { readAt: '2026-09-12' }, TODAY)).toEqual({
      ok: true,
      value: { readStatus: 'read', readAt: '2026-09-12' },
    });
  });

  it('rejects a finished date that contradicts the status instead of dropping it', () => {
    expect(applyReadingRules(UNREAD, { readAt: '2026-09-10' }, TODAY)).toEqual({
      ok: false,
      error: 'read_at_requires_read',
    });
    expect(applyReadingRules(READ, { readStatus: 'reading', readAt: '2026-09-10' }, TODAY)).toEqual(
      { ok: false, error: 'read_at_requires_read' },
    );
    expect(applyReadingRules(null, { readStatus: 'to_read', readAt: '2026-09-10' }, TODAY)).toEqual(
      { ok: false, error: 'read_at_requires_read' },
    );
  });
});

describe('normaliseRating', () => {
  it('maps 0 and null to "unrated" and leaves undefined untouched', () => {
    expect(normaliseRating(0)).toBeNull();
    expect(normaliseRating(null)).toBeNull();
    expect(normaliseRating(undefined)).toBeUndefined();
    expect(normaliseRating(3)).toBe(3);
  });
});

describe('todayIso', () => {
  it('formats the local calendar date as YYYY-MM-DD', () => {
    expect(todayIso(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
