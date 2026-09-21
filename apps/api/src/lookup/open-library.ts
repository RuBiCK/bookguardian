/**
 * Open Library (https://openlibrary.org/developers/api). No key required.
 *
 * ISBN lookups read the edition record, then the work (description, subjects)
 * and each author (names) — three small requests, all cached by the service.
 * Search asks for the best-matching edition per work (`editions.*` fields) so
 * a result carries one concrete ISBN, publisher and language. Structured
 * fields map onto the search API's own parameters (`title=`, `author=`,
 * `isbn=`, `publisher=`); the year rides in `q` as a Solr field query.
 */
import type { BookDraft } from '@bookguardian/shared';
import {
  finalizeDraft,
  httpsUrl,
  longText,
  normalizeLanguage,
  pickIsbn,
  positiveInt,
  stringList,
  text,
} from './normalize';
import { fetchJson, type LookupProvider, type ProviderContext, type SearchQuery } from './types';

interface OlEdition {
  key?: string;
  title?: string;
  subtitle?: string;
  authors?: { key?: string }[];
  publishers?: string[];
  publish_date?: string;
  number_of_pages?: number;
  languages?: { key?: string }[];
  covers?: number[];
  isbn_10?: string[];
  isbn_13?: string[];
  works?: { key?: string }[];
  description?: unknown;
  subjects?: string[];
}

interface OlWork {
  description?: unknown;
  subjects?: string[];
}

interface OlAuthor {
  name?: string;
}

interface OlSearchDoc {
  key?: string;
  title?: string;
  subtitle?: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  subject?: string[];
  number_of_pages_median?: number;
  editions?: {
    docs?: {
      key?: string;
      title?: string;
      subtitle?: string;
      cover_i?: number;
      language?: string[];
      publisher?: string[];
      publish_date?: string[];
      isbn?: string[];
      number_of_pages?: number;
    }[];
  };
}

interface OlSearchResponse {
  docs?: OlSearchDoc[];
}

const COVERS = 'https://covers.openlibrary.org/b/id';
const coverUrl = (id: number | undefined) => (id && id > 0 ? `${COVERS}/${id}-L.jpg` : null);

const SEARCH_FIELDS = [
  'key',
  'title',
  'subtitle',
  'author_name',
  'first_publish_year',
  'cover_i',
  'subject',
  'number_of_pages_median',
  'editions',
  'editions.key',
  'editions.title',
  'editions.subtitle',
  'editions.isbn',
  'editions.language',
  'editions.publisher',
  'editions.publish_date',
  'editions.number_of_pages',
  'editions.cover_i',
].join(',');

export interface OpenLibraryOptions {
  baseUrl: string;
  /** Preferred edition language for search (ISO 639-1). */
  lang?: string;
}

/** The search API's own parameters for a structured query (`q` carries free text and the year). */
export function searchParams(query: SearchQuery): URLSearchParams {
  const params = new URLSearchParams();
  const q = [query.q, query.year ? `first_publish_year:${query.year}` : null]
    .filter(Boolean)
    .join(' ');
  if (q) params.set('q', q);
  if (query.title) params.set('title', query.title);
  if (query.author) params.set('author', query.author);
  if (query.isbn13) params.set('isbn', query.isbn13);
  if (query.publisher) params.set('publisher', query.publisher);
  return params;
}

export function openLibraryProvider({ baseUrl, lang = 'en' }: OpenLibraryOptions): LookupProvider {
  const base = baseUrl.replace(/\/$/, '');
  const name = 'open_library' as const;

  async function author(key: string, ctx: ProviderContext): Promise<string | null> {
    try {
      const { body } = await fetchJson<OlAuthor>(ctx, name, `${base}${key}.json`);
      return text(body?.name, 200);
    } catch {
      return null; // a missing author name never sinks the whole lookup
    }
  }

  async function work(key: string, ctx: ProviderContext): Promise<OlWork | null> {
    try {
      return (await fetchJson<OlWork>(ctx, name, `${base}${key}.json`)).body;
    } catch {
      return null;
    }
  }

  return {
    name,

    async byIsbn(isbn13, ctx) {
      const { body: edition } = await fetchJson<OlEdition>(
        ctx,
        name,
        `${base}/isbn/${isbn13}.json`,
      );
      if (!edition?.title) return null;

      const workKey = edition.works?.[0]?.key;
      const [authors, workRecord] = await Promise.all([
        Promise.all(
          (edition.authors ?? [])
            .map((a) => a.key)
            .filter((key): key is string => typeof key === 'string')
            .slice(0, 10)
            .map((key) => author(key, ctx)),
        ),
        workKey ? work(workKey, ctx) : Promise.resolve(null),
      ]);

      // The scanned/typed ISBN identifies this edition; other listed ISBNs are siblings.
      const isbn = pickIsbn([isbn13, ...(edition.isbn_13 ?? []), ...(edition.isbn_10 ?? [])]);
      const draft: BookDraft = {
        isbn10: isbn.isbn10,
        isbn13: isbn.isbn13,
        title: text(edition.title, 500) ?? '',
        subtitle: text(edition.subtitle, 500),
        authors: authors.filter((a): a is string => a !== null),
        publisher: text(edition.publishers?.[0], 200),
        publishedDate: text(edition.publish_date, 40),
        pages: positiveInt(edition.number_of_pages),
        language: normalizeLanguage(edition.languages?.[0]?.key),
        coverUrl: coverUrl(edition.covers?.[0]),
        categories: stringList(workRecord?.subjects ?? edition.subjects, 120, 8),
        description: longText(edition.description ?? workRecord?.description, 10_000),
        source: name,
        sourceId: text(edition.key, 200),
      };
      return finalizeDraft(draft);
    },

    async search(query, limit, ctx) {
      const params = searchParams(query);
      params.set('limit', String(limit));
      params.set('lang', lang);
      params.set('fields', SEARCH_FIELDS);
      const { body } = await fetchJson<OlSearchResponse>(
        ctx,
        name,
        `${base}/search.json?${params.toString()}`,
      );
      const drafts: BookDraft[] = [];
      for (const doc of body?.docs ?? []) {
        const edition = doc.editions?.docs?.[0];
        const isbn = pickIsbn(edition?.isbn);
        const draft = finalizeDraft({
          isbn10: isbn.isbn10,
          isbn13: isbn.isbn13,
          title: text(doc.title, 500) ?? '',
          subtitle: text(edition?.subtitle ?? doc.subtitle, 500),
          authors: stringList(doc.author_name, 200),
          publisher: text(edition?.publisher?.[0], 200),
          publishedDate:
            text(edition?.publish_date?.[0], 40) ??
            (doc.first_publish_year ? String(doc.first_publish_year) : null),
          pages: positiveInt(edition?.number_of_pages ?? doc.number_of_pages_median),
          language: normalizeLanguage(edition?.language?.[0]),
          coverUrl: httpsUrl(coverUrl(edition?.cover_i ?? doc.cover_i)),
          categories: stringList(doc.subject, 120, 8),
          description: null,
          source: name,
          sourceId: text(edition?.key ?? doc.key, 200),
        });
        if (draft) drafts.push(draft);
        if (drafts.length >= limit) break;
      }
      return drafts;
    },
  };
}
