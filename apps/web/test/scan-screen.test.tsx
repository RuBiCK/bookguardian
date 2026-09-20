import type { BookDraft } from '@bookguardian/shared';
import { en } from '@bookguardian/shared/i18n';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CameraFailure } from '../src/lib/barcode';
import { installFakeApi, seedFakeApi, type FakeApi } from './fake-api';
import { renderApp } from './render';

// ---- Module doubles: no real camera, decoder or OCR in jsdom ---------------

const scannerStop = vi.fn();
let onIsbn: ((isbn13: string) => void) | undefined;
let cameraSupported = true;
let cameraFailure: CameraFailure | null = null;
const startIsbnScanner = vi.fn((_: HTMLVideoElement, cb: (isbn13: string) => void) => {
  onIsbn = cb;
  if (cameraFailure) {
    const error = Object.assign(new Error('camera'), {
      name: 'CameraError',
      reason: cameraFailure,
    });
    return Promise.reject(error);
  }
  return Promise.resolve({ stop: scannerStop });
});
const decodeIsbnFromImage = vi.fn<(file: Blob) => Promise<string | null>>();
const recognizeText =
  vi.fn<
    (
      file: Blob,
      options?: { onProgress?: (p: { phase: string; progress: number }) => void },
    ) => Promise<string>
  >();

vi.mock('../src/lib/barcode', () => ({
  hasCameraSupport: () => cameraSupported,
  startIsbnScanner: (video: HTMLVideoElement, cb: (isbn13: string) => void) =>
    startIsbnScanner(video, cb),
  decodeIsbnFromImage: (file: Blob) => decodeIsbnFromImage(file),
}));
vi.mock('../src/lib/ocr', () => ({
  recognizeText: (file: Blob, options?: never) => recognizeText(file, options),
}));

const DUNE: BookDraft = {
  isbn10: '0441013597',
  isbn13: '9780441013593',
  title: 'Dune',
  subtitle: 'Book one',
  authors: ['Frank Herbert'],
  publisher: 'Ace',
  publishedDate: '1965',
  pages: 412,
  language: 'en',
  coverUrl: 'https://covers.example.com/dune.jpg',
  categories: ['Science fiction'],
  description: 'Desert planet.',
  source: 'open_library',
  sourceId: '/books/OL1M',
};
const EMMA: BookDraft = {
  ...DUNE,
  isbn10: null,
  isbn13: '9780141439587',
  title: 'Emma',
  subtitle: null,
  authors: ['Jane Austen'],
  publisher: null,
  publishedDate: null,
  coverUrl: null,
  source: 'google_books',
  sourceId: 'g1',
};

let api: FakeApi;
const user = () => userEvent.setup();
const photo = () => new File(['x'], 'photo.jpg', { type: 'image/jpeg' });

beforeEach(() => {
  api = installFakeApi();
  seedFakeApi(api);
  api.drafts = { [DUNE.isbn13!]: DUNE };
  onIsbn = undefined;
  cameraSupported = true;
  cameraFailure = null;
  startIsbnScanner.mockClear();
  scannerStop.mockClear();
  decodeIsbnFromImage.mockReset();
  recognizeText.mockReset();
});
afterEach(() => {
  api.restore();
});

async function openScan() {
  await renderApp('/scan');
  await screen.findByRole('heading', { level: 1, name: en.scan.title });
}

describe('Scan tab — ISBN mode', () => {
  it('scans a barcode live, shows the result and adds it to the default shelf in one tap', async () => {
    await openScan();
    await waitFor(() =>
      expect(screen.getByTestId('scanner')).toHaveAttribute('data-state', 'live'),
    );
    expect(screen.getByTestId('scanner-status')).toHaveTextContent(en.scan.camera.ready);
    expect(startIsbnScanner).toHaveBeenCalledTimes(1);

    act(() => onIsbn!('9780441013593'));
    expect(scannerStop).toHaveBeenCalled();
    const sheet = await screen.findByRole('dialog', { name: en.scan.result.title });
    expect(within(sheet).getByText('Dune')).toBeInTheDocument();
    expect(within(sheet).getByText('Frank Herbert')).toBeInTheDocument();
    expect(within(sheet).getByText('Ace · 1965')).toBeInTheDocument();
    expect(within(sheet).getByText('via Open Library')).toBeInTheDocument();

    await user().click(
      await within(sheet).findByRole('button', { name: 'Add to My Library › Default' }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText('Added to My Library › Default')).toBeInTheDocument();
    await waitFor(() => expect(api.books).toHaveLength(1));
    expect(api.books[0]).toMatchObject({
      title: 'Dune',
      isbn13: '9780441013593',
      isbn10: '0441013597',
      authors: ['Frank Herbert'],
      pages: 412,
      // The provider's cover URL is not stored; the API fetches its own copy by ISBN.
      coverPending: true,
    });
    expect(api.uploads).toEqual([]); // no photo was involved in a barcode scan
    // Scanning resumes for the next book.
    await waitFor(() => expect(startIsbnScanner).toHaveBeenCalledTimes(2));
  });

  it('opens the full form pre-filled from the result when the user wants to edit first', async () => {
    await openScan();
    await waitFor(() => expect(onIsbn).toBeDefined());
    act(() => onIsbn!('9780441013593'));
    const result = await screen.findByRole('dialog', { name: en.scan.result.title });
    await user().click(within(result).getByRole('button', { name: en.scan.result.edit }));

    const form = await screen.findByRole('dialog', { name: en.books.add });
    expect(within(form).getByLabelText(en.books.field.title)).toHaveValue('Dune');
    expect(within(form).getByLabelText(en.books.field.authors)).toHaveValue('Frank Herbert');
    expect(within(form).getByLabelText(en.books.field.isbn)).toHaveValue('9780441013593');
    expect(within(form).getByLabelText(en.books.field.description)).toHaveValue('Desert planet.');
    await user().clear(within(form).getByLabelText(en.books.field.title));
    await user().type(within(form).getByLabelText(en.books.field.title), 'Dune (hardback)');
    await user().click(within(form).getByRole('button', { name: en.common.save }));
    await waitFor(() => expect(api.books.map((b) => b.title)).toEqual(['Dune (hardback)']));
  });

  it('falls back to a photo when the camera is denied and decodes the barcode from it', async () => {
    cameraFailure = 'denied';
    await openScan();
    await waitFor(() =>
      expect(screen.getByTestId('scanner')).toHaveAttribute('data-state', 'error'),
    );
    expect(screen.getByTestId('scanner-status')).toHaveTextContent(en.scan.camera.denied);

    decodeIsbnFromImage.mockResolvedValueOnce('9780441013593');
    await user().upload(screen.getByTestId('isbn-photo'), photo());
    expect(await screen.findByRole('dialog', { name: en.scan.result.title })).toBeInTheDocument();
  });

  it('explains when there is no camera at all and when a photo has no barcode', async () => {
    cameraSupported = false;
    await openScan();
    expect(screen.getByTestId('scanner-status')).toHaveTextContent(en.scan.camera.unavailable);
    expect(startIsbnScanner).not.toHaveBeenCalled();

    decodeIsbnFromImage.mockResolvedValueOnce(null);
    await user().upload(screen.getByTestId('isbn-photo'), photo());
    const notice = await screen.findByTestId('scan-notice');
    expect(notice).toHaveTextContent(en.scan.noBarcode);
    await user().click(within(notice).getByRole('button', { name: en.scan.cover.tryAgain }));
    expect(screen.queryByTestId('scan-notice')).not.toBeInTheDocument();
  });

  it('looks up a typed ISBN, rejects malformed ones and offers manual entry for unknown ones', async () => {
    cameraFailure = 'failed';
    await openScan();
    const u = user();
    const input = screen.getByLabelText(en.scan.manual.label);
    await u.type(input, '123');
    await u.click(screen.getByRole('button', { name: en.scan.manual.submit }));
    expect(await screen.findByText(en.books.isbnInvalid)).toBeInTheDocument();

    await u.clear(input);
    await u.type(input, '978-0-14-143958-7');
    await u.click(screen.getByRole('button', { name: en.scan.manual.submit }));
    const notFound = await screen.findByRole('dialog', { name: en.scan.result.notFoundTitle });
    expect(notFound).toHaveTextContent('No book found for ISBN 9780141439587.');
    await u.click(within(notFound).getByRole('button', { name: en.scan.result.addManually }));
    const form = await screen.findByRole('dialog', { name: en.books.add });
    expect(within(form).getByLabelText(en.books.field.isbn)).toHaveValue('9780141439587');
    expect(within(form).getByLabelText(en.books.field.title)).toHaveValue('');

    await u.click(within(form).getByRole('button', { name: en.common.close }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // Closing the sheet retried the camera once; "Scan again" retries it on demand.
    await waitFor(() => expect(startIsbnScanner).toHaveBeenCalledTimes(2));
    await u.click(screen.getByRole('button', { name: en.scan.camera.resume }));
    await waitFor(() => expect(startIsbnScanner).toHaveBeenCalledTimes(3));
  });

  it('reports unreachable catalogues without losing the scanned ISBN flow', async () => {
    await openScan();
    await waitFor(() => expect(onIsbn).toBeDefined());
    api.lookupDown = true;
    act(() => onIsbn!('9780441013593'));
    expect(await screen.findByTestId('scan-notice')).toHaveTextContent(en.scan.result.lookupFailed);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('stops the camera when switching to cover mode and restarts it when coming back', async () => {
    await openScan();
    await waitFor(() =>
      expect(screen.getByTestId('scanner')).toHaveAttribute('data-state', 'live'),
    );
    const u = user();
    await u.click(screen.getByRole('button', { name: en.scan.mode.cover }));
    expect(scannerStop).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('scanner')).not.toBeInTheDocument();
    expect(screen.getByText(en.scan.cover.hint)).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: en.scan.mode.cover })); // no-op
    await u.click(screen.getByRole('button', { name: en.scan.mode.isbn }));
    await waitFor(() => expect(startIsbnScanner).toHaveBeenCalledTimes(2));
  });
});

describe('Scan tab — cover mode', () => {
  async function openCover() {
    await openScan();
    await user().click(screen.getByRole('button', { name: en.scan.mode.cover }));
  }

  it('reads the cover, shows up to five candidates and adds the chosen one', async () => {
    api.searchResults = [
      DUNE,
      { ...DUNE, title: 'Dune Messiah', sourceId: '2' },
      { ...DUNE, title: 'Children of Dune', sourceId: '3' },
      { ...DUNE, title: 'God Emperor of Dune', sourceId: '4' },
      { ...DUNE, title: 'Heretics of Dune', sourceId: '5' },
      { ...DUNE, title: 'Chapterhouse: Dune', sourceId: '6' },
    ];
    recognizeText.mockImplementation(async (_file, options) => {
      options?.onProgress?.({ phase: 'loading', progress: 0.5 });
      options?.onProgress?.({ phase: 'recognizing', progress: 0.9 });
      return '#1 NEW YORK TIMES BESTSELLER\nDUNE\nFRANK HERBERT\n';
    });
    await openCover();
    await user().upload(screen.getByTestId('cover-camera'), photo());
    const candidates = await screen.findByTestId('candidates');
    const items = within(candidates).getAllByRole('button');
    expect(items).toHaveLength(5);
    expect(items[0]).toHaveAccessibleName('Dune — Frank Herbert');
    const search = api.calls.find((c) => c.path.startsWith('/api/lookup/search'));
    expect(search?.path).toContain('q=FRANK+HERBERT+DUNE');

    await user().click(items[1]!);
    const result = await screen.findByRole('dialog', { name: en.scan.result.title });
    expect(within(result).getByText('Dune Messiah')).toBeInTheDocument();
    await user().click(
      await within(result).findByRole('button', { name: 'Add to My Library › Default' }),
    );
    await waitFor(() => expect(api.books.map((b) => b.title)).toEqual(['Dune Messiah']));
    // The cover photo is offered as the book's cover, in case the catalogue has none.
    await waitFor(() =>
      expect(api.uploads).toEqual([
        { bookId: api.books[0]!.id, name: 'photo.jpg', fallback: true },
      ]),
    );
  });

  it('keeps the cover photo for a book added by hand after a failed search', async () => {
    const u = user();
    recognizeText.mockResolvedValue('Nothing findable');
    await openCover();
    await u.upload(screen.getByTestId('cover-photo'), photo());
    const notice = await screen.findByTestId('scan-notice');
    await u.click(within(notice).getByRole('button', { name: en.scan.result.addManually }));
    const sheet = await screen.findByRole('dialog', { name: en.books.add });
    await u.click(within(sheet).getByRole('button', { name: en.common.save }));
    await waitFor(() => expect(api.books).toHaveLength(1));
    await waitFor(() => expect(api.uploads).toHaveLength(1));
    expect(api.uploads[0]).toMatchObject({ bookId: api.books[0]!.id, fallback: true });
  });

  it('prefers an ISBN printed on the cover and falls back to search when it is unknown', async () => {
    api.drafts = { [EMMA.isbn13!]: EMMA };
    recognizeText.mockResolvedValue('Penguin Classics\nISBN 978-0-14-143958-7\nEmma\nJane Austen');
    await openCover();
    await user().upload(screen.getByTestId('cover-photo'), photo());
    const result = await screen.findByRole('dialog', { name: en.scan.result.title });
    expect(within(result).getByText('Emma', { selector: '.draft__title' })).toBeInTheDocument();
    expect(within(result).getByText('via Google Books')).toBeInTheDocument();
    expect(api.calls.some((c) => c.path.startsWith('/api/lookup/search'))).toBe(false);

    await user().click(within(result).getByRole('button', { name: en.common.close }));
    api.searchResults = [EMMA];
    recognizeText.mockResolvedValue('ISBN 978-0-441-01359-3\nEmma\nJane Austen');
    await user().upload(screen.getByTestId('cover-photo'), photo());
    expect(await screen.findByTestId('candidates')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: en.scan.result.notFoundTitle })).toBeNull();
    expect(api.calls.some((c) => c.path === '/api/lookup/isbn/9780441013593')).toBe(true);
    expect(api.calls.some((c) => c.path.startsWith('/api/lookup/search'))).toBe(true);
  });

  it('handles no matches, unreadable covers and OCR failures with a manual escape hatch', async () => {
    const u = user();
    recognizeText.mockResolvedValueOnce('The Left Hand of Darkness\nUrsula K. Le Guin');
    await openCover();
    await u.upload(screen.getByTestId('cover-photo'), photo());
    const notice = await screen.findByTestId('scan-notice');
    expect(notice).toHaveTextContent(
      'No matches for “The Left Hand of Darkness Ursula K. Le Guin”.',
    );
    await u.click(within(notice).getByRole('button', { name: en.scan.result.addManually }));
    const form = await screen.findByRole('dialog', { name: en.books.add });
    expect(within(form).getByLabelText(en.books.field.title)).toHaveValue(
      'The Left Hand of Darkness',
    );
    await u.click(within(form).getByRole('button', { name: en.common.close }));

    recognizeText.mockResolvedValueOnce('$$$ 12 34');
    await u.upload(screen.getByTestId('cover-photo'), photo());
    expect(await screen.findByTestId('scan-notice')).toHaveTextContent(en.scan.cover.noText);

    recognizeText.mockRejectedValueOnce(new Error('offline'));
    await u.upload(screen.getByTestId('cover-photo'), photo());
    expect(await screen.findByTestId('scan-notice')).toHaveTextContent(en.scan.cover.ocrFailed);

    api.lookupDown = true;
    recognizeText.mockResolvedValueOnce('Emma\nJane Austen');
    await u.upload(screen.getByTestId('cover-photo'), photo());
    expect(await screen.findByTestId('scan-notice')).toHaveTextContent(en.scan.result.lookupFailed);
  });

  it('lets the candidates sheet hand over to manual entry with the OCR title guess', async () => {
    api.searchResults = [DUNE];
    recognizeText.mockResolvedValue('DUNE\nFRANK HERBERT');
    await openCover();
    await user().upload(screen.getByTestId('cover-photo'), photo());
    const sheet = await screen.findByRole('dialog', { name: en.scan.cover.candidates });
    await user().click(within(sheet).getByRole('button', { name: en.scan.result.addManually }));
    const form = await screen.findByRole('dialog', { name: en.books.add });
    expect(within(form).getByLabelText(en.books.field.title)).toHaveValue('FRANK HERBERT');
  });

  it('ignores a slow OCR result once the user has moved on', async () => {
    let finish: (text: string) => void = () => undefined;
    recognizeText.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
    );
    await openCover();
    await user().upload(screen.getByTestId('cover-photo'), photo());
    expect(await screen.findByTestId('cover-progress')).toBeInTheDocument();
    await user().click(screen.getByRole('button', { name: en.scan.mode.isbn }));
    await act(async () => {
      finish('DUNE\nFRANK HERBERT');
      await Promise.resolve();
    });
    expect(screen.queryByTestId('candidates')).not.toBeInTheDocument();
    expect(api.calls.some((c) => c.path.startsWith('/api/lookup/search'))).toBe(false);
  });
});
