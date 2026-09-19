import { z } from 'zod';
import { bookDraftSchema } from '../schemas/book-draft';
import { parseIsbn } from '../lib/isbn';

/** `GET /api/lookup/isbn/:isbn` — hyphens/spaces allowed, must be a valid ISBN-10/13. */
export const lookupIsbnParamSchema = z.object({
  isbn: z
    .string()
    .trim()
    .min(10)
    .max(20)
    .transform((value, ctx) => {
      const parsed = parseIsbn(value);
      if (!parsed) {
        ctx.addIssue({ code: 'custom', message: 'Invalid ISBN' });
        return z.NEVER;
      }
      return parsed.isbn13;
    }),
});
export type LookupIsbnParam = z.infer<typeof lookupIsbnParamSchema>;

export const LOOKUP_MAX_RESULTS = 10;

/** `GET /api/lookup/search?q=` — free text (title, author, OCR guess). */
export const lookupSearchQuerySchema = z.object({
  q: z.string().trim().min(2).max(200),
  limit: z.coerce.number().int().min(1).max(LOOKUP_MAX_RESULTS).default(5),
});
export type LookupSearchQuery = z.infer<typeof lookupSearchQuerySchema>;

export const lookupSearchResponseSchema = z.object({ items: z.array(bookDraftSchema) });
export type LookupSearchResponse = z.infer<typeof lookupSearchResponseSchema>;
