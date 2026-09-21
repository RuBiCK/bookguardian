/**
 * Google Books volumes API (https://developers.google.com/books/docs/v1/using).
 * Works without a key but anonymous quota is tiny; set GOOGLE_BOOKS_API_KEY
 * in production. Used as the fallback when Open Library has no record, and
 * searched alongside it. Structured fields become the API's own operators
 * (`intitle:`, `inauthor:`, `isbn:`, `inpublisher:`); it has no year field.
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
import { fetchJson, type LookupProvider, type SearchQuery } from './types';

interface GoogleImageLinks {
  thumbnail?: string;
  smallThumbnail?: string;
}

interface GoogleVolume {
  id?: string;
  volumeInfo?: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    description?: string;
    industryIdentifiers?: { type?: string; identifier?: string }[];
    pageCount?: number;
    categories?: string[];
    imageLinks?: GoogleImageLinks;
    language?: string;
  };
}

interface GoogleVolumesResponse {
  items?: GoogleVolume[];
}

export interface GoogleBooksOptions {
  baseUrl: string;
  apiKey?: string;
}

/** Google's thumbnails are http and carry a page-curl overlay; ask for a clean, larger one. */
function cover(links: GoogleImageLinks | undefined): string | null {
  const raw = links?.thumbnail ?? links?.smallThumbnail;
  if (!raw) return null;
  return httpsUrl(raw.replace(/&edge=curl/g, '').replace(/zoom=\d/, 'zoom=1'));
}

function toDraft(volume: GoogleVolume): BookDraft | null {
  const info = volume.volumeInfo;
  if (!info?.title) return null;
  const isbn = pickIsbn(
    (info.industryIdentifiers ?? [])
      .filter((id) => id.type === 'ISBN_13' || id.type === 'ISBN_10')
      .map((id) => id.identifier),
  );
  return finalizeDraft({
    isbn10: isbn.isbn10,
    isbn13: isbn.isbn13,
    title: text(info.title, 500) ?? '',
    subtitle: text(info.subtitle, 500),
    authors: stringList(info.authors, 200),
    publisher: text(info.publisher, 200),
    publishedDate: text(info.publishedDate, 40),
    pages: positiveInt(info.pageCount),
    language: normalizeLanguage(info.language),
    coverUrl: cover(info.imageLinks),
    categories: stringList(info.categories, 120, 8),
    description: longText(info.description, 10_000),
    source: 'google_books',
    sourceId: text(volume.id, 200),
  });
}

/** Quote a phrase for the `q` operators; Google reads `intitle:"dune messiah"` as one phrase. */
const phrase = (value: string) => `"${value.replace(/"/g, ' ').replace(/\s+/g, ' ').trim()}"`;

/** The `q` string for a structured query: free text plus one operator per field. */
export function volumesQuery(query: SearchQuery): string {
  return [
    query.q,
    query.title ? `intitle:${phrase(query.title)}` : null,
    query.author ? `inauthor:${phrase(query.author)}` : null,
    query.isbn13 ? `isbn:${query.isbn13}` : null,
    query.publisher ? `inpublisher:${phrase(query.publisher)}` : null,
  ]
    .filter(Boolean)
    .join(' ');
}

export function googleBooksProvider({ baseUrl, apiKey }: GoogleBooksOptions): LookupProvider {
  const base = baseUrl.replace(/\/$/, '');
  const name = 'google_books' as const;

  const volumesUrl = (q: string, maxResults: number) => {
    const params = new URLSearchParams({
      q,
      maxResults: String(maxResults),
      printType: 'books',
    });
    if (apiKey) params.set('key', apiKey);
    return `${base}/volumes?${params.toString()}`;
  };

  return {
    name,

    async byIsbn(isbn13, ctx) {
      const { body } = await fetchJson<GoogleVolumesResponse>(
        ctx,
        name,
        volumesUrl(`isbn:${isbn13}`, 1),
      );
      const volume = body?.items?.[0];
      if (!volume) return null;
      const draft = toDraft(volume);
      // Google may answer an ISBN query with a related edition; keep the ISBN that was asked for.
      return draft && !draft.isbn13 ? finalizeDraft({ ...draft, isbn13 }) : draft;
    },

    async search(query, limit, ctx) {
      const q = volumesQuery(query);
      if (!q) return []; // only a year: nothing Google can look up
      const { body } = await fetchJson<GoogleVolumesResponse>(ctx, name, volumesUrl(q, limit));
      const drafts: BookDraft[] = [];
      for (const volume of body?.items ?? []) {
        const draft = toDraft(volume);
        if (draft) drafts.push(draft);
        if (drafts.length >= limit) break;
      }
      return drafts;
    },
  };
}
