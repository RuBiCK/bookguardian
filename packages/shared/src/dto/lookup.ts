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

/** An optional text field: blank counts as "not given" so a form can send every field as is. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value === '' ? undefined : value));

/** The four-digit year a form's free-form "year" field holds, if any (`"August 1, 1978"` → 1978). */
export function yearOf(value: string | null | undefined): number | undefined {
  const match = value?.match(/\b(1[5-9]\d{2}|20\d{2})\b/);
  return match ? Number(match[1]) : undefined;
}

/** Fields the search endpoint understands; at least one must be given. */
export const LOOKUP_SEARCH_FIELDS = ['q', 'title', 'author', 'isbn', 'publisher', 'year'] as const;

/**
 * `GET /api/lookup/search` — free text (`q`: title, author, OCR guess) and/or
 * structured fields from the add-book form. Providers get the structured
 * query where they support it; the ISBN is normalised to its 13-digit form.
 */
export const lookupSearchQuerySchema = z
  .object({
    q: optionalText(200).pipe(z.string().min(2).optional()),
    title: optionalText(200),
    author: optionalText(200),
    isbn: optionalText(20).transform((value, ctx) => {
      if (value === undefined) return undefined;
      const parsed = parseIsbn(value);
      if (!parsed) {
        ctx.addIssue({ code: 'custom', message: 'Invalid ISBN' });
        return z.NEVER;
      }
      return parsed.isbn13;
    }),
    publisher: optionalText(200),
    year: z.coerce.number().int().min(1500).max(2100).optional(),
    limit: z.coerce.number().int().min(1).max(LOOKUP_MAX_RESULTS).default(5),
  })
  .refine((query) => LOOKUP_SEARCH_FIELDS.some((field) => query[field] !== undefined), {
    message: 'Give free text or at least one of title, author, isbn, publisher, year',
    path: ['q'],
  });
export type LookupSearchQuery = z.infer<typeof lookupSearchQuerySchema>;
/** What a client sends: the same fields before validation, all optional strings. */
export type LookupSearchInput = Partial<Record<(typeof LOOKUP_SEARCH_FIELDS)[number], string>>;

/**
 * A search hit: a draft plus a `resultId` that is stable across repeated
 * searches (provider + provider key), so the UI can key lists and remember a
 * pick, and the `source` it came from.
 */
export const lookupSearchResultSchema = bookDraftSchema.extend({
  resultId: z.string().min(1).max(260),
});
export type LookupSearchResult = z.infer<typeof lookupSearchResultSchema>;

export const lookupSearchResponseSchema = z.object({ items: z.array(lookupSearchResultSchema) });
export type LookupSearchResponse = z.infer<typeof lookupSearchResponseSchema>;
