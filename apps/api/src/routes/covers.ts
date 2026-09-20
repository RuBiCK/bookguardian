/**
 * `/api/covers`: the cover files themselves and the backfill controls.
 *
 * A file's name is its content hash, so it never changes: shared covers are
 * `public, immutable` for a year and carry the hash as ETag. Private covers
 * (a user's photo) are only served to their owner or to someone the library
 * is shared with, as `private`; everyone else gets a 404 so the hash leaks
 * nothing.
 */
import { Hono } from 'hono';
import {
  coverFileParamSchema,
  type CoverBackfillResponse,
  type CoverBackfillStatus,
} from '@bookguardian/shared';
import type { AppEnv } from '../app-env';
import { ApiHttpError } from '../errors';
import { canViewCover } from '../inventory';
import { validate } from '../validation';

const ONE_YEAR = 'max-age=31536000, immutable';

export const coverRoutes = new Hono<AppEnv>()
  .post('/backfill', async (c) => {
    const { covers } = c.get('services');
    const queued = await covers.backfill(c.get('ownerId'));
    const body: CoverBackfillResponse = { queued };
    return c.json(body, 202);
  })
  .get('/backfill', (c) => {
    const { covers } = c.get('services');
    const body: CoverBackfillStatus = covers.backfillStatus(c.get('ownerId'));
    c.header('Cache-Control', 'no-store');
    return c.json(body);
  })
  .get('/:file', validate('param', coverFileParamSchema), async (c) => {
    const { repos, covers } = c.get('services');
    const { assetId, variant } = c.req.valid('param').file;
    const notFound = () => new ApiHttpError(404, 'not_found', 'Cover not found');

    const asset = await repos.coverAssets.find(assetId);
    if (!asset) throw notFound();
    if (!(await canViewCover(repos, c.get('ownerId'), asset))) throw notFound();

    const etag = `"${assetId}${variant === 'thumb' ? '-thumb' : ''}"`;
    c.header('ETag', etag);
    c.header('Cache-Control', `${asset.ownerId === null ? 'public' : 'private'}, ${ONE_YEAR}`);
    if (c.req.header('if-none-match') === etag) return c.body(null, 304);

    const file = await covers.readFile(assetId, variant);
    if (!file) throw notFound();
    c.header('Content-Type', 'image/webp');
    c.header('Content-Length', String(file.byteLength));
    return c.body(new Uint8Array(file));
  });
