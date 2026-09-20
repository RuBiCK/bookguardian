import { describe, expect, it } from 'vitest';
import {
  coverBackfillStatusSchema,
  coverFileName,
  coverFileParamSchema,
  coverPath,
  createBookInputSchema,
  updateBookInputSchema,
  uploadCoverQuerySchema,
} from '../src';

const SHA = 'c'.repeat(64);

describe('cover DTOs', () => {
  it('names variants after the content hash', () => {
    expect(coverFileName(SHA)).toBe(`${SHA}.webp`);
    expect(coverFileName(SHA, 'thumb')).toBe(`${SHA}-thumb.webp`);
    expect(coverPath(SHA)).toBe(`/api/covers/${SHA}.webp`);
    expect(coverPath(SHA, 'thumb')).toBe(`/api/covers/${SHA}-thumb.webp`);
  });

  it('parses a cover file name back into asset id and variant', () => {
    expect(coverFileParamSchema.parse({ file: `${SHA}.webp` })).toEqual({
      file: { assetId: SHA, variant: 'full' },
    });
    expect(coverFileParamSchema.parse({ file: `${SHA}-thumb.webp` })).toEqual({
      file: { assetId: SHA, variant: 'thumb' },
    });
    for (const bad of ['x.webp', `${SHA}.jpg`, `${SHA}-small.webp`, `${SHA.toUpperCase()}.webp`]) {
      expect(coverFileParamSchema.safeParse({ file: bad }).success, bad).toBe(false);
    }
  });

  it('reads the upload fallback flag and the backfill status', () => {
    expect(uploadCoverQuerySchema.parse({})).toEqual({ fallback: false });
    expect(uploadCoverQuerySchema.parse({ fallback: 'true' })).toEqual({ fallback: true });
    expect(uploadCoverQuerySchema.safeParse({ fallback: 'yes' }).success).toBe(false);
    expect(
      coverBackfillStatusSchema.safeParse({ queued: 3, pending: 1, done: 2, found: 1, failed: 0 })
        .success,
    ).toBe(true);
    expect(coverBackfillStatusSchema.safeParse({ queued: -1 }).success).toBe(false);
  });

  it('treats coverUrl on input as an instruction and never accepts stored cover fields', () => {
    expect(createBookInputSchema.parse({ title: 'Dune' })).toEqual({ title: 'Dune' });
    expect(
      createBookInputSchema.parse({ title: 'Dune', coverUrl: 'https://x.test/c.jpg' }).coverUrl,
    ).toBe('https://x.test/c.jpg');
    expect(createBookInputSchema.safeParse({ title: 'Dune', coverUrl: '/api/x' }).success).toBe(
      false,
    );
    expect(updateBookInputSchema.parse({ coverUrl: null })).toEqual({ coverUrl: null });
    // Zod objects strip unknown keys, so a client cannot write these directly.
    expect(updateBookInputSchema.parse({ coverAssetId: SHA, coverOverride: true })).toEqual({});
  });
});
