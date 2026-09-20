import { describe, expect, it } from 'vitest';
import { applyReadingRules, normaliseRating, todayIso, UNREAD, type ReadingFields } from '../src';

const TODAY = '2026-09-19';
const READING: ReadingFields = { readStatus: 'reading', startedAt: '2026-09-01', readAt: null };
const READ: ReadingFields = { readStatus: 'read', startedAt: '2026-09-01', readAt: '2026-09-10' };

describe('applyReadingRules', () => {
  it('stamps today when a book is marked read without a date', () => {
    expect(applyReadingRules(UNREAD, { readStatus: 'read' }, TODAY)).toEqual({
      ok: true,
      value: { readStatus: 'read', startedAt: null, readAt: TODAY },
    });
    // A new book created straight as "read" gets the same default.
    expect(applyReadingRules(null, { readStatus: 'read' }, TODAY)).toEqual({
      ok: true,
      value: { readStatus: 'read', startedAt: null, readAt: TODAY },
    });
  });

  it('keeps an explicit finished date and an existing started date', () => {
    expect(applyReadingRules(READING, { readStatus: 'read', readAt: '2026-09-15' }, TODAY)).toEqual(
      { ok: true, value: { readStatus: 'read', startedAt: '2026-09-01', readAt: '2026-09-15' } },
    );
  });

  it('stamps the started date when a book moves to reading', () => {
    expect(applyReadingRules(UNREAD, { readStatus: 'reading' }, TODAY)).toEqual({
      ok: true,
      value: { readStatus: 'reading', startedAt: TODAY, readAt: null },
    });
    expect(
      applyReadingRules(UNREAD, { readStatus: 'reading', startedAt: '2026-08-01' }, TODAY),
    ).toEqual({
      ok: true,
      value: { readStatus: 'reading', startedAt: '2026-08-01', readAt: null },
    });
  });

  it('clears dates that no longer apply when moving backwards', () => {
    expect(applyReadingRules(READ, { readStatus: 'reading' }, TODAY)).toEqual({
      ok: true,
      value: { readStatus: 'reading', startedAt: '2026-09-01', readAt: null },
    });
    expect(applyReadingRules(READ, { readStatus: 'to_read' }, TODAY)).toEqual({
      ok: true,
      value: UNREAD,
    });
  });

  it('does not re-stamp dates when the status is unchanged', () => {
    const cleared: ReadingFields = { readStatus: 'read', startedAt: null, readAt: null };
    // Editing an unrelated field (empty patch) leaves a cleared finished date alone.
    expect(applyReadingRules(cleared, {}, TODAY)).toEqual({ ok: true, value: cleared });
    // Explicitly clearing the finished date of a read book is allowed.
    expect(applyReadingRules(READ, { readAt: null }, TODAY)).toEqual({
      ok: true,
      value: { ...READ, readAt: null },
    });
  });

  it('rejects dates that contradict the status instead of dropping them', () => {
    expect(applyReadingRules(UNREAD, { readAt: '2026-09-10' }, TODAY)).toEqual({
      ok: false,
      error: 'read_at_requires_read',
    });
    expect(applyReadingRules(READ, { readStatus: 'reading', readAt: '2026-09-10' }, TODAY)).toEqual(
      { ok: false, error: 'read_at_requires_read' },
    );
    expect(applyReadingRules(UNREAD, { startedAt: '2026-09-10' }, TODAY)).toEqual({
      ok: false,
      error: 'started_at_requires_started',
    });
    expect(
      applyReadingRules(READING, { readStatus: 'to_read', startedAt: '2026-09-10' }, TODAY),
    ).toEqual({ ok: false, error: 'started_at_requires_started' });
  });

  it('never lets a book finish before it was started', () => {
    expect(applyReadingRules(READ, { startedAt: '2026-09-11' }, TODAY)).toEqual({
      ok: false,
      error: 'read_before_start',
    });
    expect(applyReadingRules(READING, { readStatus: 'read', readAt: '2026-08-31' }, TODAY)).toEqual(
      { ok: false, error: 'read_before_start' },
    );
    // Same day is fine.
    expect(applyReadingRules(READING, { readStatus: 'read', readAt: '2026-09-01' }, TODAY).ok).toBe(
      true,
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
