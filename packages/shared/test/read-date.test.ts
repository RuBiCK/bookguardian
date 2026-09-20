import { describe, expect, it } from 'vitest';
import {
  createBookInputSchema,
  isFutureDate,
  localDate,
  readAtSchema,
  resolveReadAt,
  updateBookInputSchema,
} from '../src';

/** `YYYY-MM-DD` for today ± `days`, in local time like the app does. */
const daysFromToday = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return localDate(d);
};

describe('localDate', () => {
  it('formats the local calendar day without a UTC shift', () => {
    // 00:30 local on 20 March stays 20 March whatever the offset.
    expect(localDate(new Date(2026, 2, 20, 0, 30))).toBe('2026-03-20');
    expect(localDate(new Date(2026, 11, 5, 23, 59))).toBe('2026-12-05');
  });

  it('defaults to now', () => {
    expect(localDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(localDate()).toBe(localDate(new Date()));
  });
});

describe('isFutureDate', () => {
  it('compares calendar days, treating today as not future', () => {
    expect(isFutureDate('2026-09-20', '2026-09-19')).toBe(true);
    expect(isFutureDate('2026-09-19', '2026-09-19')).toBe(false);
    expect(isFutureDate('2026-09-18', '2026-09-19')).toBe(false);
    expect(isFutureDate('2027-01-01', '2026-12-31')).toBe(true);
  });

  it('defaults to today', () => {
    expect(isFutureDate(daysFromToday(1))).toBe(true);
    expect(isFutureDate(daysFromToday(0))).toBe(false);
    expect(isFutureDate(daysFromToday(-1))).toBe(false);
  });
});

describe('readAtSchema', () => {
  it('accepts today and any past day', () => {
    expect(readAtSchema.safeParse(daysFromToday(0)).success).toBe(true);
    expect(readAtSchema.safeParse(daysFromToday(-400)).success).toBe(true);
    expect(readAtSchema.safeParse('1999-12-31').success).toBe(true);
  });

  it('rejects the future and malformed dates', () => {
    const tomorrow = readAtSchema.safeParse(daysFromToday(1));
    expect(tomorrow.success).toBe(false);
    expect(tomorrow.error?.issues[0]?.message).toBe('Read date cannot be in the future');
    expect(readAtSchema.safeParse(daysFromToday(30)).success).toBe(false);
    expect(readAtSchema.safeParse('2026-13-01').success).toBe(false);
    expect(readAtSchema.safeParse('2026-09-19T10:00:00Z').success).toBe(false);
  });

  it('is the rule both create and update book inputs use', () => {
    const tomorrow = daysFromToday(1);
    expect(createBookInputSchema.safeParse({ title: 'X', readAt: tomorrow }).success).toBe(false);
    expect(updateBookInputSchema.safeParse({ readAt: tomorrow }).success).toBe(false);
    expect(updateBookInputSchema.safeParse({ readAt: daysFromToday(0) }).success).toBe(true);
    expect(updateBookInputSchema.safeParse({ readAt: null }).success).toBe(true);
  });
});

describe('resolveReadAt', () => {
  const today = '2026-09-19';

  it('stamps today when a book is marked read without a date', () => {
    expect(resolveReadAt('read', undefined, null, today)).toBe(today);
    expect(resolveReadAt('read', null, null, today)).toBe(today);
  });

  it('keeps an explicit date, else the date the book already had', () => {
    expect(resolveReadAt('read', '2020-01-15', null, today)).toBe('2020-01-15');
    expect(resolveReadAt('read', '2020-01-15', '2019-05-05', today)).toBe('2020-01-15');
    expect(resolveReadAt('read', undefined, '2019-05-05', today)).toBe('2019-05-05');
  });

  it('clears the date when leaving the read state', () => {
    expect(resolveReadAt('reading', '2020-01-15', '2019-05-05', today)).toBeNull();
    expect(resolveReadAt('to_read', undefined, '2019-05-05', today)).toBeNull();
  });

  it('defaults to today in local time', () => {
    expect(resolveReadAt('read', undefined)).toBe(localDate());
  });
});
