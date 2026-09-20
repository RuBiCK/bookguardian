/**
 * Turn whatever image a provider or a phone hands us into the two WebP
 * variants the app serves, and name them after their content.
 *
 * Every cover becomes at most 600 px tall (original ratio, never enlarged)
 * at quality ~80 — around 30–60 KB — plus a 200 px thumbnail for grids. The
 * asset id is the SHA-256 of the full-size WebP, so the same provider image
 * downloaded twice, or uploaded by two users, is one file on disk.
 */
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { COVER_HEIGHTS } from '@bookguardian/shared';

/** Open Library answers unknown covers with a 1×1 GIF; anything under this is noise. */
export const MIN_COVER_SIDE_PX = 50;
export const WEBP_QUALITY = 80;

export interface ProcessedCover {
  /** SHA-256 (hex) of `full`. */
  id: string;
  width: number;
  height: number;
  bytes: number;
  full: Buffer;
  thumb: Buffer;
}

/** The bytes were not a usable cover: not an image, too small, or corrupt. */
export class InvalidImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidImageError';
  }
}

export function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export async function processCover(input: Buffer): Promise<ProcessedCover> {
  let width: number | undefined;
  let height: number | undefined;
  try {
    // `rotate()` honours EXIF orientation (phone photos), then the metadata
    // reflects the upright image.
    const meta = await sharp(input).rotate().metadata();
    width = meta.autoOrient?.width ?? meta.width;
    height = meta.autoOrient?.height ?? meta.height;
  } catch (error) {
    throw new InvalidImageError(error instanceof Error ? error.message : 'unreadable image');
  }
  if (!width || !height) throw new InvalidImageError('image has no dimensions');
  if (width < MIN_COVER_SIDE_PX || height < MIN_COVER_SIDE_PX) {
    throw new InvalidImageError(`image is only ${width}×${height}`);
  }

  const full = await sharp(input)
    .rotate()
    .resize({ height: COVER_HEIGHTS.full, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer({ resolveWithObject: true });
  const thumb = await sharp(full.data)
    .resize({ height: COVER_HEIGHTS.thumb, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();

  return {
    id: sha256(full.data),
    width: full.info.width,
    height: full.info.height,
    bytes: full.data.byteLength,
    full: full.data,
    thumb,
  };
}
