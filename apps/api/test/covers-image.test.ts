import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { InvalidImageError, processCover, sha256 } from '../src/covers/image';
import { coverJpeg, ONE_PIXEL_GIF, photoJpeg, tinyPng } from './cover-fixtures';

describe('processCover', () => {
  it('bounds the cover to 600 px tall, keeps the ratio, and names it after the WebP bytes', async () => {
    const cover = await processCover(await coverJpeg(1, 800, 1200));
    expect(cover).toMatchObject({ width: 400, height: 600 });
    expect(cover.id).toBe(sha256(cover.full));
    expect(cover.bytes).toBe(cover.full.byteLength);
    expect(await sharp(cover.full).metadata()).toMatchObject({ format: 'webp', height: 600 });
    expect(await sharp(cover.thumb).metadata()).toMatchObject({
      format: 'webp',
      width: 133,
      height: 200,
    });
  });

  it('never enlarges a small cover and is deterministic for the same input', async () => {
    const small = await coverJpeg(2, 120, 180);
    const a = await processCover(small);
    const b = await processCover(small);
    expect(a).toMatchObject({ width: 120, height: 180 });
    expect(b.id).toBe(a.id);
    const other = await processCover(await coverJpeg(3, 120, 180));
    expect(other.id).not.toBe(a.id);
  });

  it('honours EXIF orientation so a phone photo comes out upright', async () => {
    const cover = await processCover(await photoJpeg());
    // 1200×1600 with orientation 6 (rotate 90°) is 1600×1200 upright → 800×600.
    expect(cover).toMatchObject({ width: 800, height: 600 });
  });

  it('rejects the 1×1 "no cover" GIF, tiny images and non-images', async () => {
    await expect(processCover(ONE_PIXEL_GIF)).rejects.toBeInstanceOf(InvalidImageError);
    await expect(processCover(await tinyPng())).rejects.toThrow(/20×30/);
    await expect(processCover(Buffer.from('<html>not an image</html>'))).rejects.toBeInstanceOf(
      InvalidImageError,
    );
  });
});
