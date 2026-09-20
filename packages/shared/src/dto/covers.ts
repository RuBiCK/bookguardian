import { z } from 'zod';
import { coverAssetIdSchema } from '../schemas/book';
import { idSchema, isoDateTimeSchema } from '../schemas/common';

/** Where a stored cover came from. Provider covers are shared by ISBN; the rest belong to one user. */
export const COVER_SOURCES = ['open_library', 'google_books', 'user_photo', 'manual'] as const;
export const coverSourceSchema = z.enum(COVER_SOURCES);
export type CoverSource = z.infer<typeof coverSourceSchema>;

export const coverAssetSchema = z.object({
  /** SHA-256 of the WebP file; also its file name. */
  id: coverAssetIdSchema,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  bytes: z.number().int().positive(),
  source: coverSourceSchema,
  /** `null` = shared (resolved from a provider by ISBN); set = private to that user. */
  ownerId: idSchema.nullable(),
  createdAt: isoDateTimeSchema,
});
export type CoverAsset = z.infer<typeof coverAssetSchema>;

export const COVER_VARIANTS = ['full', 'thumb'] as const;
export type CoverVariant = (typeof COVER_VARIANTS)[number];

/** Height (px) each stored variant is bounded to. */
export const COVER_HEIGHTS: Record<CoverVariant, number> = { full: 600, thumb: 200 };

/** File name of a variant: `<sha256>.webp` / `<sha256>-thumb.webp`. */
export function coverFileName(assetId: string, variant: CoverVariant = 'full'): string {
  return `${assetId}${variant === 'thumb' ? '-thumb' : ''}.webp`;
}

/** API path a client loads a cover from; `API_BASE_URL` goes in front on the web. */
export function coverPath(assetId: string, variant: CoverVariant = 'full'): string {
  return `/api/covers/${coverFileName(assetId, variant)}`;
}

/** `GET /api/covers/:file` — `<sha256>.webp` or `<sha256>-thumb.webp`. */
export const coverFileParamSchema = z.object({
  file: z
    .string()
    .regex(/^[a-f0-9]{64}(-thumb)?\.webp$/, 'Invalid cover file name')
    .transform((file) => ({
      assetId: file.slice(0, 64),
      variant: file.endsWith('-thumb.webp') ? ('thumb' as const) : ('full' as const),
    })),
});
export type CoverFileParam = z.infer<typeof coverFileParamSchema>;

/**
 * `POST /api/books/:id/cover?fallback=true` — a photo that only stands in
 * while no catalogue cover exists (the scan's cover shot); without the flag
 * the upload becomes the book's own cover and the catalogue one is ignored.
 */
export const uploadCoverQuerySchema = z.object({
  fallback: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});
export type UploadCoverQuery = z.infer<typeof uploadCoverQuerySchema>;

/** Largest upload the API accepts (phones produce 3–12 MB JPEGs). */
export const COVER_UPLOAD_MAX_BYTES = 20 * 1024 * 1024;

/** `POST /api/covers/backfill` — how many books were queued for the cascade. */
export const coverBackfillResponseSchema = z.object({ queued: z.number().int().nonnegative() });
export type CoverBackfillResponse = z.infer<typeof coverBackfillResponseSchema>;

/**
 * `GET /api/covers/backfill` — progress of the caller's last backfill.
 * `done` counts every settled job (found or not); `found` the ones that
 * produced a cover; `failed` the ones that gave up after retrying.
 */
export const coverBackfillStatusSchema = z.object({
  queued: z.number().int().nonnegative(),
  pending: z.number().int().nonnegative(),
  done: z.number().int().nonnegative(),
  found: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
});
export type CoverBackfillStatus = z.infer<typeof coverBackfillStatusSchema>;

export const IDLE_BACKFILL: CoverBackfillStatus = {
  queued: 0,
  pending: 0,
  done: 0,
  found: 0,
  failed: 0,
};
