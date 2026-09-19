import { Hono } from 'hono';
import {
  createShelfInputSchema,
  deleteContainerQuerySchema,
  idParamSchema,
  reorderShelvesInputSchema,
  shelfListQuerySchema,
  updateShelfInputSchema,
  type ShelfListResponse,
} from '@bookguardian/shared';
import type { AppEnv } from '../app-env';
import { ApiHttpError } from '../errors';
import { deleteShelf, getShelf, listShelves, reorderShelves } from '../inventory';
import { validate } from '../validation';

export const shelfRoutes = new Hono<AppEnv>()
  .get('/', validate('query', shelfListQuerySchema), async (c) => {
    const body: ShelfListResponse = {
      items: await listShelves(
        c.get('services').repos,
        c.get('ownerId'),
        c.req.valid('query').libraryId,
      ),
    };
    return c.json(body);
  })
  .post('/', validate('json', createShelfInputSchema), async (c) => {
    const { repos } = c.get('services');
    const ownerId = c.get('ownerId');
    const input = c.req.valid('json');
    if (!(await repos.libraries.findById(ownerId, input.libraryId))) {
      throw new ApiHttpError(422, 'unknown_library', 'Library not found', {
        libraryId: input.libraryId,
      });
    }
    // New shelves go last unless the caller says otherwise.
    const siblings = await repos.shelves.listByLibrary(ownerId, input.libraryId);
    const sortOrder =
      input.sortOrder ?? siblings.reduce((max, s) => Math.max(max, s.sortOrder + 1), 0);
    const shelf = await repos.shelves.create(ownerId, { ...input, sortOrder });
    return c.json({ ...shelf, bookCount: 0 }, 201);
  })
  .post('/reorder', validate('json', reorderShelvesInputSchema), async (c) => {
    const { libraryId, shelfIds } = c.req.valid('json');
    const body: ShelfListResponse = {
      items: await reorderShelves(c.get('services'), c.get('ownerId'), libraryId, shelfIds),
    };
    return c.json(body);
  })
  .get('/:id', validate('param', idParamSchema), async (c) => {
    return c.json(
      await getShelf(c.get('services').repos, c.get('ownerId'), c.req.valid('param').id),
    );
  })
  .patch(
    '/:id',
    validate('param', idParamSchema),
    validate('json', updateShelfInputSchema),
    async (c) => {
      const { repos } = c.get('services');
      const { id } = c.req.valid('param');
      const updated = await repos.shelves.update(c.get('ownerId'), id, c.req.valid('json'));
      if (!updated) throw new ApiHttpError(404, 'not_found', 'Shelf not found');
      return c.json(await getShelf(repos, c.get('ownerId'), id));
    },
  )
  .delete(
    '/:id',
    validate('param', idParamSchema),
    validate('query', deleteContainerQuerySchema),
    async (c) => {
      const result = await deleteShelf(
        c.get('services'),
        c.get('ownerId'),
        c.req.valid('param').id,
        c.req.valid('query').moveBooksTo,
      );
      return c.json(result);
    },
  );
