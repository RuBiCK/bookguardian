import { Hono } from 'hono';
import {
  bookListQuerySchema,
  createBookRequestSchema,
  idParamSchema,
  moveBookInputSchema,
  updateBookInputSchema,
  type BookPage,
  type LendingListResponse,
} from '@bookguardian/shared';
import type { AppEnv } from '../app-env';
import { ApiHttpError } from '../errors';
import { createBook, moveBook, resolveDefaults, updateBook } from '../inventory';
import { listLendings } from '../lending';
import { validate } from '../validation';

export const bookRoutes = new Hono<AppEnv>()
  .get('/', validate('query', bookListQuerySchema), async (c) => {
    const { repos } = c.get('services');
    const ownerId = c.get('ownerId');
    const { libraryId, shelfId, limit, offset, ...rest } = c.req.valid('query');

    // A library filter is a shelf filter over that library's shelves.
    let shelfIds: string[] | undefined;
    if (shelfId) {
      shelfIds = [shelfId];
    } else if (libraryId) {
      shelfIds = (await repos.shelves.listByLibrary(ownerId, libraryId)).map((s) => s.id);
    }

    const { items, total } = await repos.books.search(ownerId, {
      ...rest,
      shelfIds,
      limit,
      offset,
    });
    const body: BookPage = { items, total, limit, offset };
    return c.json(body);
  })
  .post('/', validate('json', createBookRequestSchema), async (c) => {
    const book = await createBook(c.get('services').repos, c.get('ownerId'), c.req.valid('json'));
    return c.json(book, 201);
  })
  .get('/:id', validate('param', idParamSchema), async (c) => {
    const { repos } = c.get('services');
    const book = await repos.books.findById(c.get('ownerId'), c.req.valid('param').id);
    if (!book) throw new ApiHttpError(404, 'not_found', 'Book not found');
    return c.json(book);
  })
  .patch(
    '/:id',
    validate('param', idParamSchema),
    validate('json', updateBookInputSchema),
    async (c) => {
      const book = await updateBook(
        c.get('services').repos,
        c.get('ownerId'),
        c.req.valid('param').id,
        c.req.valid('json'),
      );
      return c.json(book);
    },
  )
  .post(
    '/:id/move',
    validate('param', idParamSchema),
    validate('json', moveBookInputSchema),
    async (c) => {
      const book = await moveBook(
        c.get('services').repos,
        c.get('ownerId'),
        c.req.valid('param').id,
        c.req.valid('json').shelfId,
      );
      return c.json(book);
    },
  )
  /** Lending history of one book, newest first (the open lending, if any, comes first). */
  .get('/:id/lendings', validate('param', idParamSchema), async (c) => {
    const items = await listLendings(c.get('services').repos, c.get('ownerId'), {
      bookId: c.req.valid('param').id,
    });
    const body: LendingListResponse = { items };
    return c.json(body);
  })
  .delete('/:id', validate('param', idParamSchema), async (c) => {
    const { repos } = c.get('services');
    const ownerId = c.get('ownerId');
    const { id } = c.req.valid('param');
    if (!(await repos.books.findById(ownerId, id))) {
      throw new ApiHttpError(404, 'not_found', 'Book not found');
    }
    await repos.books.delete(ownerId, id);
    return c.body(null, 204);
  });

/** `GET /api/defaults` — where the add-book form should point by default. */
export const defaultsRoutes = new Hono<AppEnv>().get('/', async (c) => {
  return c.json(await resolveDefaults(c.get('services').repos, c.get('ownerId')));
});
