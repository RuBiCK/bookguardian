import { Hono } from 'hono';
import {
  createLibraryInputSchema,
  deleteContainerQuerySchema,
  idParamSchema,
  updateLibraryInputSchema,
  type LibraryListResponse,
} from '@bookguardian/shared';
import type { AppEnv } from '../app-env';
import { ApiHttpError } from '../errors';
import { deleteLibrary, getLibrary, listLibraries } from '../inventory';
import { validate } from '../validation';

export const libraryRoutes = new Hono<AppEnv>()
  .get('/', async (c) => {
    const body: LibraryListResponse = {
      items: await listLibraries(c.get('services').repos, c.get('ownerId')),
    };
    return c.json(body);
  })
  .post('/', validate('json', createLibraryInputSchema), async (c) => {
    const { repos } = c.get('services');
    const library = await repos.libraries.create(c.get('ownerId'), c.req.valid('json'));
    return c.json({ ...library, shelfCount: 0, bookCount: 0 }, 201);
  })
  .get('/:id', validate('param', idParamSchema), async (c) => {
    const library = await getLibrary(
      c.get('services').repos,
      c.get('ownerId'),
      c.req.valid('param').id,
    );
    return c.json(library);
  })
  .patch(
    '/:id',
    validate('param', idParamSchema),
    validate('json', updateLibraryInputSchema),
    async (c) => {
      const { repos } = c.get('services');
      const { id } = c.req.valid('param');
      const updated = await repos.libraries.update(c.get('ownerId'), id, c.req.valid('json'));
      if (!updated) throw new ApiHttpError(404, 'not_found', 'Library not found');
      return c.json(await getLibrary(repos, c.get('ownerId'), id));
    },
  )
  .delete(
    '/:id',
    validate('param', idParamSchema),
    validate('query', deleteContainerQuerySchema),
    async (c) => {
      const result = await deleteLibrary(
        c.get('services'),
        c.get('ownerId'),
        c.req.valid('param').id,
        c.req.valid('query').moveBooksTo,
      );
      return c.json(result);
    },
  );
