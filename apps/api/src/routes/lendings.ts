import { Hono } from 'hono';
import {
  createLendingInputSchema,
  idParamSchema,
  lendingListQuerySchema,
  returnLendingInputSchema,
  type BorrowerListResponse,
  type LendingListResponse,
} from '@bookguardian/shared';
import type { AppEnv } from '../app-env';
import { getLending, lendBook, listBorrowers, listLendings, returnLending } from '../lending';
import { validate } from '../validation';

export const lendingRoutes = new Hono<AppEnv>()
  .get('/', validate('query', lendingListQuerySchema), async (c) => {
    const { active = true, ...rest } = c.req.valid('query');
    const items = await listLendings(c.get('services').repos, c.get('ownerId'), {
      ...rest,
      active,
    });
    const body: LendingListResponse = { items };
    return c.json(body);
  })
  .post('/', validate('json', createLendingInputSchema), async (c) => {
    const lending = await lendBook(c.get('services'), c.get('ownerId'), c.req.valid('json'));
    return c.json(lending, 201);
  })
  .get('/borrowers', async (c) => {
    const items = await listBorrowers(c.get('services').repos, c.get('ownerId'));
    const body: BorrowerListResponse = { items };
    return c.json(body);
  })
  .get('/:id', validate('param', idParamSchema), async (c) => {
    const lending = await getLending(
      c.get('services').repos,
      c.get('ownerId'),
      c.req.valid('param').id,
    );
    return c.json(lending);
  })
  .post(
    '/:id/return',
    validate('param', idParamSchema),
    validate('json', returnLendingInputSchema),
    async (c) => {
      const lending = await returnLending(
        c.get('services'),
        c.get('ownerId'),
        c.req.valid('param').id,
        c.req.valid('json').returnedAt,
      );
      return c.json(lending);
    },
  );
