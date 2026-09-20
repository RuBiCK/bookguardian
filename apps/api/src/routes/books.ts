import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import {
  bookListQuerySchema,
  COVER_UPLOAD_MAX_BYTES,
  createBookRequestSchema,
  idParamSchema,
  moveBookInputSchema,
  updateBookInputSchema,
  uploadCoverQuerySchema,
  type BookPage,
  type LendingListResponse,
} from '@bookguardian/shared';
import type { AppEnv } from '../app-env';
import { InvalidImageError } from '../covers';
import { ApiHttpError } from '../errors';
import { createBook, moveBook, presentBook, resolveDefaults, updateBook } from '../inventory';
import { listLendings } from '../lending';
import { validate } from '../validation';

export const bookRoutes = new Hono<AppEnv>()
  .get('/', validate('query', bookListQuerySchema), async (c) => {
    const { repos, covers } = c.get('services');
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
    const body: BookPage = {
      items: items.map((item) => presentBook(covers, item)),
      total,
      limit,
      offset,
    };
    return c.json(body);
  })
  .post('/', validate('json', createBookRequestSchema), async (c) => {
    const book = await createBook(c.get('services'), c.get('ownerId'), c.req.valid('json'));
    return c.json(book, 201);
  })
  .get('/:id', validate('param', idParamSchema), async (c) => {
    const { repos, covers } = c.get('services');
    const book = await repos.books.findById(c.get('ownerId'), c.req.valid('param').id);
    if (!book) throw new ApiHttpError(404, 'not_found', 'Book not found');
    return c.json(presentBook(covers, book));
  })
  .patch(
    '/:id',
    validate('param', idParamSchema),
    validate('json', updateBookInputSchema),
    async (c) => {
      const book = await updateBook(
        c.get('services'),
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
        c.get('services'),
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
    // The cover file stays: it may be shared, and the GC sweeps private ones.
    await repos.books.delete(ownerId, id);
    return c.body(null, 204);
  })
  /**
   * Upload a photo as the book's cover (multipart field `file`). With
   * `?fallback=true` it only fills an empty slot — the scan's cover shot
   * stands in until the catalogue cover arrives, if it ever does.
   */
  .post(
    '/:id/cover',
    validate('param', idParamSchema),
    validate('query', uploadCoverQuerySchema),
    bodyLimit({
      maxSize: COVER_UPLOAD_MAX_BYTES,
      onError: () => {
        throw new ApiHttpError(413, 'cover_too_large', 'Cover image is too large', {
          maxBytes: COVER_UPLOAD_MAX_BYTES,
        });
      },
    }),
    async (c) => {
      const { covers } = c.get('services');
      const ownerId = c.get('ownerId');
      const { id } = c.req.valid('param');
      const { fallback } = c.req.valid('query');
      const body = await c.req.parseBody();
      const file = body.file;
      if (!(file instanceof File)) {
        throw new ApiHttpError(422, 'validation_error', 'Multipart field "file" is required');
      }
      let result;
      try {
        result = await covers.importPhoto(ownerId, id, Buffer.from(await file.arrayBuffer()), {
          fallback,
        });
      } catch (error) {
        if (error instanceof InvalidImageError) {
          throw new ApiHttpError(422, 'invalid_image', 'That file is not a usable cover image', {
            reason: error.message,
          });
        }
        throw error;
      }
      if (!result) throw new ApiHttpError(404, 'not_found', 'Book not found');
      return c.json(presentBook(covers, result.book), result.applied ? 200 : 202);
    },
  )
  /** Drop the user's own cover and go back to the catalogue one. */
  .delete('/:id/cover', validate('param', idParamSchema), async (c) => {
    const { covers } = c.get('services');
    const book = await covers.clearOverride(c.get('ownerId'), c.req.valid('param').id);
    if (!book) throw new ApiHttpError(404, 'not_found', 'Book not found');
    return c.json(presentBook(covers, book));
  });

/** `GET /api/defaults` — where the add-book form should point by default. */
export const defaultsRoutes = new Hono<AppEnv>().get('/', async (c) => {
  return c.json(await resolveDefaults(c.get('services').repos, c.get('ownerId')));
});
